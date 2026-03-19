import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, Animated,
  Easing, ActivityIndicator, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { customFetch } from "@/lib/apiClient";

interface RevealStatus {
  id: string;
  isRevealed: boolean;
  amount: number;
  senderName: string;
  message?: string;
  secondsRemaining: number;
}

export default function RevealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useApp();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<RevealStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    loadRevealStatus();
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const loadRevealStatus = async () => {
    if (!id) return;
    try {
      const data = await customFetch<RevealStatus>(`/api/shagun/reveal/${id}`);
      setStatus(data);
      if (!data.isRevealed) {
        startCountdown(data.secondsRemaining);
      }
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = (initialSeconds: number) => {
    let secs = initialSeconds;
    countdownRef.current = setInterval(async () => {
      secs -= 1;
      if (secs <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        const data = await customFetch<RevealStatus>(`/api/shagun/reveal/${id}`);
        setStatus(data);
      } else {
        setStatus(prev => prev ? { ...prev, secondsRemaining: secs } : prev);
      }
    }, 1000);
  };

  const handleOpenEnvelope = () => {
    if (!status?.isRevealed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true, easing: Easing.linear }),
    ]).start(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        setOpened(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      });
    });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <ActivityIndicator size="large" color={Colors.goldLight} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <Pressable onPress={() => router.back()} style={styles.closeBtn}>
        <Feather name="x" size={22} color={Colors.goldLight} />
      </Pressable>

      <View style={styles.content}>
        {!status?.isRevealed ? (
          <>
            <View style={styles.waitingContainer}>
              <Text style={styles.waitingEmoji}>⏳</Text>
              <Text style={styles.waitingTitle}>Your Blessing is on its way</Text>
              <Text style={styles.waitingText}>Someone sent you a blessing. The amount will be revealed in...</Text>
              <View style={styles.countdownBox}>
                <Text style={styles.countdownNumber}>{formatTime(status?.secondsRemaining ?? 0)}</Text>
                <Text style={styles.countdownLabel}>minutes remaining</Text>
              </View>
              <Text style={styles.guessText}>
                "Someone sent you Shagun with love 🙏"
              </Text>
            </View>
          </>
        ) : !opened ? (
          <View style={styles.envelopeContainer}>
            <Animated.View
              style={[
                styles.envelopeWrapper,
                { transform: [{ translateX: shakeAnim }, { scale: scaleAnim }] },
              ]}
            >
              <Pressable
                style={styles.envelope}
                onPress={handleOpenEnvelope}
              >
                <Text style={styles.envelopeLargeEmoji}>💌</Text>
              </Pressable>
            </Animated.View>
            <Text style={styles.tapToOpen}>Tap to open your shagun</Text>
            <Text style={styles.fromText}>from {status.senderName}</Text>
          </View>
        ) : (
          <Animated.View style={[styles.revealedContainer, { opacity: opacityAnim }]}>
            <View style={styles.goldCircle}>
              <Text style={styles.goldCircleEmoji}>🪙</Text>
            </View>
            <Text style={styles.revealedFrom}>{status.senderName} sent you</Text>
            <Text style={styles.revealedAmount}>₹{status.amount.toLocaleString("en-IN")}</Text>
            {status.message && (
              <View style={styles.messageCard}>
                <Text style={styles.messageQuote}>"</Text>
                <Text style={styles.messageText}>{status.message}</Text>
                <Text style={styles.messageQuote}>"</Text>
              </View>
            )}
            <Text style={styles.revealedBlessing}>🙏 Shagun received with blessings</Text>
            <Pressable
              style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
              onPress={() => router.back()}
            >
              <Text style={styles.doneBtnText}>With Gratitude</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  waitingContainer: {
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  waitingEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  waitingTitle: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
    textAlign: "center",
  },
  waitingText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 22,
  },
  countdownBox: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 40,
    paddingVertical: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  countdownNumber: {
    fontSize: 48,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
    letterSpacing: 4,
  },
  countdownLabel: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  guessText: {
    fontSize: 15,
    fontFamily: "Poppins_500Medium",
    color: Colors.goldLight,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 8,
  },
  envelopeContainer: {
    alignItems: "center",
    gap: 16,
  },
  envelopeWrapper: {},
  envelope: {
    width: 160,
    height: 160,
    borderRadius: 40,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 14,
  },
  envelopeLargeEmoji: {
    fontSize: 72,
  },
  tapToOpen: {
    fontSize: 18,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.goldLight,
  },
  fromText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  revealedContainer: {
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  goldCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 14,
    marginBottom: 8,
  },
  goldCircleEmoji: {
    fontSize: 64,
  },
  revealedFrom: {
    fontSize: 16,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.75)",
  },
  revealedAmount: {
    fontSize: 52,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
    letterSpacing: 2,
  },
  messageCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    width: "100%",
    gap: 4,
  },
  messageQuote: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: Colors.gold,
    lineHeight: 28,
  },
  messageText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.goldLight,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 22,
  },
  revealedBlessing: {
    fontSize: 16,
    fontFamily: "Poppins_500Medium",
    color: Colors.goldLight,
  },
  doneBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
});
