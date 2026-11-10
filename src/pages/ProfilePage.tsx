import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Item } from '../types';
import ItemCard from '../components/ItemCard';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Package,
  CheckCircle,
  Clock,
  Settings,
  Bell,
  Shield,
  Edit2,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  const [userItems, setUserItems] = useState<Item[]>([]);
  const [claimedItems, setClaimedItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] =
    useState<'submitted' | 'claimed' | 'settings'>('submitted');

  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || '');
      setProfilePhone(user.phoneNumber || '');

      void loadUserData();
      void loadProfileData();
    } else {
      setUserItems([]);
      setClaimedItems([]);
      setProfileName('');
      setProfilePhone('');
      setLoading(false);
    }
  }, [user]);

  const timestampToDate = (value: unknown): Date | undefined => {
    if (!value) return undefined;

    const candidate = value as { toDate?: () => Date };

    if (typeof candidate.toDate === 'function') {
      return candidate.toDate();
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }

    return undefined;
  };

  const loadProfileData = async () => {
    if (!user) return;

    try {
      const profileSnapshot = await getDoc(
        doc(db, 'users', user.uid)
      );

      if (profileSnapshot.exists()) {
        const profileData = profileSnapshot.data();

        setProfileName(
          typeof profileData.name === 'string'
            ? profileData.name
            : user.displayName || ''
        );

        setProfilePhone(
          typeof profileData.phone === 'string'
            ? profileData.phone
            : user.phoneNumber || ''
        );
      }
    } catch (error) {
      console.error('Error loading profile information:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      toast.error('Please log in to update your profile.');
      return;
    }

    const name = profileName.trim();
    const phone = profilePhone.trim();

    if (!name) {
      toast.error('Please enter your name.');
      return;
    }

    if (name.length > 100) {
      toast.error('Name must be 100 characters or fewer.');
      return;
    }

    if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    setSavingProfile(true);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        phone,
        updatedAt: serverTimestamp(),
      });

      setProfileName(name);
      setProfilePhone(phone);
      setEditingProfile(false);

      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);

      toast.error(
        'Could not update profile. Check your connection and Firestore Rules.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const loadUserData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const userItemsQuery = query(
        collection(db, 'items'),
        where('userId', '==', user.uid)
      );

      const userItemsSnapshot = await getDocs(userItemsQuery);

      const userItemsData = userItemsSnapshot.docs.map((itemDoc) => {
        const data = itemDoc.data();

        return {
          id: itemDoc.id,
          ...data,
          createdAt:
            timestampToDate(data.createdAt) ?? new Date(0),
          updatedAt:
            timestampToDate(data.updatedAt) ?? new Date(0),
        };
      }) as Item[];

      userItemsData.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      const claimedItemsQuery = query(
        collection(db, 'items'),
        where('claimantId', '==', user.uid)
      );

      const claimedItemsSnapshot = await getDocs(claimedItemsQuery);

      const claimedItemsData = claimedItemsSnapshot.docs.map(
        (itemDoc) => {
          const data = itemDoc.data();

          return {
            id: itemDoc.id,
            ...data,
            createdAt:
              timestampToDate(data.createdAt) ?? new Date(0),
            updatedAt:
              timestampToDate(data.updatedAt) ?? new Date(0),
            claimedAt: timestampToDate(data.claimedAt),
          };
        }
      ) as Item[];

      claimedItemsData.sort(
        (a, b) =>
          (b.claimedAt?.getTime() ?? 0) -
          (a.claimedAt?.getTime() ?? 0)
      );

      setUserItems(userItemsData);
      setClaimedItems(claimedItemsData);
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Could not load profile data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsReturned = async (itemId: string) => {
    try {
      await updateDoc(doc(db, 'items', itemId), {
        status: 'returned',
        returnedAt: new Date(),
        updatedAt: new Date(),
      });

      setUserItems((previousItems) =>
        previousItems.map((item) =>
          item.id === itemId
            ? { ...item, status: 'returned' as any }
            : item
        )
      );

      toast.success('Item marked as returned');
    } catch (error) {
      console.error('Error marking item as returned:', error);
      toast.error('Error updating item status');
    }
  };

  const stats = {
    totalSubmitted: userItems.length,
    foundItems: userItems.filter(
      (item) => item.type === 'found'
    ).length,
    lostItems: userItems.filter(
      (item) => item.type === 'lost'
    ).length,
    claimedItems: claimedItems.length,
    unclaimedItems: userItems.filter(
      (item) => item.status === 'unclaimed'
    ).length,
    successfulReturns: userItems.filter(
      (item) => item.status === 'claimed'
    ).length,
  };

  const tabs = [
    { id: 'submitted', label: 'My Submissions', icon: Package },
    { id: 'claimed', label: 'Claimed Items', icon: CheckCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-lg shadow-sm"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>

          <div className="ml-4">
            <h1 className="text-3xl font-bold text-gray-900">
              {profileName || 'User Profile'}
            </h1>
            <p className="text-gray-600">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Package className="w-5 h-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Total Submissions</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.totalSubmitted}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Items Claimed</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.claimedItems}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-orange-600 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Unclaimed</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.unclaimedItems}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-purple-600 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.totalSubmitted > 0
                  ? Math.round(
                      (stats.successfulReturns / stats.totalSubmitted) * 100
                    )
                  : 0}
                %
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
```tsx
      {/* My Submissions */}
      {activeTab === 'submitted' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              My Submissions
            </h2>
            <div className="text-sm text-gray-500">
              {userItems.length}{' '}
              {userItems.length === 1 ? 'item' : 'items'}
            </div>
          </div>

          {userItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No items submitted
              </h3>
              <p className="text-gray-600">
                You haven't submitted any items yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userItems.map((item) => (
                <div key={item.id} className="relative">
                  <ItemCard item={item} />

                  {item.status === 'claimed' && item.type === 'found' && (
                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={() => handleMarkAsReturned(item.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium hover:bg-green-700 transition-colors"
                      >
                        Mark as Returned
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Claimed Items */}
      {activeTab === 'claimed' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Claimed Items
            </h2>
            <div className="text-sm text-gray-500">
              {claimedItems.length}{' '}
              {claimedItems.length === 1 ? 'item' : 'items'}
            </div>
          </div>

          {claimedItems.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No items claimed
              </h3>
              <p className="text-gray-600">
                You haven't claimed any items yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {claimedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  <ItemCard item={item} />

                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Claimed on:</span>
                      <span className="font-medium text-gray-900">
                        {item.claimedAt
                          ? format(item.claimedAt, 'MMM d, yyyy')
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      {activeTab === 'settings' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Settings
          </h2>

          <div className="space-y-6">
            {/* Profile Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Profile Information
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setEditingProfile((current) => !current)
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Edit2 className="w-4 h-4" />
                  {editingProfile ? 'Cancel Editing' : 'Edit Profile'}
                </button>
              </div>

              {editingProfile && (
                <form
                  className="mb-6 space-y-4 rounded-lg bg-gray-50 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSaveProfile();
                  }}
                >
                  <div>
                    <label
                      htmlFor="profileName"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Full Name
                    </label>

                    <input
                      id="profileName"
                      type="text"
                      value={profileName}
                      onChange={(event) =>
                        setProfileName(event.target.value)
                      }
                      maxLength={100}
                      required
                      autoComplete="name"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profilePhone"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Phone Number
                    </label>

                    <input
                      id="profilePhone"
                      type="tel"
                      value={profilePhone}
                      onChange={(event) =>
                        setProfilePhone(event.target.value)
                      }
                      maxLength={20}
                      autoComplete="tel"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Enter your phone number"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>

                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => {
                        void loadProfileData();
                        setEditingProfile(false);
                      }}
                      className="rounded-lg border border-gray-300 px-5 py-2 font-medium text-gray-700 hover:bg-white disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                <div className="flex items-center">
                  <User className="mr-3 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Full Name
                    </p>
                    <p className="text-sm text-gray-600">
                      {profileName || 'Not set'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Mail className="mr-3 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Email
                    </p>
                    <p className="text-sm text-gray-600">
                      {user?.email || 'Not set'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Email changes require a separate Firebase verification flow.
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Phone className="mr-3 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Phone
                    </p>
                    <p className="text-sm text-gray-600">
                      {profilePhone || 'Not set'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Calendar className="mr-3 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Member Since
                    </p>
                    <p className="text-sm text-gray-600">
                      {user?.metadata?.creationTime
                        ? format(
                            new Date(user.metadata.creationTime),
                            'MMM d, yyyy'
                          )
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Notification Preferences
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Bell className="w-5 h-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Push Notifications
                      </p>
                      <p className="text-sm text-gray-600">
                        Get notified about item matches
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setNotifications((previous) => !previous)
                    }
                    aria-pressed={notifications}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      notifications ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Email Notifications
                      </p>
                      <p className="text-sm text-gray-600">
                        Get email updates about your items
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setEmailNotifications((previous) => !previous)
                    }
                    aria-pressed={emailNotifications}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      emailNotifications ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        emailNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Privacy &amp; Security
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Public Profile
                    </p>
                    <p className="text-sm text-gray-600">
                      Allow others to see your profile
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                    onClick={() =>
                      toast('Public Profile settings are not implemented yet.')
                    }
                  >
                    Configure
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Data Export
                    </p>
                    <p className="text-sm text-gray-600">
                      Download your data
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                    onClick={() =>
                      toast('Data export is not implemented yet.')
                    }
                  >
                    Request
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Delete Account
                    </p>
                    <p className="text-sm text-gray-600">
                      Permanently delete your account
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-red-600 hover:text-red-500 text-sm font-medium"
                    onClick={() =>
                      toast.error(
                        'Account deletion is not implemented yet.'
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;