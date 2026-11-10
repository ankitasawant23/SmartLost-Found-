import React, { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Item } from '../types';
import ItemCard from '../components/ItemCard';
import {
  Shield,
  Filter,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  RefreshCw,
  UserRound,
  Clock,
  Check,
  X,
  Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';

type ClaimRequest = {
  id: string;
  itemId: string;
  itemTitle?: string;
  itemOwnerId: string;
  itemOwnerEmail?: string;
  claimantId: string;
  claimantEmail?: string;
  reason: string;
  proofDetails?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: Date;
};

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value &&
      typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date(0);
};

const AdminPage: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [claimRequests, setClaimRequests] = useState<ClaimRequest[]>([]);
  const [notificationUsers, setNotificationUsers] = useState<
    { id: string; email: string; name: string }[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'approved' | 'claimed'>('all');
  const [requestFilter, setRequestFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [activeTab, setActiveTab] = useState<'items' | 'claims'>('claims');
  const [stats, setStats] = useState({
    totalItems: 0,
    pendingApproval: 0,
    claimedItems: 0,
    pendingClaims: 0,
  });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'items'), orderBy('createdAt', 'desc')));
      const data = snapshot.docs.map((itemDoc) => {
        const raw = itemDoc.data();
        return {
          id: itemDoc.id,
          ...raw,
          createdAt: toDate(raw.createdAt),
          updatedAt: toDate(raw.updatedAt),
          imageLabels: Array.isArray(raw.imageLabels) ? raw.imageLabels : [],
        };
      }) as Item[];

      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Could not load items. Check Firestore permissions and indexes.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClaimRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      // Sort locally to avoid requiring a composite Firestore index.
      const snapshot = await getDocs(collection(db, 'claimRequests'));
      const data = snapshot.docs.map((requestDoc) => {
        const raw = requestDoc.data();
        return {
          id: requestDoc.id,
          ...raw,
          createdAt: toDate(raw.createdAt),
        };
      }) as ClaimRequest[];

      data.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      setClaimRequests(data);
    } catch (error) {
      console.error('Error loading claim requests:', error);
      toast.error('Could not load claim requests. Check Firestore rules.');
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadItems(), loadClaimRequests()]);
  }, [loadItems, loadClaimRequests]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Load regular users so the admin can choose one notification recipient.
  useEffect(() => {
    const loadNotificationUsers = async () => {
      setUsersLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const users = snapshot.docs
          .map((userDoc) => {
            const data = userDoc.data();
            return {
              id: userDoc.id,
              email: typeof data.email === 'string' ? data.email : '',
              name: typeof data.name === 'string' ? data.name : '',
              isAdmin: data.isAdmin === true,
            };
          })
          .filter((user) => !user.isAdmin && (user.email || user.name))
          .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
          .map(({ id, email, name }) => ({ id, email, name }));

        setNotificationUsers(users);
      } catch (error) {
        console.error('Error loading users for notifications:', error);
        toast.error('Could not load users. Check Firestore permissions.');
      } finally {
        setUsersLoading(false);
      }
    };

    void loadNotificationUsers();
  }, []);

  const handleSendNotification = async () => {
    const title = notificationTitle.trim();
    const message = notificationMessage.trim();

    if (!selectedUserId) {
      toast.error('Please select a user.');
      return;
    }
    if (!title || !message) {
      toast.error('Please enter both title and message.');
      return;
    }

    setSendingNotification(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: selectedUserId,
        title,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });

      toast.success('Notification sent successfully.');
      setSelectedUserId('');
      setNotificationTitle('');
      setNotificationMessage('');
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Could not send notification. Check Firestore rules.');
    } finally {
      setSendingNotification(false);
    }
  };

  useEffect(() => {
    let filtered = items;
    if (selectedFilter === 'pending') filtered = items.filter((item) => item.isApproved === false);
    if (selectedFilter === 'approved') filtered = items.filter((item) => item.isApproved === true);
    if (selectedFilter === 'claimed') filtered = items.filter((item) => item.status === 'claimed');
    setFilteredItems(filtered);

    setStats({
      totalItems: items.length,
      pendingApproval: items.filter((item) => item.isApproved === false).length,
      claimedItems: items.filter((item) => item.status === 'claimed').length,
      pendingClaims: claimRequests.filter((request) => request.status === 'pending').length,
    });
  }, [items, selectedFilter, claimRequests]);

  const handleApproveItem = async (itemId: string) => {
    try {
      await updateDoc(doc(db, 'items', itemId), {
        isApproved: true,
        updatedAt: serverTimestamp(),
      });
      setItems((current) => current.map((item) =>
        item.id === itemId ? { ...item, isApproved: true, updatedAt: new Date() } : item
      ));
      toast.success('Item approved.');
    } catch (error) {
      console.error('Error approving item:', error);
      toast.error('Could not approve item.');
    }
  };

  const handleRejectItem = async (itemId: string) => {
    const confirmed = window.confirm('Permanently delete this item listing? This cannot be undone.');
    if (!confirmed) return;

    try {
      await writeBatch(db).delete(doc(db, 'items', itemId)).commit();
      setItems((current) => current.filter((item) => item.id !== itemId));
      toast.success('Item listing deleted.');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Could not delete item.');
    }
  };

  const handleClaimDecision = async (request: ClaimRequest, decision: 'approved' | 'rejected') => {
    setProcessingRequestId(request.id);
    try {
      const requestRef = doc(db, 'claimRequests', request.id);
      const itemRef = doc(db, 'items', request.itemId);

      if (decision === 'approved') {
        // Transaction ensures the item is not already claimed by another request.
        await runTransaction(db, async (transaction) => {
          const requestSnapshot = await transaction.get(requestRef);
          const itemSnapshot = await transaction.get(itemRef);

          if (!requestSnapshot.exists()) throw new Error('This claim request no longer exists.');
          if (!itemSnapshot.exists()) throw new Error('The item listing no longer exists.');

          const currentRequest = requestSnapshot.data();
          const currentItem = itemSnapshot.data();

          if (currentRequest.status !== 'pending') throw new Error('This request has already been reviewed.');
          if (currentItem.status === 'claimed') throw new Error('This item has already been claimed.');
          if (currentItem.type !== 'found') throw new Error('Only found items can be claimed.');

          transaction.update(requestRef, {
            status: 'approved',
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          transaction.update(itemRef, {
            status: 'claimed',
            claimantId: request.claimantId,
            claimantEmail: request.claimantEmail ?? '',
            claimedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      } else {
        await runTransaction(db, async (transaction) => {
          const requestSnapshot = await transaction.get(requestRef);
          if (!requestSnapshot.exists()) throw new Error('This claim request no longer exists.');
          if (requestSnapshot.data().status !== 'pending') throw new Error('This request has already been reviewed.');

          transaction.update(requestRef, {
            status: 'rejected',
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      }

      toast.success(decision === 'approved' ? 'Claim approved; item marked claimed.' : 'Claim request rejected.');
      await refreshAll();
    } catch (error) {
      console.error('Error reviewing claim request:', error);
      toast.error(error instanceof Error ? error.message : 'Could not review claim request.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const statCards = [
    { title: 'Total Items', value: stats.totalItems, icon: TrendingUp, color: 'text-blue-600 bg-blue-100' },
    { title: 'Pending Approval', value: stats.pendingApproval, icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-100' },
    { title: 'Claimed Items', value: stats.claimedItems, icon: CheckCircle, color: 'text-green-600 bg-green-100' },
    { title: 'Pending Claims', value: stats.pendingClaims, icon: ClipboardList, color: 'text-purple-600 bg-purple-100' },
  ];

  const filterOptions = [
    { value: 'all', label: 'All Items' },
    { value: 'pending', label: 'Pending Approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'claimed', label: 'Claimed' },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center mb-2">
            <Shield className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <p className="text-gray-600">Manage item listings and review claim requests.</p>
        </div>
        <button
          onClick={() => void refreshAll()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6 mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-full bg-blue-100 text-blue-700">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Send Notification</h2>
            <p className="text-sm text-gray-500">Send an in-app notification to one selected user.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="notificationUser" className="block text-sm font-medium text-gray-700 mb-1">
              Select User
            </label>
            <select
              id="notificationUser"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              disabled={usersLoading || notificationUsers.length === 0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-white disabled:bg-gray-100"
            >
              <option value="">
                {usersLoading
                  ? 'Loading users...'
                  : notificationUsers.length === 0
                    ? 'No regular users found'
                    : 'Choose a user'}
              </option>
              {notificationUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ? `${user.name} (${user.email || user.id})` : (user.email || user.id)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notificationTitle" className="block text-sm font-medium text-gray-700 mb-1">
              Notification Title
            </label>
            <input
              id="notificationTitle"
              type="text"
              maxLength={100}
              value={notificationTitle}
              onChange={(event) => setNotificationTitle(event.target.value)}
              placeholder="e.g. Important Update"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notificationMessage" className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              id="notificationMessage"
              rows={4}
              maxLength={1000}
              value={notificationMessage}
              onChange={(event) => setNotificationMessage(event.target.value)}
              placeholder="Write your notification message..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 resize-y"
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {notificationMessage.length}/1000
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={() => void handleSendNotification()}
            disabled={sendingNotification || usersLoading || notificationUsers.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Bell className="w-4 h-4" />
            {sendingNotification ? 'Sending...' : 'Send Notification'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.title} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${stat.color}`}><stat.icon className="w-6 h-6" /></div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('claims')}
          className={`px-4 py-3 font-medium border-b-2 ${activeTab === 'claims' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Claim Requests ({stats.pendingClaims})
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-3 font-medium border-b-2 ${activeTab === 'items' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Manage Items
        </button>
      </div>

      {activeTab === 'claims' && (
        <section>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <ClipboardList className="w-5 h-5 text-gray-500" />
            <label htmlFor="claimFilter" className="text-sm font-medium text-gray-700">Request status:</label>
            <select
              id="claimFilter"
              value={requestFilter}
              onChange={(event) => setRequestFilter(event.target.value as typeof requestFilter)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All requests</option>
            </select>
          </div>

          {requestsLoading ? (
            <div className="py-12 text-center text-gray-500">Loading claim requests...</div>
          ) : claimRequests.filter((request) => requestFilter === 'all' || request.status === requestFilter).length === 0 ? (
            <div className="py-12 text-center bg-white border border-gray-200 rounded-lg">
              <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900">No claim requests</h3>
              <p className="text-sm text-gray-600 mt-1">There are no requests with this status.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {claimRequests
                .filter((request) => requestFilter === 'all' || request.status === requestFilter)
                .map((request) => (
                  <article key={request.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{request.itemTitle || 'Found item'}</h3>
                        <p className="text-sm text-gray-500 mt-1">Request ID: {request.id}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {request.status}
                      </span>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-2">
                        <UserRound className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                        <div><span className="text-gray-500">Claimant:</span> <span className="font-medium">{request.claimantEmail || request.claimantId}</span></div>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Reason</p>
                        <p className="text-gray-800 whitespace-pre-wrap break-words">{request.reason}</p>
                      </div>
                      {request.proofDetails && (
                        <div>
                          <p className="text-gray-500 mb-1">Additional proof details</p>
                          <p className="text-gray-800 whitespace-pre-wrap break-words">{request.proofDetails}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="w-4 h-4" />
                        {request.createdAt && request.createdAt.getTime() > 0
                          ? request.createdAt.toLocaleString()
                          : 'Submission time unavailable'}
                      </div>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-4 border-t border-gray-100">
                        <button
                          disabled={processingRequestId === request.id}
                          onClick={() => void handleClaimDecision(request, 'approved')}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          {processingRequestId === request.id ? 'Processing...' : 'Approve Claim'}
                        </button>
                        <button
                          disabled={processingRequestId === request.id}
                          onClick={() => void handleClaimDecision(request, 'rejected')}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" /> Reject Claim
                        </button>
                      </div>
                    )}
                  </article>
                ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'items' && (
        <section>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter items:</span>
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedFilter(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilter === option.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
              <p className="text-gray-600">No items match the selected filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isAdmin
                  onApprove={handleApproveItem}
                  onReject={handleRejectItem}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AdminPage;
