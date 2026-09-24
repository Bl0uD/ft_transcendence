import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatState {
  isChatOpen: boolean;
  activeRoom: number | null;
  unreadCounts: Record<number, number>;
  setIsChatOpen: (isOpen: boolean) => void;
  setActiveRoom: (roomId: number | null) => void;
  incrementUnread: (roomId: number) => void;
  clearUnread: (roomId: number) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      isChatOpen: false,
      activeRoom: null,
      unreadCounts: {},
      setIsChatOpen: (isOpen) => set((state) => {
        // If chat is opened and there's an active room, clear its unread count
        const newUnreadCounts = { ...state.unreadCounts };
        if (isOpen && state.activeRoom !== null) {
          delete newUnreadCounts[state.activeRoom];
        }
        return { isChatOpen: isOpen, unreadCounts: newUnreadCounts };
      }),
      setActiveRoom: (roomId) => set((state) => {
        const newUnreadCounts = { ...state.unreadCounts };
        if (roomId !== null) {
          delete newUnreadCounts[roomId];
        }
        return { activeRoom: roomId, unreadCounts: newUnreadCounts };
      }),
      incrementUnread: (roomId) => set((state) => {
        // Do not increment if the chat is currently open on that specific room
        if (state.activeRoom === roomId && state.isChatOpen) return state;
        return {
          unreadCounts: {
            ...state.unreadCounts,
            [roomId]: (state.unreadCounts[roomId] || 0) + 1
          }
        };
      }),
      clearUnread: (roomId) => set((state) => {
        const newCounts = { ...state.unreadCounts };
        delete newCounts[roomId];
        return { unreadCounts: newCounts };
      })
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({ unreadCounts: state.unreadCounts }),
    }
  )
);