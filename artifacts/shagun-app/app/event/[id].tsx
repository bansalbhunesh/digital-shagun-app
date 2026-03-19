import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Share, Alert, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, Event, Transaction, EventGift, formatINR, useCurrentUser } from "@/context/AppContext";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@/lib/apiClient";

const EVENT_TYPE_EMOJI: Record<string, string> = {
  wedding: "💍",
  baby_ceremony: "👶",
  housewarming: "🏠",
  birthday: "🎂",
  festival: "🪔",
};

function GiftProgressCard({ gift, onContribute }: { gift: EventGift; onContribute: () => void }) {
  const progress = gift.targetAmount > 0 ? gift.currentAmount / gift.targetAmount : 0;
  const progressPct = Math.min(progress * 100, 100);
  const remaining = gift.targetAmount - gift.currentAmount;
  const isAlmostDone = progressPct >= 75 && progressPct < 100;

  return (
    <Pressable
      style={({ pressed }) => [styles.giftCard, pressed && styles.cardPressed]}
      onPress={onContribute}
    >
      <View style={styles.giftTop}>
        <View style={styles.giftEmojiContainer}>
          <Text style={styles.giftEmoji}>{gift.imageEmoji}</Text>
        </View>
        <View style={styles.giftInfo}>
          <Text style={styles.giftName}>{gift.name}</Text>
          <Text style={styles.giftCategory}>{gift.category}</Text>
        </View>
        {isAlmostDone && !gift.isFullyFunded && (
          <View style={styles.almostBadge}>
            <Text style={styles.almostText}>Almost!</Text>
          </View>
        )}
        {gift.isFullyFunded && (
          <View style={styles.fundedBadge}>
            <Feather name="check-circle" size={14} color={Colors.success} />
            <Text style={styles.fundedText}>Funded</Text>
          </View>
        )}
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: gift.isFullyFunded ? Colors.success : Colors.gold }]} />
        </View>
        <Text style={styles.progressText}>
          ₹{formatINR(gift.currentAmount)} / ₹{formatINR(gift.targetAmount)}
        </Text>
      </View>

      {!gift.isFullyFunded && (
        <Pressable
          style={({ pressed }) => [styles.contributeBtn, pressed && styles.btnPressed]}
          onPress={onContribute}
        >
          <Feather name="heart" size={14} color={Colors.white} />
          <Text style={styles.contributeBtnText}>Contribute</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function ShagunItem({ tx }: { tx: Transaction }) {
  const isRevealed = tx.isRevealed;
  return (
    <View style={styles.shagunItem}>
      <View style={styles.shagunAvatar}>
        <Text style={styles.shagunAvatarText}>{tx.senderName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.shagunBody}>
        <Text style={styles.shagunSender}>{tx.senderName}</Text>
        {tx.message ? <Text style={styles.shagunMessage} numberOfLines={1}>{tx.message}</Text> : null}
      </View>
      <View style={styles.shagunRight}>
        {isRevealed ? (
          <Text style={styles.shagunAmount}>₹{formatINR(tx.amount)}</Text>
        ) : (
          <View style={styles.hiddenAmount}>
            <Feather name="eye-off" size={12} color={Colors.textLight} />
            <Text style={styles.hiddenText}>Blessing</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useApp();
  const currentUser = useCurrentUser();
  const insets = useSafeAreaInsets();

  const { data, isLoading: loading, refetch } = useQuery<{ event: Event; shagunList: Transaction[]; gifts: EventGift[] }>({
    queryKey: ["eventDetail", id, currentUser.id],
    queryFn: () => customFetch(`/api/events/${id}`),
    enabled: !!id && !!currentUser.id,
  });

  const event = data?.event ?? null;
  const shagunList = data?.shagunList ?? [];
  const gifts = data?.gifts ?? [];

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(useCallback(() => { if (id) refetch(); }, [id, refetch]));

  const handleShare = async () => {
    if (!event) return;
    await Share.share({
      message: `You're invited to ${event.title}! Join and send your blessings using code: ${event.shareCode}. Download Shagun app to participate.`,
      title: event.title,
    });
  };

  const handleSendShagun = () => {
    if (!event) return;
    router.push({ pathname: "/send-shagun", params: { eventId: event.id, receiverId: event.hostId, receiverName: event.hostName, eventType: event.type } });
  };

  const isHost = event?.hostId === currentUser.id;
  const emoji = EVENT_TYPE_EMOJI[event?.type ?? "wedding"] ?? "🎉";

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.cream} />
        </Pressable>
        <View style={styles.headerRight}>
          {isHost && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/event-qr/[id]", params: { id: event?.id ?? id } });
              }}
              style={styles.shareBtn}
            >
              <Feather name="grid" size={20} color={Colors.cream} />
            </Pressable>
          )}
          <Pressable onPress={handleShare} style={styles.shareBtn}>
            <Feather name="share-2" size={20} color={Colors.cream} />
          </Pressable>
        </View>
      </View>

      <View style={styles.heroSection}>
        <Text style={styles.heroEmoji}>{emoji}</Text>
        <Text style={styles.heroTitle}>{event.title}</Text>
        <View style={styles.heroMeta}>
          <View style={styles.metaChip}>
            <Feather name="calendar" size={13} color={Colors.goldLight} />
            <Text style={styles.metaChipText}>{event.date}</Text>
          </View>
          {event.venue && (
            <View style={styles.metaChip}>
              <Feather name="map-pin" size={13} color={Colors.goldLight} />
              <Text style={styles.metaChipText}>{event.venue}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>₹{formatINR(event.totalReceived)}</Text>
            <Text style={styles.statLabel}>Total Shagun</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{event.guestCount}</Text>
            <Text style={styles.statLabel}>Guests</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{shagunList.length}</Text>
            <Text style={styles.statLabel}>Blessings</Text>
          </View>
        </View>

        {!isHost && (
          <Pressable
            style={({ pressed }) => [styles.sendShagunBtn, pressed && styles.btnPressed]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); handleSendShagun(); }}
          >
            <Text style={styles.sendShagunEmoji}>🙏</Text>
            <Text style={styles.sendShagunText}>Give Shagun</Text>
            <Feather name="arrow-right" size={18} color={Colors.cream} />
          </Pressable>
        )}

        {isHost && (
          <View style={styles.hostActionsWrap}>
            <View style={styles.hostActions}>
              <Pressable
                style={({ pressed }) => [styles.hostActionBtn, pressed && styles.btnPressed]}
                onPress={() => router.push({ pathname: "/gift-registry/[eventId]", params: { eventId: event.id } })}
              >
                <Feather name="gift" size={16} color={Colors.primary} />
                <Text style={styles.hostActionText}>Gift Registry</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.hostActionBtn, pressed && styles.btnPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({ pathname: "/kits/[eventId]", params: { eventId: event.id, eventType: event.type } });
                }}
              >
                <Feather name="box" size={16} color={Colors.primary} />
                <Text style={styles.hostActionText}>Gift Kits</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.hostActionBtnGold, pressed && styles.btnPressed]}
                onPress={handleShare}
              >
                <Feather name="share-2" size={16} color={Colors.cream} />
                <Text style={styles.hostActionTextLight}>Share</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.codeSection}>
          <Text style={styles.codeSectionLabel}>Share Code</Text>
          <View style={styles.codeDisplay}>
            <Text style={styles.codeDisplayText}>{event.shareCode}</Text>
            <Pressable onPress={handleShare}>
              <Feather name="copy" size={16} color={Colors.textLight} />
            </Pressable>
          </View>
        </View>

        {gifts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gift Registry</Text>
            {gifts.map(g => (
              <GiftProgressCard
                key={g.id}
                gift={g}
                onContribute={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({ pathname: "/contribute-gift", params: { 
                    giftId: g.id, 
                    giftName: g.name, 
                    giftEmoji: g.imageEmoji, 
                    remaining: (g.targetAmount - g.currentAmount).toString(),
                    hostId: event.hostId,
                    hostName: event.hostName
                  } });
                }}
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blessing Wall</Text>
          {shagunList.length === 0 ? (
            <View style={styles.emptyBlessings}>
              <Text style={styles.emptyBlessingsText}>Be the first to give a blessing</Text>
            </View>
          ) : (
            shagunList.map(tx => <ShagunItem key={tx.id} tx={tx} />)
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cream,
  },
  errorText: {
    textAlign: "center",
    color: Colors.textSecondary,
    fontFamily: "Poppins_400Regular",
    fontSize: 16,
    marginTop: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  shareBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: "center",
    gap: 8,
  },
  heroEmoji: {
    fontSize: 56,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: Colors.cream,
    textAlign: "center",
  },
  heroMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  metaChipText: {
    color: Colors.goldLight,
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
  },
  scrollContent: {
    flex: 1,
    backgroundColor: Colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  statsRow: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statNum: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
  },
  sendShagunBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  sendShagunEmoji: {
    fontSize: 22,
  },
  sendShagunText: {
    flex: 1,
    color: Colors.cream,
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 0.5,
  },
  hostActionsWrap: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  hostActions: {
    flexDirection: "row",
    gap: 10,
  },
  hostActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  hostActionBtnGold: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.gold,
    borderRadius: 14,
  },
  hostActionText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
  },
  hostActionTextLight: {
    color: Colors.cream,
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
  },
  codeSection: {
    marginHorizontal: 20,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  codeSectionLabel: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.textLight,
  },
  codeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  codeDisplayText: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
    letterSpacing: 3,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
    marginBottom: 14,
  },
  giftCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  giftTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  giftEmojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  giftEmoji: {
    fontSize: 24,
  },
  giftInfo: {
    flex: 1,
  },
  giftName: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  giftCategory: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  almostBadge: {
    backgroundColor: Colors.gold + "33",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  almostText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.goldDark,
  },
  fundedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  fundedText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.success,
  },
  progressContainer: {
    gap: 6,
  },
  progressBg: {
    height: 8,
    backgroundColor: Colors.cream,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textSecondary,
  },
  contributeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 10,
  },
  contributeBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
  },
  shagunItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  shagunAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  shagunAvatarText: {
    color: Colors.cream,
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
  },
  shagunBody: {
    flex: 1,
    gap: 2,
  },
  shagunSender: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  shagunMessage: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    fontStyle: "italic",
  },
  shagunRight: {},
  shagunAmount: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  hiddenAmount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.cream,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  hiddenText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.textLight,
  },
  emptyBlessings: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyBlessingsText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    fontStyle: "italic",
  },
});
