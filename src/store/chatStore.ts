import { create } from "zustand";

interface ChatStore {
  unreadCount: number; // Mensajes no leídos en el chat activo
  activeOrdenId: string | null;
  isInboxOpen: boolean;
  activeChatId: string | null; // El chat abierto en el panel lateral secundario
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
  setActiveOrdenId: (id: string | null) => void;
  setInboxOpen: (open: boolean) => void;
  toggleInbox: () => void;
  setActiveChatId: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  unreadCount: 0,
  activeOrdenId: null,
  isInboxOpen: false,
  activeChatId: null,
  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
  setActiveOrdenId: (id) => set({ activeOrdenId: id }),
  setInboxOpen: (open) => set((s) => {
    // Si cerramos la bandeja, también cerramos el chat individual abierto
    const activeChatId = open ? s.activeChatId : null;
    return { isInboxOpen: open, activeChatId };
  }),
  toggleInbox: () => set((s) => {
    const nextOpen = !s.isInboxOpen;
    const activeChatId = nextOpen ? s.activeChatId : null;
    return { isInboxOpen: nextOpen, activeChatId };
  }),
  setActiveChatId: (id) => set({ activeChatId: id }),
}));

