// src/store/authStore.ts — optional Supabase session (guest-first stub). NOT persisted by us.
import { create } from 'zustand';

export interface AuthState {
  userId: string | null;
  email: string | null;
  signedIn: boolean;
  setUser: (u: { userId: string; email: string } | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  signedIn: false,
  setUser: (u) =>
    set(
      u
        ? { userId: u.userId, email: u.email, signedIn: true }
        : { userId: null, email: null, signedIn: false },
    ),
}));
