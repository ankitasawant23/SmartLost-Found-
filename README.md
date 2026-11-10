# Smart Lost & Found Portal

A comprehensive web application for managing lost and found items on a college campus, built with React, Firebase, and AI-powered image analysis.

## Features

### 🔐 Authentication
- Email and phone number authentication via Firebase Auth
- Secure OTP verification system
- User profile management

### 📱 Found Item Submission
- Image upload with Firebase Storage
- AI-powered image classification using Google Vision API
- Location and description capture
- Automatic item tagging and categorization

### 🔍 Lost Item Search
- Advanced search and filtering system
- AI-powered item matching
- Real-time match notifications
- Responsive card-based layout

### ✅ Claim Process
- Secure OTP verification via email
- Identity verification system
- Automatic status updates
- Claim history tracking

### 🤖 AI-Powered Matching
- Image similarity analysis using TensorFlow.js
- Automatic match detection (>80% similarity)
- Real-time notifications via Firebase Cloud Messaging
- Fallback to local analysis if API fails

### 👨‍💼 Admin Dashboard
- Item approval/rejection system
- User management
- Analytics and reporting
- Duplicate detection

### 🔔 Notification System
- Real-time push notifications
- Email notifications for important events
- In-app notification center
- Customizable notification preferences

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **React Hook Form** with Yup validation
- **Date-fns** for date handling
- **Lucide React** for icons
- **React Hot Toast** for notifications

### Backend
- **Firebase Authentication** for user management
- **Firestore** for database
- **Firebase Storage** for file uploads
- **Firebase Functions** for serverless backend
- **Firebase Cloud Messaging** for push notifications
- **Firebase Hosting** for deployment

### AI/ML
- **Google Vision API** for image classification
- **TensorFlow.js** for client-side analysis
- **Gemini API** for advanced matching (optional)

## Getting Started

### Prerequisites
- Node.js 18 or higher
- Firebase CLI
- Google Cloud account (for Vision API)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lost-found-portal
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
```bash
firebase login
firebase init
```

4. Configure environment variables:
```bash
cp .env.example .env
```

Fill in your Firebase configuration and API keys in the `.env` file.

5. Start the development server:
```bash
npm run dev
```

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable the following services:
   - Authentication (Email/Password and Phone)
   - Firestore Database
   - Storage
   - Cloud Functions
   - Cloud Messaging

3. Get your Firebase config and update the `.env` file

4. Deploy Firestore rules and indexes:
```bash
firebase deploy --only firestore
```

5. Deploy Cloud Functions:
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React contexts for state management
├── lib/               # Firebase configuration and utilities
├── pages/             # Page components
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── App.tsx            # Main application component

functions/
├── src/               # Cloud Functions source code
└── package.json       # Functions dependencies

public/
├── firebase-messaging-sw.js  # Service worker for FCM
└── index.html

firebase.json          # Firebase configuration
firestore.rules       # Firestore security rules
firestore.indexes.json # Firestore indexes
storage.rules         # Storage security rules
```

## Key Features Implementation

### Image Analysis
The app uses Google Vision API for server-side image analysis and TensorFlow.js as a client-side fallback:

```typescript
// Server-side analysis via Cloud Functions
const analyzeImage = functions.https.onCall(async (data, context) => {
  const [result] = await vision.labelDetection(data.imageUrl);
  const labels = result.labelAnnotations?.map(label => label.description) || [];
  return { labels };
});
```

### Item Matching
Smart matching algorithm compares image labels and calculates similarity:

```typescript
const findMatches = (itemLabels: string[], existingItems: Item[]) => {
  return existingItems.filter(item => {
    const commonLabels = item.imageLabels.filter(label => 
      itemLabels.some(l => l.toLowerCase().includes(label.toLowerCase()))
    );
    return (commonLabels.length / itemLabels.length) * 100 > 60;
  });
};
```

### Real-time Notifications
Firebase Cloud Messaging integration with service worker:

```typescript
// Service worker for background notifications
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

## Security

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == resource.data.userId;
      allow update: if request.auth != null && 
        (request.auth.uid == resource.data.userId || 
         request.auth.uid == resource.data.claimantId ||
         isAdmin());
    }
  }
}
```

### Storage Rules
```javascript
service firebase.storage {
  match /b/{bucket}/o {
    match /items/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.uid == resource.metadata.uploadedBy;
    }
  }
}
```

## Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Firebase Hosting
```bash
firebase deploy --only hosting
```

### Full Deployment
```bash
firebase deploy
```

## API Endpoints

### Cloud Functions
- `sendClaimOTP` - Send OTP for item claiming
- `verifyClaimOTP` - Verify OTP and update item status
- `analyzeImage` - Analyze image with Google Vision API
- `findMatches` - Find potential matches for items

## Performance Optimizations

1. **Image Optimization**: Images are resized and compressed before upload
2. **Lazy Loading**: Components are loaded on-demand
3. **Firestore Indexes**: Optimized queries with composite indexes
4. **Client-side Caching**: Firebase SDK caching for offline support
5. **Service Worker**: Background sync and push notifications

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, please contact the development team or create an issue in the repository.