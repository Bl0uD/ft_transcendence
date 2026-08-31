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
  friendsStatus: Record<number, 'ONLINE' | 'OFFLINE'>; 
  
  // Actions de récupération
  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  fetchBlockedUsers: () => Promise<void>;
  fetchAllSocialData: () => Promise<void>;

  // Actions sociales
  sendRequest: (username: string) => Promise<void>;
  acceptRequest: (requestId: number) => Promise<void>;
  removeFriend: (targetUserId: number) => Promise<void>;
  blockUser: (targetUserId: number) => Promise<void>;
  unblockUser: (targetUserId: number) => Promise<void>;
  
  // Temps réel
  updateFriendStatus: (userId: number, status: 'ONLINE' | 'OFFLINE') => void; 
}

export const useSocialStore = create<SocialState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  blockedUsers: [],
  friendsStatus: {}, 

  // --- RÉCUPÉRATION ---
  fetchFriends: async () => {
    try {
      const res = await api.get<User[]>('/friends');
      set({ friends: res.data });
    } catch (err) { console.error('Erreur fetchFriends', err); }
  },

  fetchPendingRequests: async () => {
    try {
      const res = await api.get<FriendRequest[]>('/friends/requests/pending');
      set({ pendingRequests: res.data });
    } catch (err) { console.error('Erreur fetchPendingRequests', err); }
  },

  fetchBlockedUsers: async () => {
    try {
      const res = await api.get<User[]>('/friends/blocked');
      set({ blockedUsers: res.data });
    } catch (err) { console.error('Erreur fetchBlockedUsers', err); }
  },

  fetchAllSocialData: async () => {
    await Promise.all([
      get().fetchFriends(),
      get().fetchPendingRequests(),
      get().fetchBlockedUsers()
    ]);
  },

  // --- ACTIONS ---
  sendRequest: async (username: string) => {
    await api.post('/friends/request', { username });
    // On ne met pas le store à jour manuellement ici, car le WebSocket va 
    // déclencher 'socialUpdate' et tout rafraîchir proprement des deux côtés.
  },

  acceptRequest: async (requestId: number) => {
    await api.put('/friends/accept', { requestId });
    await get().fetchPendingRequests();
    await get().fetchFriends();
  },

  removeFriend: async (targetUserId: number) => {
    await api.delete(`/friends/${targetUserId}`);
    await get().fetchFriends();
  },

  blockUser: async (targetUserId: number) => {
    await api.post('/friends/block', { targetUserId });
    await get().fetchFriends();
    await get().fetchBlockedUsers();
  },

  unblockUser: async (targetUserId: number) => {
    await api.delete(`/friends/block/${targetUserId}`);
    await get().fetchBlockedUsers();
  },

  // --- TEMPS RÉEL (WEBSOCKETS) ---
  updateFriendStatus: (userId, status) => 
    set((state) => ({
      friendsStatus: { ...state.friendsStatus, [userId]: status }
    })),
}));