import { create } from 'zustand';
import api from '../api/axios';
import { Socket } from 'socket.io-client';

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
  
  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  fetchBlockedUsers: () => Promise<void>;
  fetchAllSocialData: () => Promise<void>;

  sendRequest: (username: string) => Promise<void>;
  acceptRequest: (requestId: number) => Promise<void>;
  removeFriend: (targetUserId: number) => Promise<void>;
  blockUser: (targetUserId: number) => Promise<void>;
  unblockUser: (targetUserId: number) => Promise<void>;
  
  updateFriendStatus: (userId: number, status: 'ONLINE' | 'OFFLINE') => void; 
  initSocketListeners: (socket: Socket | null) => void;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  blockedUsers: [],
  friendsStatus: {}, 

  fetchFriends: async () => {
    try {
      const res = await api.get<User[]>('/friends');
      const friends = res.data;
      set({ friends });
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

  sendRequest: async (username: string) => {
    await api.post('/friends/request', { username });
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

  updateFriendStatus: (userId, status) => 
    set((state) => ({
      friendsStatus: { ...state.friendsStatus, [userId]: status }
    })),

  // 🟢 Écoute des événements WebSocket et redemande automatique à la reconnexion
  initSocketListeners: (socket) => {
    if (!socket) return;

    // Nettoyage des anciens écouteurs pour éviter les doublons
    socket.off('friends_status_response');
    socket.off('friend_status_update');
    socket.off('connect');
    // 🟢 NOUVEAU : Nettoyage des écouteurs sociaux
    socket.off('socialUpdate');
    socket.off('friend_request_received');
    socket.off('friend_request_accepted');

    const requestStatuses = () => {
      const friendIds = get().friends.map(f => f.id);
      if (friendIds.length > 0) {
        socket.emit('get_friends_status', friendIds);
      }
    };

    // Si la socket se connecte ou se reconnecte (très utile pour Opera / Chrome)
    socket.on('connect', requestStatuses);
    if (socket.connected) {
      requestStatuses();
    }

    socket.on('friends_status_response', (statuses: Record<number, 'ONLINE' | 'OFFLINE'>) => {
      set((state) => ({
        friendsStatus: { ...state.friendsStatus, ...statuses }
      }));
    });

    socket.on('friend_status_update', ({ userId, status }: { userId: number; status: 'ONLINE' | 'OFFLINE' }) => {
      get().updateFriendStatus(userId, status);
    });

    // 🟢 NOUVEAU : Les événements sociaux globaux rafraîchissent automatiquement la donnée
    const refreshSocial = () => {
      get().fetchAllSocialData();
    };
    
    socket.on('socialUpdate', refreshSocial);
    socket.on('friend_request_received', refreshSocial);
    socket.on('friend_request_accepted', refreshSocial);
  }
}));