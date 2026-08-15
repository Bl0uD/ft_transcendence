import { create } from 'zustand';
import api from '../api/axios';

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
  friendsStatus: Record<number, 'ONLINE' | 'OFFLINE'>; // <-- AJOUT (Présence)
  
  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  acceptRequest: (requestId: number) => Promise<void>;
  blockUser: (targetUserId: number) => Promise<void>;
  updateFriendStatus: (userId: number, status: 'ONLINE' | 'OFFLINE') => void; // <-- AJOUT
}

export const useSocialStore = create<SocialState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  blockedUsers: [],
  friendsStatus: {}, // <-- INITIALISATION

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
    await get().fetchPendingRequests();
    await get().fetchFriends();
  },

  blockUser: async (targetUserId: number) => {
    await api.post('/api/friends/block', { targetUserId });
    await get().fetchFriends();
  },

  // <-- AJOUT : Met à jour uniquement l'état de l'utilisateur ciblé
  updateFriendStatus: (userId, status) => 
    set((state) => ({
      friendsStatus: { ...state.friendsStatus, [userId]: status }
    })),
}));