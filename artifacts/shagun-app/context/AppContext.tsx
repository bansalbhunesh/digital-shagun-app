import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { createUser } from "@workspace/api-client-react";
import { customFetch } from "@/lib/apiClient";
export { formatINR } from "@/lib/format";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  avatarColor: string;
  upiId?: string | null;
  token?: string;
}

export interface Event {
  id: string;
  title: string;
  type: "wedding" | "baby_ceremony" | "housewarming" | "birthday" | "festival";
  hostId: string;
  hostName: string;
  date: string;
  venue?: string;
  description?: string;
  shareCode: string;
  totalReceived: number;
  guestCount: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  eventId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  amount: number;
  message?: string;
  isRevealed: boolean;
  revealAt: string;
  createdAt: string;
}

export interface EventGift {
  id: string;
  eventId: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  imageEmoji: string;
  isFullyFunded: boolean;
}

export interface LedgerEntry {
  contactId: string;
  contactName: string;
  totalGiven: number;
  totalReceived: number;
  balance: number;
  lastEventName?: string;
  lastEventDate?: string;
  suggestedAmount: number;
  transactionCount: number;
}

export interface Kit {
  id: string;
  name: string;
  emoji: string;
  description: string;
  eventTypes: string[];
  color: string;
  totalAmount: number;
  items: Array<{
    name: string;
    category: string;
    imageEmoji: string;
    targetAmount: number;
  }>;
}

export interface AISuggestion {
  suggestedAmount: number;
  alternativeAmount: number;
  reasoning: string;
  suggestedMessages: string[];
  hasHistory: boolean;
  previouslyGiven: number;
  previouslyReceived: number;
  isAuspicious: boolean;
  auspiciousNote: string;
}

/**
 * AppContext provides global authentication state and user profile management.
 * NOTE: Data-fetching hooks (events, ledger, etc.) have been moved to Orval-generated 
 * React Query hooks in `@workspace/api-client-react` for better performance and caching.
 */

const [AppProvider, useApp] = createContextHook(() => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myEvents, setMyEvents] = useState<Event[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const stored = await AsyncStorage.getItem("shagun_user");
        if (stored && session) {
          setUser(JSON.parse(stored));
        } else if (!session) {
          // Local storage had a user but Supabase session is gone
          setUser(null);
          await AsyncStorage.removeItem("shagun_user");
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (name: string, phone: string) => {
    const u = await createUser({ name, phone });
    setUser(u as AppUser);
    await AsyncStorage.setItem("shagun_user", JSON.stringify(u));
    return u as AppUser;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    await AsyncStorage.removeItem("shagun_user");
  }, []);

  const updateProfile = useCallback(async (updates: { name?: string; upiId?: string }) => {
    if (!user) return;
    const updated = await customFetch<AppUser>(`/api/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    const merged: AppUser = { ...user, ...updated };
    setUser(merged);
    await AsyncStorage.setItem("shagun_user", JSON.stringify(merged));
    return merged;
  }, [user]);

  return {
    user, isLoading, login, logout, updateProfile,
  };
});

export { AppProvider, useApp };

export function useCurrentUser() {
  const { user } = useApp();
  if (!user) {
    throw new Error("useCurrentUser must be used within an authenticated context");
  }
  return user;
}
