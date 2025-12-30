import { create } from 'zustand';
import { User, authApi } from '@/lib/api';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    setToken: (token: string | null) => void;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    initialize: () => void;
    refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isLoading: true,

    setUser: (user) => set({ user }),

    setToken: (token) => set({ token }),

    initialize: () => {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (savedToken && savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                set({ token: savedToken, user: parsedUser, isLoading: false });
            } catch {
                // Invalid JSON in localStorage
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                set({ isLoading: false });
            }
        } else {
            set({ isLoading: false });
        }
    },

    login: async (email: string, password: string) => {
        const response = await authApi.login(email, password);

        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.error || 'Login failed');
        }

        const { token: newToken, user: newUser } = response.data.data;

        // Save to localStorage
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));

        // Update state
        set({ token: newToken, user: newUser });
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ token: null, user: null });
    },

    refreshUser: async () => {
        try {
            const response = await authApi.me();
            if (response.data.success && response.data.data) {
                const updatedUser = response.data.data;
                // Update localStorage
                localStorage.setItem('user', JSON.stringify(updatedUser));
                // Update state
                set({ user: updatedUser });
            }
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    },
}));
