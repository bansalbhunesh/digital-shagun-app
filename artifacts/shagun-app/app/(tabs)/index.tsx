import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useQuery } from "@tanstack/react-query";
// @ts-expect-error - Subpath not exposed in package.json exports but works in metro
import { customFetch } from "@workspace/api-client-react/src/custom-fetch";

interface UserStats {
  totalGiven: number;
  totalReceived: number;
  balance: number;
  relationshipCount: number;
  shagunSentCount: number;
  shagunReceivedCount: number;
  eventsHosted: number;
  topGiver: { name: string; amount: number } | null;
  topReceiver: { name: string; amount: number } | null;
}

const EVENT_TYPE_INFO: Record<string, { icon: string; label: string; color: string }> = {
  wedding: { icon: "heart", label: "Shaadi", color: "#8B1A1A" },
  baby_ceremony: { icon: "star", label: "Namkaran", color: "#704214" },
  housewarming: { icon: "home", label: "Griha Pravesh", color: "#4A5C2A" },
  birthday: { icon: "gift", label: "Birthday", color: "#4A3080" },
  festival: { icon: "sun", label: "Festival", color: "#8B5014" },
};

export default function HomeScreen() {
  const { user } = useApp();
  const insets = useSafeAreaInsets();

  const { data: stats, refetch } = useQuery<UserStats>({
    queryKey: ["userStats", user?.id],
    queryFn: () => customFetch(`/api/users/${user?.id}/stats`),
    enabled: !!user?.id,
  });

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const mainActions = [
    {
      icon: "send" as const,
      label: "Give Shagun",
      sub: "Send to anyone",
      color: Colors.primary,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/send-direct"); },
    },
    {
      icon: "calendar" as const,
      label: "Join Event",
      sub: "Scan or enter code",
      color: Colors.gold,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/join-event"); },
    },
    {
      icon: "plus-circle" as const,
      label: "Create Event",
      sub: "Host a celebration",
      color: Colors.primaryDark,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/create-event"); },
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Namaste 🙏</Text>
            <Text style={styles.userName}>{user?.name ?? "Guest"}</Text>
          </View>
          <Pressable
            style={styles.avatarContainer}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <View style={[styles.avatar, { backgroundColor: user?.avatarColor ?? Colors.primary }]}>
              <Text style={styles.avatarText}>
                {(user?.name ?? "G").charAt(0).toUpperCase()}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroPattern} />
          <Text style={styles.heroQuote}>
            "शुभ अवसर पर दिया गया आशीर्वाद{'\n'}सदा फलता है"
          </Text>
          <Text style={styles.heroQuoteEn}>Blessings given on auspicious occasions always bear fruit</Text>
        </View>

        {(stats && (stats.totalGiven > 0 || stats.totalReceived > 0 || stats.relationshipCount > 0)) ? (
          <Pressable
            style={styles.statsCard}
            onPress={() => router.push("/(tabs)/ledger")}
          >
            <View style={styles.statsCardHeader}>
              <Text style={styles.statsCardTitle}>Your Shagun Summary</Text>
              <Feather name="chevron-right" size={16} color={Colors.goldLight} />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>₹{stats.totalGiven.toLocaleString("en-IN")}</Text>
                <Text style={styles.statLabel}>Given</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, styles.statReceived]}>₹{stats.totalReceived.toLocaleString("en-IN")}</Text>
                <Text style={styles.statLabel}>Received</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.shagunSentCount}</Text>
                <Text style={styles.statLabel}>Sent</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.relationshipCount}</Text>
                <Text style={styles.statLabel}>Families</Text>
              </View>
            </View>
            {stats.topGiver && (
              <View style={styles.statsHighlight}>
                <Feather name="award" size={12} color={Colors.gold} />
                <Text style={styles.statsHighlightText} numberOfLines={1}>
                  {stats.topGiver.name} gave you most — ₹{stats.topGiver.amount.toLocaleString("en-IN")}
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}

        <View style={styles.actionsGrid}>
          {mainActions.map((action, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.actionCard,
                i === 0 && styles.actionCardFull,
                pressed && styles.actionCardPressed,
              ]}
              onPress={action.onPress}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                <Feather name={action.icon} size={22} color={Colors.cream} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Text style={styles.actionSub}>{action.sub}</Text>
              {i === 0 && (
                <View style={styles.actionArrow}>
                  <Feather name="arrow-right" size={16} color={Colors.textLight} />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Celebration Types</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
            {Object.entries(EVENT_TYPE_INFO).map(([type, info]) => (
              <Pressable
                key={type}
                style={({ pressed }) => [styles.typeCard, pressed && styles.typeCardPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/create-event");
                }}
              >
                <View style={[styles.typeIcon, { backgroundColor: info.color }]}>
                  <Feather name={info.icon as any} size={20} color={Colors.cream} />
                </View>
                <Text style={styles.typeLabel}>{info.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.kitsPromo}>
          <View style={styles.kitsPromoLeft}>
            <View style={styles.kitsPromoIcon}>
              <Text style={styles.kitsPromoEmoji}>🎁</Text>
            </View>
            <View style={styles.kitsPromoBody}>
              <Text style={styles.kitsPromoTitle}>Gift Kits — New!</Text>
              <Text style={styles.kitsPromoText}>Curated bundles for life's big moments. Home Setup, Baby, Wedding & more.</Text>
            </View>
          </View>
          <View style={styles.kitsPromoBadge}>
            <Text style={styles.kitsPromoBadgeText}>5 Kits</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How it works</Text>
          {[
            { step: "1", text: "Create your celebration event", icon: "calendar" },
            { step: "2", text: "Share QR code with guests", icon: "share-2" },
            { step: "3", text: "Receive digital shagun & gifts", icon: "gift" },
            { step: "4", text: "Track blessings over years", icon: "heart" },
          ].map((item, i) => (
            <View key={i} style={styles.howRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>{item.step}</Text>
              </View>
              <Feather name={item.icon as any} size={16} color={Colors.gold} style={styles.howIcon} />
              <Text style={styles.howText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  avatarContainer: {},
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  avatarText: {
    color: Colors.white,
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  heroPattern: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.goldLight,
    opacity: 0.12,
  },
  heroQuote: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.goldLight,
    lineHeight: 24,
    marginBottom: 8,
  },
  heroQuoteEn: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.6)",
    fontStyle: "italic",
  },
  statsCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  statsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsCardTitle: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.goldLight,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  statValue: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
  },
  statReceived: {
    color: "#90EE90",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  statsHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statsHighlightText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.goldLight,
    flex: 1,
    fontStyle: "italic",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    width: "47%",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  actionCardFull: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 20,
  },
  actionCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  actionArrow: {
    marginLeft: "auto",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
    marginBottom: 14,
  },
  typeScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  typeCard: {
    alignItems: "center",
    marginRight: 16,
  },
  typeCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  typeLabel: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  kitsPromo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
  },
  kitsPromoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  kitsPromoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  kitsPromoEmoji: {
    fontSize: 22,
  },
  kitsPromoBody: {
    flex: 1,
  },
  kitsPromoTitle: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
  },
  kitsPromoText: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 16,
    marginTop: 2,
  },
  kitsPromoBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  kitsPromoBadgeText: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  howRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    color: Colors.cream,
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
  },
  howIcon: {
    width: 20,
  },
  howText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    flex: 1,
  },
});
