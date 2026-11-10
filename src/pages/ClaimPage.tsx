import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Item } from '../types';
import {
  AlertCircle,
  CheckCircle,
  ClipboardList,
  MapPin,
  Send,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ClaimPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [proofDetails, setProofDetails] = useState('');
  const [existingRequest, setExistingRequest] = useState(false);

  useEffect(() => {
    const loadItem = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const itemSnapshot = await getDoc(doc(db, 'items', id));

        if (!itemSnapshot.exists()) {
          toast.error('Item not found');
          navigate('/search');
          return;
        }

        const data = itemSnapshot.data();
        const asDate = (value: unknown): Date => {
          if (value instanceof Date) return value;
          if (value && typeof value === 'object' && 'toDate' in value &&
              typeof (value as { toDate?: unknown }).toDate === 'function') {
            return (value as { toDate: () => Date }).toDate();
          }
          if (typeof value === 'string' || typeof value === 'number') {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) return date;
          }
          return new Date();
        };

        const loadedItem = {
          id: itemSnapshot.id,
          ...data,
          createdAt: asDate(data.createdAt),
          updatedAt: asDate(data.updatedAt),
          imageLabels: Array.isArray(data.imageLabels) ? data.imageLabels : [],
        } as Item;

        setItem(loadedItem);

        if (user && loadedItem.type === 'found') {
          const requestQuery = query(
            collection(db, 'claimRequests'),
            where('itemId', '==', id),
            where('claimantId', '==', user.uid),
            where('status', '==', 'pending')
          );
          const requestSnapshot = await getDocs(requestQuery);
          setExistingRequest(!requestSnapshot.empty);
        }
      } catch (error) {
        console.error('Error loading claim item:', error);
        toast.error('Could not load item details.');
      } finally {
        setLoading(false);
      }
    };

    void loadItem();
  }, [id, navigate, user]);

  const submitClaimRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      toast.error('Please log in to submit a claim request.');
      navigate('/login');
      return;
    }

    if (!id || !item) return;

    if (item.type !== 'found') {
      toast.error('Only found items can be claimed.');
      return;
    }

    if (item.status === 'claimed') {
      toast.error('This item has already been claimed.');
      return;
    }

    if (item.userId === user.uid) {
      toast.error('You cannot claim an item you reported yourself.');
      return;
    }

    if (existingRequest) {
      toast.error('You already have a pending request for this item.');
      return;
    }

    if (reason.trim().length < 10) {
      toast.error('Please explain why this item belongs to you (at least 10 characters).');
      return;
    }

    setSubmitting(true);

    try {
      // Re-check the current item status before creating the request.
      const latestItemSnapshot = await getDoc(doc(db, 'items', id));
      if (!latestItemSnapshot.exists()) {
        toast.error('This item is no longer available.');
        return;
      }

      const latestItem = latestItemSnapshot.data();
      if (latestItem.status === 'claimed') {
        toast.error('This item has already been claimed.');
        setItem((previous) => previous ? { ...previous, status: 'claimed' } : previous);
        return;
      }

      const duplicateQuery = query(
        collection(db, 'claimRequests'),
        where('itemId', '==', id),
        where('claimantId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);

      if (!duplicateSnapshot.empty) {
        setExistingRequest(true);
        toast.error('You already have a pending request for this item.');
        return;
      }

      await addDoc(collection(db, 'claimRequests'), {
        itemId: id,
        itemTitle: item.title,
        itemOwnerId: item.userId,
        itemOwnerEmail: item.userEmail ?? '',
        claimantId: user.uid,
        claimantEmail: user.email ?? '',
        reason: reason.trim(),
        proofDetails: proofDetails.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setExistingRequest(true);
      toast.success('Claim request submitted. The owner/admin must review it.');
      navigate('/profile');
    } catch (error) {
      console.error('Error submitting claim request:', error);
      toast.error('Could not submit the claim request. Check your Firestore rules and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse bg-white rounded-lg border p-6">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-6" />
          <div className="h-48 bg-gray-200 rounded mb-4" />
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Item Not Found</h2>
        <p className="text-gray-600 mb-4">This item may have been removed.</p>
        <button onClick={() => navigate('/search')} className="px-4 py-2 rounded-lg bg-blue-600 text-white">
          Back to Search
        </button>
      </div>
    );
  }

  if (item.type !== 'found') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">This Item Cannot Be Claimed</h2>
        <p className="text-gray-600">Claim requests are available only for items reported as found.</p>
      </div>
    );
  }

  if (item.status === 'claimed') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Claimed</h2>
        <p className="text-gray-600">This item has already been marked as claimed.</p>
      </div>
    );
  }

  if (user && item.userId === user.uid) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Own Listing</h2>
        <p className="text-gray-600">You cannot submit a claim request for an item you reported.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Request to Claim Item</h1>
        <p className="text-gray-600">
          Explain why the item belongs to you. The item will not be marked as claimed until your request is reviewed and approved.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
        {item.imageUrl && (
          <img src={item.imageUrl} alt={item.title} className="w-full max-h-80 object-cover" />
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">{item.title}</h2>
            <span className="shrink-0 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {item.status}
            </span>
          </div>
          <p className="text-gray-600 mt-2">{item.description}</p>
          <div className="flex items-center text-sm text-gray-500 mt-4">
            <MapPin className="w-4 h-4 mr-2" />
            {item.location}
          </div>
        </div>
      </div>

      {existingRequest ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <ClipboardList className="w-6 h-6 text-yellow-700 shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-900">Request Already Submitted</h3>
              <p className="text-sm text-yellow-800 mt-1">
                Your claim request is pending review. Please wait for the owner/admin to review it.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={submitClaimRequest} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          <div>
            <label htmlFor="claimReason" className="block text-sm font-medium text-gray-700 mb-2">
              Why does this item belong to you? *
            </label>
            <textarea
              id="claimReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={1000}
              required
              rows={4}
              placeholder="Describe identifying details only the owner would know..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">{reason.length}/1000 characters</p>
          </div>

          <div>
            <label htmlFor="proofDetails" className="block text-sm font-medium text-gray-700 mb-2">
              Additional proof details (optional)
            </label>
            <textarea
              id="proofDetails"
              value={proofDetails}
              onChange={(event) => setProofDetails(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="For example: unique marks, contents, serial number (avoid sharing sensitive information)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900">
              Your request will be saved as <strong>Pending</strong>. Do not include passwords, banking details, or other sensitive information.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={submitting || !user}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit Claim Request'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          {!user && (
            <p className="text-sm text-red-600">Please log in before submitting a claim request.</p>
          )}
        </form>
      )}
    </div>
  );
};

export default ClaimPage;
