import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, Platform, ScrollView, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { AISuggestion, formatINR, useCurrentUser } from "@/context/AppContext";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useSendShagun } from "@workspace/api-client-react";
import PaymentService from "@/services/PaymentService";

const PRESET_AMOUNTS = [101, 251, 501, 1100, 2100, 5100];

const OCCASIONS = [
  { key: "wedding", label: "Shaadi", emoji: "💍" },
  { key: "birthday", label: "Birthday", emoji: "🎂" },
  { key: "baby_ceremony", label: "Namkaran", emoji: "👶" },
  { key: "housewarming", label: "Griha Pravesh", emoji: "🏠" },
  { key: "festival", label: "Festival", emoji: "🪔" },
  { key: "other", label: "Just Like That", emoji: "🙏" },
];

export default function SendDirectScreen() {
  const params = useLocalSearchParams<{
    receiverName?: string; receiverId?: string; occasion?: string;
  }>();
  const currentUser = useCurrentUser();
  const { mutateAsync: sendShagunMutation } = useSendShagun();
  const insets = useSafeAreaInsets();

  const [receiverName, setReceiverName] = useState(params.receiverName ?? "");
  const [occasion, setOccasion] = useState(params.occasion ?? "other");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const finalAmount = selectedAmount ?? (customAmount ? parseInt(customAmount, 10) : null);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (!currentUser) return;
    setAiLoading(true);
    (async () => {
      try {
        const query = new URLSearchParams({
          eventType: occasion,
          senderId: currentUser.id,
          ...(params.receiverId ? { receiverId: params.receiverId } : {}),
        });
        const s: any = await customFetch(`/api/ai/suggest?${query}`);
        if (s) setAiSuggestion(s as AISuggestion);
      } catch (e) {
        console.error("Failed to fetch AI suggestion", e);
      } finally {
        setAiLoading(false);
      }
    })();
  }, [occasion, currentUser, params.receiverId]);

  const handleSend = async () => {
    if (!receiverName.trim()) {
      setError("Please enter the recipient's name");
      return;
    }
    if (!finalAmount || finalAmount < 1) {
      setError("Please select or enter an amount");
      return;
    }
    setError("");
    if (!params.receiverId && !receiverName) {
      Alert.alert("Error", "Missing receiver information.");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const receiverId = params.receiverId ?? ("direct_" + receiverName.trim().toLowerCase().replace(/\s+/g, "_"));
      
      // Try to fetch receiver's UPI ID if we have a real receiverId
      let receiverUpiId: string | null = null;
      if (params.receiverId) {
        try {
          const receiverData: any = await customFetch(`/api/users/${params.receiverId}`);
          receiverUpiId = receiverData?.upiId ?? null;
        } catch { /* receiver may not exist in DB */ }
      }

      const paid = await PaymentService.processPayment({
        amount: finalAmount,
        receiverUpiId,
        receiverName: receiverName.trim(),
      });
      if (!paid) {
        setLoading(false);
        return;
      }

      const tx = await sendShagunMutation({
        data: {
          eventId: "direct",
          senderId: currentUser.id,
          senderName: currentUser.name,
          receiverId,
          amount: finalAmount,
          message: message.trim() || undefined,
        }
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(tx.id);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Something went wrong. Please try again.";
      setError(msg);
      Alert.alert("Transaction Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, styles.successBg, { paddingTop: topPadding }]}>
        <View style={styles.successInner}>
          <View style={styles.envelopeBox}>
            <Text style={styles.envelopeEmoji}>💌</Text>
          </View>
          <Text style={styles.successTitle}>Shagun Sent!</Text>
          <Text style={styles.successSub}>
            ₹{formatINR(finalAmount ?? 0)} sent to{" "}
            <Text style={{ fontFamily: "Poppins_700Bold", color: Colors.goldLight }}>{receiverName}</Text>
          </Text>
          <Text style={styles.successBlessing}>
            May your blessing bring joy and prosperity 🙏
          </Text>
          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ledgerBtn, pressed && { opacity: 0.7 }]}
            onPress={() => { router.back(); router.push("/(tabs)/ledger"); }}
          >
            <Feather name="book-open" size={16} color={Colors.goldLight} />
            <Text style={styles.ledgerBtnText}>View in Blessings Ledger</Text>
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
        <Text style={styles.headerTitle}>Send Shagun</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 40 }]}
      >
        {/* Recipient */}
        <Text style={styles.sectionLabel}>Who are you gifting?</Text>
        <View style={styles.recipientInput}>
          <Feather name="user" size={18} color={Colors.textLight} />
          <TextInput
            style={styles.recipientField}
            placeholder="Enter name (e.g. Priya Aunty)"
            placeholderTextColor={Colors.textLight}
            value={receiverName}
            onChangeText={setReceiverName}
            autoCapitalize="words"
            editable={!params.receiverName}
          />
          {receiverName.length > 1 && (
            <Feather name="check-circle" size={18} color="#22c55e" />
          )}
        </View>

        {/* Occasion */}
        <Text style={styles.sectionLabel}>Occasion</Text>
        <View style={styles.occasionGrid}>
          {OCCASIONS.map(o => (
            <Pressable
              key={o.key}
              style={({ pressed }) => [
                styles.occasionChip,
                occasion === o.key && styles.occasionChipActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setOccasion(o.key);
              }}
            >
              <Text style={styles.occasionEmoji}>{o.emoji}</Text>
              <Text style={[styles.occasionLabel, occasion === o.key && styles.occasionLabelActive]}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* AI Suggestion */}
        {(aiLoading || aiSuggestion) && (
          <View style={styles.aiPanel}>
            <View style={styles.aiHeader}>
              <View style={styles.aiIcon}>
                <Feather name="zap" size={13} color={Colors.gold} />
              </View>
              <Text style={styles.aiTitle}>Smart Suggestion</Text>
            </View>
            {aiLoading ? (
              <View style={styles.aiLoadingRow}>
                <ActivityIndicator size="small" color={Colors.gold} />
                <Text style={styles.aiLoadingText}>Calculating based on your history...</Text>
              </View>
            ) : aiSuggestion ? (
              <>
                <View style={styles.aiAmountRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.aiChip,
                      selectedAmount === aiSuggestion.suggestedAmount && styles.aiChipActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => { setSelectedAmount(aiSuggestion.suggestedAmount); setCustomAmount(""); }}
                  >
                    <Text style={styles.aiChipLabel}>Recommended</Text>
                    <Text style={[styles.aiChipAmt, selectedAmount === aiSuggestion.suggestedAmount && styles.aiChipAmtActive]}>
                      ₹{formatINR(aiSuggestion.suggestedAmount)}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.aiChip,
                      selectedAmount === aiSuggestion.alternativeAmount && styles.aiChipActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => { setSelectedAmount(aiSuggestion.alternativeAmount); setCustomAmount(""); }}
                  >
                    <Text style={styles.aiChipLabel}>Alternative</Text>
                    <Text style={[styles.aiChipAmt, selectedAmount === aiSuggestion.alternativeAmount && styles.aiChipAmtActive]}>
                      ₹{formatINR(aiSuggestion.alternativeAmount)}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.aiReason}>{aiSuggestion.reasoning}</Text>
              </>
            ) : null}
          </View>
        )}

        {/* Preset amounts */}
        <Text style={styles.sectionLabel}>Choose Amount</Text>
        <View style={styles.presetGrid}>
          {PRESET_AMOUNTS.map(amt => (
            <Pressable
              key={amt}
              style={({ pressed }) => [
                styles.presetCard,
                selectedAmount === amt && styles.presetCardActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedAmount(amt);
                setCustomAmount("");
              }}
            >
              <Text style={[styles.presetAmt, selectedAmount === amt && styles.presetAmtActive]}>
                ₹{formatINR(amt)}
              </Text>
              {amt === 501 && <Text style={styles.popularBadge}>Popular</Text>}
            </Pressable>
          ))}
        </View>

        {/* Custom amount */}
        <Text style={styles.sectionLabel}>Or Enter Custom</Text>
        <View style={styles.customInput}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            style={styles.customField}
            placeholder="Any amount"
            placeholderTextColor={Colors.textLight}
            value={customAmount}
            onChangeText={t => { setCustomAmount(t.replace(/[^0-9]/g, "")); setSelectedAmount(null); }}
            keyboardType="numeric"
          />
        </View>

        {/* Message */}
        <Text style={styles.sectionLabel}>Add a Blessing</Text>
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

        {/* Quick blessings */}
        {aiSuggestion?.suggestedMessages?.length ? (
          <KeyboardAwareScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.blessingsScroll}
            bottomOffset={0}
          >
            {aiSuggestion.suggestedMessages.map((b: string, i: number) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.blessingChip, pressed && styles.chipPressed]}
                onPress={() => setMessage(b)}
              >
                <Text style={styles.blessingChipText}>{b}</Text>
              </Pressable>
            ))}
          </KeyboardAwareScrollView>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Amount display */}
        {finalAmount && finalAmount > 0 ? (
          <View style={styles.amountPreview}>
            <Text style={styles.amountPreviewLabel}>Sending</Text>
            <Text style={styles.amountPreviewValue}>₹{formatINR(finalAmount)}</Text>
            <Text style={styles.amountPreviewTo}>to {receiverName || "..."}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            (!finalAmount || finalAmount < 1 || !receiverName.trim()) && styles.sendBtnDisabled,
            pressed && styles.chipPressed,
          ]}
          onPress={handleSend}
          disabled={loading || !finalAmount || finalAmount < 1 || !receiverName.trim()}
        >
          {loading ? (
            <ActivityIndicator color={Colors.cream} />
          ) : (
            <>
              <Text style={styles.sendBtnEmoji}>🙏</Text>
              <Text style={styles.sendBtnText}>
                {finalAmount ? `Send ₹${finalAmount} Shagun` : "Send Shagun"}
              </Text>
            </>
          )}
        </Pressable>

        <Text style={styles.noticeText}>
          This records your shagun in the Blessings Ledger for future reference.
        </Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  successBg: { backgroundColor: Colors.primary },
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.text },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel: {
    fontSize: 12, fontFamily: "Poppins_700Bold",
    color: Colors.textSecondary, textTransform: "uppercase",
    letterSpacing: 0.8, marginBottom: 10, marginTop: 4,
  },
  recipientInput: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, height: 54, marginBottom: 20,
  },
  recipientField: {
    flex: 1, fontSize: 16,
    fontFamily: "Poppins_500Medium", color: Colors.text,
  },
  occasionGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20,
  },
  occasionChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: Colors.white, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  occasionChipActive: {
    borderColor: Colors.primary, backgroundColor: Colors.primary + "0D",
  },
  occasionEmoji: { fontSize: 16 },
  occasionLabel: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.textSecondary },
  occasionLabelActive: { color: Colors.primary, fontFamily: "Poppins_600SemiBold" },
  chipPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  aiPanel: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 14, marginBottom: 20,
    borderWidth: 1.5, borderColor: Colors.gold + "50", gap: 10,
  },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiIcon: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: Colors.gold + "22",
    alignItems: "center", justifyContent: "center",
  },
  aiTitle: { fontSize: 13, fontFamily: "Poppins_700Bold", color: Colors.goldDark },
  aiLoadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiLoadingText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.textLight, fontStyle: "italic" },
  aiAmountRow: { flexDirection: "row", gap: 10 },
  aiChip: {
    flex: 1, borderRadius: 12, padding: 11,
    alignItems: "center", backgroundColor: Colors.cream,
    borderWidth: 2, borderColor: Colors.gold + "30", gap: 3,
  },
  aiChipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + "15" },
  aiChipLabel: { fontSize: 9, fontFamily: "Poppins_600SemiBold", color: Colors.textLight, textTransform: "uppercase", letterSpacing: 0.5 },
  aiChipAmt: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.text },
  aiChipAmtActive: { color: Colors.goldDark },
  aiReason: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.textSecondary, lineHeight: 17 },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  presetCard: {
    width: "30%", flexGrow: 1,
    backgroundColor: Colors.white, borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
    borderWidth: 2, borderColor: Colors.borderLight, gap: 3,
  },
  presetCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  presetAmt: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.text },
  presetAmtActive: { color: Colors.primary },
  popularBadge: {
    fontSize: 9, fontFamily: "Poppins_600SemiBold",
    color: Colors.gold, textTransform: "uppercase", letterSpacing: 0.5,
  },
  customInput: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, marginBottom: 20, height: 54,
  },
  rupee: { fontSize: 20, fontFamily: "Poppins_700Bold", color: Colors.primary, marginRight: 8 },
  customField: { flex: 1, fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.text },
  messageBox: {
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    padding: 14, marginBottom: 12,
  },
  messageInput: {
    fontSize: 14, fontFamily: "Poppins_400Regular",
    color: Colors.text, minHeight: 80, textAlignVertical: "top",
  },
  blessingsScroll: { marginHorizontal: -20, paddingLeft: 20, marginBottom: 20 },
  blessingChip: {
    backgroundColor: Colors.white, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    marginRight: 10, borderWidth: 1, borderColor: Colors.border, maxWidth: 220,
  },
  blessingChipText: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.textSecondary },
  errorText: { color: Colors.error, fontSize: 13, fontFamily: "Poppins_400Regular", marginBottom: 12 },
  amountPreview: {
    alignItems: "center", gap: 2,
    backgroundColor: Colors.primary + "0A",
    borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.primary + "20",
  },
  amountPreviewLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.textLight, textTransform: "uppercase", letterSpacing: 0.5 },
  amountPreviewValue: { fontSize: 28, fontFamily: "Poppins_700Bold", color: Colors.primary },
  amountPreviewTo: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.textSecondary },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: 18,
    paddingVertical: 18, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    marginBottom: 12,
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnEmoji: { fontSize: 20 },
  sendBtnText: { color: Colors.cream, fontSize: 17, fontFamily: "Poppins_700Bold" },
  noticeText: {
    fontSize: 11, fontFamily: "Poppins_400Regular",
    color: Colors.textLight, textAlign: "center", lineHeight: 17,
  },
  successInner: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 14,
  },
  envelopeBox: {
    width: 110, height: 110, borderRadius: 32,
    backgroundColor: Colors.gold,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 12, marginBottom: 8,
  },
  envelopeEmoji: { fontSize: 52 },
  successTitle: { fontSize: 30, fontFamily: "Poppins_700Bold", color: Colors.goldLight },
  successSub: {
    fontSize: 15, fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 24,
  },
  successBlessing: {
    fontSize: 13, fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.6)", textAlign: "center", fontStyle: "italic",
  },
  doneBtn: {
    backgroundColor: Colors.goldLight, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 48,
    marginTop: 8, width: "100%", alignItems: "center",
  },
  doneBtnText: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.primary },
  ledgerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10,
  },
  ledgerBtnText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.goldLight },
});
