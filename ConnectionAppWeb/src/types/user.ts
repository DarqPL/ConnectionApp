/**
 * User profile - maps to backend UserProfileResponse
 */
export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  gender?: string;
  role: string;
  status: string;
}

/**
 * Friend - maps to backend FriendResponse
 */
export interface Friend {
  id: number;
  friendId: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: string; // PENDING, ACCEPTED, BLOCKED
  createdAt: string;
  updatedAt?: string;
  isRequester: boolean;
}

/**
 * FriendRequest is the same structure as Friend with status = PENDING
 */
export type FriendRequest = Friend;
