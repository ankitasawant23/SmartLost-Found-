export interface Item {
  id: string;
  userId: string;
  userEmail: string;
  type: 'found' | 'lost';
  title: string;
  description: string;
  location: string;
  imageUrl?: string;
  imageLabels: string[];
  status: 'unclaimed' | 'claimed' | 'pending';
  createdAt: Date;
  updatedAt: Date;
  claimantId?: string;
  claimantEmail?: string;
  claimedAt?: Date;
  verificationCode?: string;
  matchScore?: number;
  isApproved?: boolean;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  isAdmin?: boolean;
  fcmToken?: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'match' | 'claim' | 'admin';
  itemId?: string;
  read: boolean;
  createdAt: Date;
}

export interface Match {
  id: string;
  foundItemId: string;
  lostItemId: string;
  similarity: number;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: Date;
}