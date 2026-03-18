import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  avatarColor: string;
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
  conservativeAmount: number;
  reasoning: string;
  suggestedMessages: string[];
  hasHistory: boolean;
  previouslyGiven: number;
  previouslyReceived: number;
  isAuspicious: boolean;
  auspiciousNote: string;
  confidenceLevel: "high" | "medium" | "low";
  signals: string[];
  aiVersion?: string;
  fromCache?: boolean;
}

let _token = "";
function setApiToken(token: string) { _token = token; }

async function apiFetch(path: string, options?: RequestInit, onUnauth?: () => void) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(_token ? { "Authorization": `Bearer ${_token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 401 && onUnauth) {
    onUnauth();
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const [AppProvider, useApp] = createContextHook(() => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myEvents, setMyEvents] = useState<Event[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("shagun_user");
        const storedToken = await AsyncStorage.getItem("shagun_token");
        if (stored) {
          const u = JSON.parse(stored) as AppUser;
          setUser(u);
          if (storedToken) setApiToken(storedToken);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const requestOTP = useCallback(async (phone: string): Promise<{ devCode?: string }> => {
    return apiFetch("/otp/send", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  }, []);

  const verifyOTP = useCallback(async (phone: string, code: string, name: string): Promise<AppUser> => {
    const u = await apiFetch("/otp/verify", { method: "POST", body: JSON.stringify({ phone, code, name }) });
    const { token, ...userFields } = u;
    setUser(userFields);
    if (token) { setApiToken(token); await AsyncStorage.setItem("shagun_token", token); }
    await AsyncStorage.setItem("shagun_user", JSON.stringify(userFields));
    return userFields as AppUser;
  }, []);

  const login = useCallback(async (name: string, phone: string) => {
    const u = await apiFetch("/users", { method: "POST", body: JSON.stringify({ name, phone }) });
    const { token, ...userFields } = u;
    setUser(userFields);
    if (token) { setApiToken(token); await AsyncStorage.setItem("shagun_token", token); }
    await AsyncStorage.setItem("shagun_user", JSON.stringify(userFields));
    return userFields as AppUser;
  }, []);

  const createPaymentOrder = useCallback(async (amount: number, opts: {
    receiverId: string; eventId?: string; receiverName?: string;
  }) => {
    return apiFetch("/payments/create-order", {
      method: "POST",
      body: JSON.stringify({ amount, receiverId: opts.receiverId, eventId: opts.eventId ?? "direct", receiverName: opts.receiverName ?? "" }),
    }) as Promise<{ id: string; amount: number; currency: string; keyId: string; isDemoMode: boolean }>;
  }, []);

  const capturePayment = useCallback(async (params: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature?: string;
    senderName?: string;
    receiverName?: string;
    message?: string;
  }) => {
    if (!user) throw new Error("Not logged in");
    return apiFetch("/payments/capture", {
      method: "POST",
      body: JSON.stringify({ ...params, senderName: params.senderName ?? user.name }),
    }) as Promise<{ transactionId: string; amount: number; eventId: string; receiverId: string }>;
  }, [user]);

  const logout = useCallback(async () => {
    setUser(null);
    setApiToken("");
    await AsyncStorage.multiRemove(["shagun_user", "shagun_token"]);
  }, []);

  const fetchMyEvents = useCallback(async (userId: string) => {
    const events = await apiFetch(`/events?hostId=${userId}`);
    setMyEvents(events);
    return events as Event[];
  }, []);

  const createEvent = useCallback(async (data: {
    title: string; type: string; date: string; venue?: string; description?: string;
  }) => {
    if (!user) throw new Error("Not logged in");
    const event = await apiFetch("/events", {
      method: "POST",
      body: JSON.stringify({ ...data, hostId: user.id, hostName: user.name }),
    });
    setMyEvents(prev => [event, ...prev]);
    return event as Event;
  }, [user]);

  const getEvent = useCallback(async (eventIdOrCode: string) => {
    return apiFetch(`/events/${eventIdOrCode}`) as Promise<{ event: Event; shagunList: Transaction[]; gifts: EventGift[] }>;
  }, []);

  const joinEvent = useCallback(async (eventId: string) => {
    if (!user) throw new Error("Not logged in");
    return apiFetch(`/events/${eventId}/join`, {
      method: "POST",
      body: JSON.stringify({ userId: user.id }),
    }) as Promise<Event>;
  }, [user]);

  const sendShagun = useCallback(async (data: {
    eventId: string; receiverId: string; receiverName?: string; amount: number; message?: string;
  }) => {
    if (!user) throw new Error("Not logged in");
    return apiFetch("/shagun", {
      method: "POST",
      body: JSON.stringify({ ...data, senderId: user.id, senderName: user.name }),
    }) as Promise<Transaction>;
  }, [user]);

  const revealShagun = useCallback(async (transactionId: string) => {
    return apiFetch(`/shagun/reveal/${transactionId}`);
  }, []);

  const getEventShagun = useCallback(async (eventId: string, page = 1, limit = 20) => {
    const res = await apiFetch(`/shagun/${eventId}?page=${page}&limit=${limit}`);
    return (res.data ?? res) as Transaction[];
  }, []);

  const getEventGifts = useCallback(async (eventId: string) => {
    return apiFetch(`/gifts/${eventId}`) as Promise<EventGift[]>;
  }, []);

  const addGiftToRegistry = useCallback(async (eventId: string, gift: {
    name: string; category: string; targetAmount: number; imageEmoji: string;
  }) => {
    return apiFetch(`/gifts/${eventId}`, {
      method: "POST",
      body: JSON.stringify(gift),
    }) as Promise<EventGift>;
  }, []);

  const contributeToGift = useCallback(async (data: {
    giftId: string; amount: number;
  }) => {
    if (!user) throw new Error("Not logged in");
    return apiFetch("/gifts/contribute", {
      method: "POST",
      body: JSON.stringify({ ...data, contributorId: user.id, contributorName: user.name }),
    });
  }, [user]);

  const getKits = useCallback(async (eventType?: string) => {
    const query = eventType ? `?eventType=${eventType}` : "";
    return apiFetch(`/kits${query}`) as Promise<Kit[]>;
  }, []);

  const addKitToEvent = useCallback(async (eventId: string, kitId: string) => {
    return apiFetch(`/kits/${eventId}`, {
      method: "POST",
      body: JSON.stringify({ kitId }),
    });
  }, []);

  const getAISuggestion = useCallback(async (params: {
    eventType: string;
    receiverId?: string;
    receiverName?: string;
    eventId?: string;
  }) => {
    if (!user) return null;
    const query = new URLSearchParams({
      eventType: params.eventType,
      senderName: user.name,
      ...(params.receiverId ? { receiverId: params.receiverId } : {}),
      ...(params.receiverName ? { receiverName: params.receiverName } : {}),
      ...(params.eventId ? { eventId: params.eventId } : {}),
    });
    return apiFetch(`/ai/suggest?${query}`) as Promise<AISuggestion>;
  }, [user]);

  const getLedger = useCallback(async (page = 1, limit = 50) => {
    if (!user) return [];
    const res = await apiFetch(`/ledger/${user.id}?page=${page}&limit=${limit}`);
    return (res.data ?? res) as LedgerEntry[];
  }, [user]);

  const getLedgerDetail = useCallback(async (contactId: string) => {
    if (!user) throw new Error("Not logged in");
    return apiFetch(`/ledger/${user.id}/${contactId}`);
  }, [user]);

  const getUserStats = useCallback(async () => {
    if (!user) return null;
    return apiFetch(`/users/${user.id}/stats`);
  }, [user]);

  const trackEvent = useCallback(async (
    event: string,
    properties?: Record<string, unknown>,
  ) => {
    try {
      await apiFetch("/analytics/event", {
        method: "POST",
        body: JSON.stringify({ event, properties, userId: user?.id }),
      });
    } catch {}
  }, [user]);

  const registerPushToken = useCallback(async (token: string, platform?: string) => {
    if (!user || !token) return;
    try {
      await apiFetch("/push/register", {
        method: "POST",
        body: JSON.stringify({ token, platform }),
      });
    } catch {}
  }, [user]);

  const removePushToken = useCallback(async (token: string) => {
    if (!user || !token) return;
    try {
      await apiFetch("/push/register", {
        method: "DELETE",
        body: JSON.stringify({ token }),
      });
    } catch {}
  }, [user]);

  return {
    user, isLoading, myEvents,
    requestOTP, verifyOTP, login, logout,
    fetchMyEvents, createEvent, getEvent, joinEvent,
    sendShagun, revealShagun, getEventShagun,
    getEventGifts, addGiftToRegistry, contributeToGift,
    getKits, addKitToEvent,
    getAISuggestion,
    getLedger, getLedgerDetail,
    getUserStats,
    createPaymentOrder, capturePayment,
    trackEvent, registerPushToken, removePushToken,
  };
});

export { AppProvider, useApp };
