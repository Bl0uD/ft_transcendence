import { create } from 'zustand';
import api from '../api/axios'; // Ton instance Axios configurée

export interface User {
  id: number;
  username: string;
  avatar?: string | null;
}

export interface FriendRequest {
  id: number;
  status: string;
  createdAt: string;
  requester: User;
}

interface SocialState {
  friends: User[];
  pendingRequests: FriendRequest[];
  blockedUsers: User[];
  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  acceptRequest: (requestId: number) => Promise<void>;
  blockUser: (targetUserId: number) => Promise<void>;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  blockedUsers: [],

  fetchFriends: async () => {
    const res = await api.get<User[]>('/api/friends');
    set({ friends: res.data });
  },

  fetchPendingRequests: async () => {
    const res = await api.get<FriendRequest[]>('/api/friends/requests/pending');
    set({ pendingRequests: res.data });
  },

  acceptRequest: async (requestId: number) => {
    await api.put('/api/friends/accept', { requestId });
    // Rafraîchissement automatique requis par le backend
    await get().fetchPendingRequests();
    await get().fetchFriends();
  },

  blockUser: async (targetUserId: number) => {
    await api.post('/api/friends/block', { targetUserId });
    await get().fetchFriends();
  },
}));