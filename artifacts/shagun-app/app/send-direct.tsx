import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, Platform, Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, AISuggestion } from "@/context/AppContext";

const PRESET_AMOUNTS = [101, 251, 501, 1100, 2100, 5100];

function buildRazorpayHTML(orderId: string, keyId: string, amount: number, receiverName: string, isDemoMode: boolean) {
  if (isDemoMode) {
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;background:#FFF8F0;margin:0;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;gap:16px}h2{color:#8B1A1A;font-size:22px;margin:0}.amount{font-size:42px;font-weight:bold;color:#8B1A1A}.btn{background:#8B1A1A;color:white;border:none;border-radius:14px;padding:16px 40px;font-size:17px;cursor:pointer;width:100%;max-width:300px}.btn-skip{background:transparent;color:#888;border:1px solid #ccc;border-radius:14px;padding:14px 40px;font-size:15px;cursor:pointer;width:100%;max-width:300px}.badge{background:#C9A84C22;color:#8B6914;border:1px solid #C9A84C;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:bold}</style></head><body><span class="badge">🔧 DEMO — Set RAZORPAY keys for real payments</span><h2>Payment Summary</h2><div class="amount">₹${amount.toLocaleString("en-IN")}</div><p>Shagun for <strong>${receiverName}</strong></p><p style="font-size:13px;color:#aaa;text-align:center">In demo mode, payment is simulated.<br>Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in environment secrets.</p><button class="btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'demo_success'}))">✓ Simulate Payment</button><button class="btn-skip" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'dismissed'}))">Cancel</button></body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://checkout.razorpay.com/v1/checkout.js"></script><style>body{font-family:sans-serif;background:#FFF8F0;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px}.spinner{border:3px solid #f3f3f3;border-top:3px solid #8B1A1A;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.msg{color:#8B1A1A;font-size:16px}</style></head><body><div class="spinner"></div><div class="msg">Opening payment...</div><script>var o={key:"${keyId}",amount:"${Math.round(amount*100)}",currency:"INR",name:"Shagun",description:"Shagun for ${receiverName}",order_id:"${orderId}",theme:{color:"#8B1A1A"},modal:{ondismiss:function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:"dismissed"}))}},handler:function(r){window.ReactNativeWebView.postMessage(JSON.stringify({type:"success",razorpay_payment_id:r.razorpay_payment_id,razorpay_order_id:r.razorpay_order_id,razorpay_signature:r.razorpay_signature}))}};var rzp=new Razorpay(o);rzp.on("payment.failed",function(r){window.ReactNativeWebView.postMessage(JSON.stringify({type:"failed",error:r.error.description}))});setTimeout(function(){rzp.open()},500);</script></body></html>`;
}

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
  const { sendShagun, getAISuggestion, user, createPaymentOrder, capturePayment, trackEvent, refreshAfterPayment } = useApp();
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
  const [closeness, setCloseness] = useState<"family" | "close" | "friend" | "acquaintance">("friend");
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<{ id: string; keyId: string; isDemoMode: boolean } | null>(null);

  const finalAmount = selectedAmount ?? (customAmount ? parseInt(customAmount) : null);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (!user) return;
    setAiLoading(true);
    setAiSuggestion(null);
    getAISuggestion({
      eventType: occasion,
      receiverId: params.receiverId,
      receiverName: receiverName.trim() || undefined,
      closeness,
    }).then(s => { if (s) setAiSuggestion(s); }).finally(() => setAiLoading(false));
  }, [occasion, closeness]);

  const recordTransaction = async (paymentId?: string) => {
    const amt = finalAmount!;
    const receiverId = params.receiverId ?? ("direct_" + receiverName.trim().toLowerCase().replace(/\s+/g, "_"));
    const tx = await sendShagun({
      eventId: "direct",
      receiverId,
      receiverName: receiverName.trim(),
      amount: amt,
      message: message.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(tx.id);
  };

  const handlePaymentMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "dismissed") {
        setPaymentModal(false); setLoading(false);
        trackEvent("payment_dismissed", { screen: "send_direct" });
        return;
      }
      if (data.type === "failed") {
        setPaymentModal(false);
        setError(data.error ?? "Payment failed. Please try again.");
        setLoading(false);
        trackEvent("payment_failed", { screen: "send_direct", error: data.error });
        return;
      }
      if (data.type === "demo_success") {
        setPaymentModal(false);
        await recordTransaction("demo_" + Date.now());
        trackEvent("payment_success", { screen: "send_direct", isDemoMode: true, amount: finalAmount });
        setLoading(false);
        return;
      }
      if (data.type === "success") {
        try {
          const result = await capturePayment({
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
            receiverName: receiverName.trim(),
            message: message.trim() || undefined,
          });
          setPaymentModal(false);
          if ((result as any)._status === 202) {
            setError("Your payment is being verified — it will appear in your ledger within 2 minutes. You can close this screen.");
            trackEvent("payment_processing", { screen: "send_direct", orderId: data.razorpay_order_id });
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            trackEvent("payment_success", { screen: "send_direct", amount: finalAmount, occasion });
            setSent(result.transactionId);
            refreshAfterPayment();
          }
        } catch {
          setPaymentModal(false);
          setError("Could not verify payment. Please contact support with your payment ID.");
          trackEvent("payment_failed", { screen: "send_direct", stage: "capture" });
        }
        setLoading(false);
      }
    } catch {}
  };

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
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    trackEvent("payment_initiated", { screen: "send_direct", amount: finalAmount, occasion });
    try {
      const receiverId = params.receiverId ?? ("direct_" + receiverName.trim().toLowerCase().replace(/\s+/g, "_"));
      const order = await createPaymentOrder(finalAmount, {
        receiverId,
        eventId: "direct",
        receiverName: receiverName.trim(),
      });
      setPaymentOrder({ id: order.id, keyId: order.keyId, isDemoMode: order.isDemoMode });
      setPaymentModal(true);
    } catch {
      setError("Could not initiate payment. Please try again.");
      setLoading(false);
    }
  };

  const razorpayHTML = paymentOrder ? buildRazorpayHTML(paymentOrder.id, paymentOrder.keyId, finalAmount ?? 0, receiverName, paymentOrder.isDemoMode) : "";

  if (sent) {
    return (
      <View style={[styles.container, styles.successBg, { paddingTop: topPadding }]}>
        <View style={styles.successInner}>
          <View style={styles.envelopeBox}>
            <Text style={styles.envelopeEmoji}>💌</Text>
          </View>
          <Text style={styles.successTitle}>Shagun Sent!</Text>
          <Text style={styles.successSub}>
            ₹{finalAmount?.toLocaleString("en-IN")} sent to{" "}
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

            {/* Closeness selector */}
            <View style={styles.closenessRow}>
              {(["family", "close", "friend", "acquaintance"] as const).map((level) => {
                const labels = { family: "Family", close: "Close Friend", friend: "Friend", acquaintance: "Acquaintance" };
                const icons = { family: "users", close: "heart", friend: "user", acquaintance: "briefcase" };
                const active = closeness === level;
                return (
                  <Pressable
                    key={level}
                    style={[styles.closenessChip, active && styles.closenessChipActive]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCloseness(level); }}
                  >
                    <Feather name={icons[level] as any} size={10} color={active ? Colors.goldDark : Colors.textLight} />
                    <Text style={[styles.closenessLabel, active && styles.closenessLabelActive]}>{labels[level]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {aiLoading ? (
              <View style={styles.aiLoadingRow}>
                <ActivityIndicator size="small" color={Colors.gold} />
                <Text style={styles.aiLoadingText}>Calculating based on your history...</Text>
              </View>
            ) : aiSuggestion ? (
              <>
                <View style={styles.aiAmountRow}>
                  {aiSuggestion.conservativeAmount > 0 && aiSuggestion.conservativeAmount !== aiSuggestion.suggestedAmount && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.aiChip,
                        styles.aiChipCons,
                        selectedAmount === aiSuggestion.conservativeAmount && styles.aiChipActive,
                        pressed && styles.chipPressed,
                      ]}
                      onPress={() => { setSelectedAmount(aiSuggestion.conservativeAmount); setCustomAmount(""); }}
                    >
                      <Text style={styles.aiChipLabel}>Conservative</Text>
                      <Text style={[styles.aiChipAmt, selectedAmount === aiSuggestion.conservativeAmount && styles.aiChipAmtActive]}>
                        ₹{aiSuggestion.conservativeAmount.toLocaleString("en-IN")}
                      </Text>
                    </Pressable>
                  )}
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
                      ₹{aiSuggestion.suggestedAmount.toLocaleString("en-IN")}
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
                      ₹{aiSuggestion.alternativeAmount.toLocaleString("en-IN")}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.aiReasonRow}>
                  <Text style={styles.aiReason}>{aiSuggestion.reasoning}</Text>
                  {aiSuggestion.confidenceLevel && (
                    <View style={[styles.confidenceBadge, aiSuggestion.confidenceLevel === "high" ? styles.badgeHigh : aiSuggestion.confidenceLevel === "medium" ? styles.badgeMedium : styles.badgeLow]}>
                      <Text style={styles.confidenceBadgeText}>{aiSuggestion.confidenceLevel === "high" ? "✓ High" : aiSuggestion.confidenceLevel === "medium" ? "~ Med" : "New"}</Text>
                    </View>
                  )}
                </View>
                {aiSuggestion.signals && aiSuggestion.signals.length > 0 && (
                  <View style={styles.signalsBox}>
                    {aiSuggestion.signals.map((s, i) => (
                      <View key={i} style={styles.signalRow}>
                        <Text style={styles.signalDot}>•</Text>
                        <Text style={styles.signalText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}
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
                ₹{amt.toLocaleString("en-IN")}
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
            {aiSuggestion.suggestedMessages.map((b, i) => (
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
            <Text style={styles.amountPreviewValue}>₹{finalAmount.toLocaleString("en-IN")}</Text>
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
                {finalAmount ? `Send ₹${finalAmount.toLocaleString("en-IN")} Shagun` : "Send Shagun"}
              </Text>
            </>
          )}
        </Pressable>

        <Text style={styles.noticeText}>
          This records your shagun in the Blessings Ledger for future reference.
        </Text>
      </KeyboardAwareScrollView>

      {/* Razorpay Payment Modal */}
      <Modal visible={paymentModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setPaymentModal(false); setLoading(false); }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Secure Payment</Text>
            <Pressable onPress={() => { setPaymentModal(false); setLoading(false); }} style={styles.modalClose}>
              <Feather name="x" size={22} color={Colors.text} />
            </Pressable>
          </View>
          {paymentOrder && (
            <WebView
              source={{ html: razorpayHTML }}
              onMessage={handlePaymentMessage}
              javaScriptEnabled
              domStorageEnabled
              style={{ flex: 1, backgroundColor: Colors.cream }}
            />
          )}
        </View>
      </Modal>
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
  closenessRow: { flexDirection: "row", gap: 5, marginBottom: 10 },
  closenessChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 3, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.cream,
  },
  closenessChipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + "18" },
  closenessLabel: { fontSize: 8, fontFamily: "Poppins_600SemiBold", color: Colors.textLight },
  closenessLabelActive: { color: Colors.goldDark },
  aiAmountRow: { flexDirection: "row", gap: 10 },
  aiChip: {
    flex: 1, borderRadius: 12, padding: 11,
    alignItems: "center", backgroundColor: Colors.cream,
    borderWidth: 2, borderColor: Colors.gold + "30", gap: 3,
  },
  aiChipCons: { borderColor: "#22c55e40" },
  aiChipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + "15" },
  aiChipLabel: { fontSize: 9, fontFamily: "Poppins_600SemiBold", color: Colors.textLight, textTransform: "uppercase", letterSpacing: 0.5 },
  aiChipAmt: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.text },
  aiChipAmtActive: { color: Colors.goldDark },
  aiReasonRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, flexWrap: "wrap" },
  aiReason: { flex: 1, fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.textSecondary, lineHeight: 17 },
  confidenceBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeHigh: { backgroundColor: "#22c55e22" },
  badgeMedium: { backgroundColor: Colors.gold + "22" },
  badgeLow: { backgroundColor: Colors.border },
  confidenceBadgeText: { fontSize: 9, fontFamily: "Poppins_700Bold", color: Colors.textSecondary, letterSpacing: 0.3 },
  signalsBox: { gap: 3, paddingTop: 2 },
  signalRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  signalDot: { fontSize: 10, color: Colors.gold, lineHeight: 17, fontFamily: "Poppins_700Bold" },
  signalText: { flex: 1, fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.textLight, lineHeight: 17 },
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
  modalContainer: { flex: 1, backgroundColor: Colors.cream },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.text },
  modalClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
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
