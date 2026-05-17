/**
 * Toast / Snackbar system for FrameStudio
 * Used for undo/redo indicators, batch actions, etc.
 */

import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'undo';
  duration?: number; // ms, default 2000
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, type?: Toast['type'], duration?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (message, type = 'info', duration = 2000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const toast: Toast = { id, message, type, duration };
    set(s => ({ toasts: [...s.toasts.slice(-2), toast] })); // max 3 visible
    // Auto-dismiss
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, duration);
    return id;
  },

  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}));
