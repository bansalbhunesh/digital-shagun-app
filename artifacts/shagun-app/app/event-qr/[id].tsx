import React from "react";
import {
  View, Text, StyleSheet, Pressable, Share, Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import QRCode from "react-native-qrcode-svg";
import Colors from "@/constants/colors";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@/lib/apiClient";
import type { Event } from "@/context/AppContext";

export default function EventQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  
  const { data: eventData, isLoading } = useQuery({
    queryKey: ["eventDetail", id],
    queryFn: () => customFetch<{event: Event}>(`/api/events/${id}`),
    enabled: !!id,
  });
  const event = eventData?.event;
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const shareCode = event?.shareCode ?? "";
  const qrValue = `shagun://join/${shareCode}`;

  const handleShare = async () => {
    if (!event) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Share.share({
      message: `You're invited to ${event.title}! 🎉\n\nJoin and send your blessings:\n→ Code: ${event.shareCode}\n→ Open Shagun app and tap "Join Event"\n\nWith love 🙏`,
      title: `Join ${event.title}`,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Share Event</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle}>{event?.title}</Text>
            <Text style={styles.eventDate}>{event?.date}</Text>
          </View>

          <View style={styles.qrCard}>
            <View style={styles.qrContainer}>
              <QRCode
                value={qrValue}
                size={200}
                color={Colors.primary}
                backgroundColor={Colors.white}
                logo={undefined}
              />
            </View>
            <View style={styles.qrDivider}>
              <View style={styles.qrDividerLine} />
              <Text style={styles.qrDividerText}>or share code</Text>
              <View style={styles.qrDividerLine} />
            </View>
            <View style={styles.codeDisplay}>
              <Text style={styles.codeValue}>{shareCode}</Text>
            </View>
            <Text style={styles.scanHint}>
              Guests scan this QR code or enter the code in the Shagun app to join
            </Text>
          </View>

          <View style={styles.instructions}>
            {[
              { icon: "smartphone", text: "Guest opens Shagun app" },
              { icon: "log-in", text: 'Taps "Join Event"' },
              { icon: "hash", text: "Enters code or scans QR" },
              { icon: "gift", text: "Sends shagun & blessings" },
            ].map((step, i) => (
              <View key={i} style={styles.instructionRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Feather name={step.icon as any} size={16} color={Colors.gold} />
                <Text style={styles.instructionText}>{step.text}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && styles.btnPressed]}
            onPress={handleShare}
          >
            <Feather name="share-2" size={18} color={Colors.cream} />
            <Text style={styles.shareBtnText}>Share via WhatsApp / Message</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 20,
  },
  eventInfo: {
    alignItems: "center",
    gap: 4,
  },
  eventTitle: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  eventDate: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  qrCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 2,
    borderColor: Colors.gold + "40",
  },
  qrContainer: {
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  qrDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  qrDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  qrDividerText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  codeDisplay: {
    backgroundColor: Colors.cream,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  codeValue: {
    fontSize: 36,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
    letterSpacing: 6,
    textAlign: "center",
  },
  scanHint: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
    lineHeight: 18,
  },
  instructions: {
    gap: 12,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    color: Colors.cream,
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
  },
  instructionText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    flex: 1,
  },
  shareBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  shareBtnText: {
    color: Colors.cream,
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
  },
});
