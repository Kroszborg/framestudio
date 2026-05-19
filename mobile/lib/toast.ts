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

// Track auto-dismiss timer refs so they can be cleaned up on manual dismiss
const _timerRefs = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (message, type = 'info', duration = 2000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const toast: Toast = { id, message, type, duration };
    set(s => ({ toasts: [...s.toasts.slice(-2), toast] })); // max 3 visible
    // Auto-dismiss
    const timer = setTimeout(() => {
      _timerRefs.delete(id);
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, duration);
    _timerRefs.set(id, timer);
    return id;
  },

  dismiss: (id) => {
    // Clear the auto-dismiss timer on manual dismiss
    const timer = _timerRefs.get(id);
    if (timer) {
      clearTimeout(timer);
      _timerRefs.delete(id);
    }
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },

  clear: () => {
    // Clear all pending timers
    _timerRefs.forEach(timer => clearTimeout(timer));
    _timerRefs.clear();
    set({ toasts: [] });
  },
}));
