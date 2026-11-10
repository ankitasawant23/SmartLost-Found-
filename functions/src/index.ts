import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { ImageAnnotatorClient } from '@google-cloud/vision';

admin.initializeApp();

const db = admin.firestore();
const vision = new ImageAnnotatorClient();

// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.pass,
  },
});

// Send OTP email for item claiming
export const sendClaimOTP = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { itemId, userEmail } = data;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Store OTP in Firestore with expiration
    await db.collection('otps').doc(`${itemId}_${context.auth.uid}`).set({
      otp,
      itemId,
      userId: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Send email
    await transporter.sendMail({
      from: functions.config().email.user,
      to: userEmail,
      subject: 'Lost & Found - Item Claim Verification',
      html: `
        <h2>Verify Your Item Claim</h2>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send OTP');
  }
});

// Verify OTP for item claiming
export const verifyClaimOTP = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { itemId, otp } = data;
  const otpId = `${itemId}_${context.auth.uid}`;

  try {
    const otpDoc = await db.collection('otps').doc(otpId).get();
    
    if (!otpDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'OTP not found');
    }

    const otpData = otpDoc.data();
    if (otpData?.otp !== otp) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid OTP');
    }

    if (otpData?.expiresAt.toDate() < new Date()) {
      throw new functions.https.HttpsError('deadline-exceeded', 'OTP expired');
    }

    // Update item status
    await db.collection('items').doc(itemId).update({
      status: 'claimed',
      claimantId: context.auth.uid,
      claimantEmail: context.auth.token.email,
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Delete OTP
    await db.collection('otps').doc(otpId).delete();

    return { success: true };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw new functions.https.HttpsError('internal', 'Failed to verify OTP');
  }
});

// Analyze image with Google Vision API
export const analyzeImage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { imageUrl } = data;

  try {
    const [result] = await vision.labelDetection(imageUrl);
    const labels = result.labelAnnotations?.map(label => label.description) || [];
    
    return { labels };
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw new functions.https.HttpsError('internal', 'Failed to analyze image');
  }
});

// Find potential matches for lost items
export const findMatches = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { itemLabels, itemType } = data;
  const oppositeType = itemType === 'lost' ? 'found' : 'lost';

  try {
    const itemsSnapshot = await db.collection('items')
      .where('type', '==', oppositeType)
      .where('status', '==', 'unclaimed')
      .get();

    const matches = [];
    
    for (const doc of itemsSnapshot.docs) {
      const item = doc.data();
      const commonLabels = item.imageLabels?.filter((label: string) => 
        itemLabels.some((l: string) => l.toLowerCase().includes(label.toLowerCase()))
      ) || [];
      
      if (commonLabels.length > 0) {
        const similarity = (commonLabels.length / itemLabels.length) * 100;
        
        if (similarity > 60) {
          matches.push({
            id: doc.id,
            ...item,
            similarity,
          });
        }
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    return { matches };
  } catch (error) {
    console.error('Error finding matches:', error);
    throw new functions.https.HttpsError('internal', 'Failed to find matches');
  }
});

// Send notification when item is matched
export const sendMatchNotification = functions.firestore
  .document('items/{itemId}')
  .onCreate(async (snap, context) => {
    const item = snap.data();
    
    if (item.type === 'lost') {
      // Find potential matches in found items
      const foundItemsSnapshot = await db.collection('items')
        .where('type', '==', 'found')
        .where('status', '==', 'unclaimed')
        .get();

      for (const foundDoc of foundItemsSnapshot.docs) {
        const foundItem = foundDoc.data();
        const commonLabels = foundItem.imageLabels?.filter((label: string) => 
          item.imageLabels?.some((l: string) => l.toLowerCase().includes(label.toLowerCase()))
        ) || [];
        
        if (commonLabels.length > 0) {
          const similarity = (commonLabels.length / item.imageLabels?.length) * 100;
          
          if (similarity > 80) {
            // Send notification to the user who found the item
            await db.collection('notifications').add({
              userId: foundItem.userId,
              title: 'Potential Match Found!',
              message: `Your found item "${foundItem.title}" might match someone's lost item.`,
              type: 'match',
              itemId: foundDoc.id,
              matchedItemId: context.params.itemId,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }
    }
  });