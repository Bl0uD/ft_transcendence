import { create } from 'zustand';

interface ChatState {
  isChatOpen: boolean;
  activeRoom: number | null;
  setIsChatOpen: (isOpen: boolean) => void;
  setActiveRoom: (roomId: number | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isChatOpen: false,
  activeRoom: null,
  setIsChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
  setActiveRoom: (roomId) => set({ activeRoom: roomId }),
}));