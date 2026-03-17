import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, ScrollView, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const PRESET_AMOUNTS = [101, 251, 501, 1100];

const BLESSINGS = [
  "Shubh Vivah! May your life be full of joy and love",
  "Bahut Mubarak Ho! Wishing you happiness always",
  "Sat Sri Akal! God bless you with prosperity",
  "May this new beginning bring you great happiness",
  "Dil se badhai! May your blessings multiply",
];

export default function SendShagunScreen() {
  const { eventId, receiverId, receiverName } = useLocalSearchParams<{
    eventId: string; receiverId: string; receiverName: string;
  }>();
  const { sendShagun } = useApp();
  const insets = useSafeAreaInsets();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const finalAmount = selectedAmount ?? (customAmount ? parseInt(customAmount) : null);

  const handleSend = async () => {
    if (!finalAmount || finalAmount < 1) {
      setError("Please select or enter an amount");
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const tx = await sendShagun({
        eventId: eventId!,
        receiverId: receiverId!,
        amount: finalAmount,
        message: message.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(tx.id);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, styles.successBg, { paddingTop: topPadding }]}>
        <View style={styles.successInner}>
          <View style={styles.envelopeContainer}>
            <Text style={styles.envelopeEmoji}>💌</Text>
          </View>
          <Text style={styles.successTitle}>Shagun Sent!</Text>
          <Text style={styles.successSub}>
            Your blessing of{" "}
            <Text style={styles.successAmountText}>₹{finalAmount?.toLocaleString("en-IN")}</Text>
            {" "}has been sent to {receiverName}
          </Text>
          <View style={styles.revealInfo}>
            <Feather name="clock" size={16} color={Colors.goldLight} />
            <Text style={styles.revealText}>
              Amount will be revealed after 10 minutes — a moment of anticipation
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.revealBtn, pressed && styles.btnPressed]}
            onPress={() => router.push({ pathname: "/reveal/[id]", params: { id: sent } })}
          >
            <Feather name="eye" size={18} color={Colors.primary} />
            <Text style={styles.revealBtnText}>Watch Reveal</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
            onPress={() => { router.back(); router.back(); }}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Give Shagun</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.recipientCard}>
          <View style={styles.recipientAvatar}>
            <Text style={styles.recipientAvatarText}>{(receiverName ?? "H").charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.recipientTo}>Sending to</Text>
            <Text style={styles.recipientName}>{receiverName}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Choose Amount</Text>
        <View style={styles.presetGrid}>
          {PRESET_AMOUNTS.map(amt => (
            <Pressable
              key={amt}
              style={({ pressed }) => [
                styles.presetCard,
                selectedAmount === amt && styles.presetCardSelected,
                pressed && styles.cardPressed,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedAmount(amt);
                setCustomAmount("");
              }}
            >
              <Text style={[styles.presetAmt, selectedAmount === amt && styles.presetAmtSelected]}>
                ₹{amt.toLocaleString("en-IN")}
              </Text>
              {amt === 501 && <Text style={styles.presetPopular}>Popular</Text>}
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Custom Amount</Text>
        <View style={styles.customInputWrapper}>
          <Text style={styles.rupeeSymbol}>₹</Text>
          <TextInput
            style={styles.customInput}
            placeholder="Enter amount"
            placeholderTextColor={Colors.textLight}
            value={customAmount}
            onChangeText={t => { setCustomAmount(t.replace(/[^0-9]/g, "")); setSelectedAmount(null); }}
            keyboardType="numeric"
          />
        </View>

        <Text style={styles.sectionLabel}>Add Blessing Message</Text>
        <View style={styles.messageBox}>
          <TextInput
            style={styles.messageInput}
            placeholder="Write a heartfelt message..."
            placeholderTextColor={Colors.textLight}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={3}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.blessingsScroll}>
          {BLESSINGS.map((b, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.blessingChip, pressed && styles.chipPressed]}
              onPress={() => setMessage(b)}
            >
              <Text style={styles.blessingChipText}>{b}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.delayedRevealInfo}>
          <Feather name="clock" size={14} color={Colors.gold} />
          <Text style={styles.delayedRevealText}>
            Receiver sees "A blessing has arrived" — amount revealed after 10 mins
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            (!finalAmount || finalAmount < 1) && styles.sendBtnDisabled,
            pressed && styles.btnPressed,
          ]}
          onPress={handleSend}
          disabled={loading || !finalAmount || finalAmount < 1}
        >
          {loading ? (
            <ActivityIndicator color={Colors.cream} />
          ) : (
            <>
              <Text style={styles.sendBtnEmoji}>🙏</Text>
              <Text style={styles.sendBtnText}>
                Send ₹{finalAmount?.toLocaleString("en-IN") ?? "..."} Shagun
              </Text>
            </>
          )}
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  successBg: {
    backgroundColor: Colors.primary,
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
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  recipientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  recipientAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  recipientAvatarText: {
    color: Colors.cream,
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
  },
  recipientTo: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  recipientName: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },
  presetGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  presetCard: {
    flex: 1,
    minWidth: "22%",
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.borderLight,
    gap: 4,
  },
  presetCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "0A",
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  presetAmt: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  presetAmtSelected: {
    color: Colors.primary,
  },
  presetPopular: {
    fontSize: 9,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.gold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  customInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  rupeeSymbol: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
    marginRight: 6,
  },
  customInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  messageBox: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  messageInput: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: "top",
  },
  blessingsScroll: {
    marginHorizontal: -20,
    paddingLeft: 20,
    marginBottom: 20,
  },
  blessingChip: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 220,
  },
  chipPressed: {
    opacity: 0.8,
  },
  blessingChipText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    marginBottom: 12,
  },
  delayedRevealInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.gold + "22",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  delayedRevealText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.goldDark,
    lineHeight: 20,
  },
  sendBtn: {
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
  sendBtnDisabled: {
    opacity: 0.5,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  sendBtnEmoji: {
    fontSize: 20,
  },
  sendBtnText: {
    color: Colors.cream,
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
  },
  successInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  envelopeContainer: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  envelopeEmoji: {
    fontSize: 56,
  },
  successTitle: {
    fontSize: 32,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
  },
  successSub: {
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 24,
  },
  successAmountText: {
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
  },
  revealInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    padding: 14,
    width: "100%",
  },
  revealText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.goldLight,
    lineHeight: 20,
  },
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.goldLight,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    width: "100%",
    justifyContent: "center",
  },
  revealBtnText: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  doneBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: "rgba(255,255,255,0.7)",
  },
});
