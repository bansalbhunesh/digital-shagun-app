import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, Platform, Modal,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, AISuggestion } from "@/context/AppContext";

const PRESET_AMOUNTS = [101, 251, 501, 1100];

function buildRazorpayHTML(orderId: string, keyId: string, amount: number, receiverName: string, isDemoMode: boolean) {
  if (isDemoMode) {
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;background:#FFF8F0;margin:0;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;gap:16px}h2{color:#8B1A1A;font-size:22px;margin:0}.amount{font-size:42px;font-weight:bold;color:#8B1A1A}.btn{background:#8B1A1A;color:white;border:none;border-radius:14px;padding:16px 40px;font-size:17px;cursor:pointer;width:100%;max-width:300px}.btn-skip{background:transparent;color:#888;border:1px solid #ccc;border-radius:14px;padding:14px 40px;font-size:15px;cursor:pointer;width:100%;max-width:300px}.badge{background:#C9A84C22;color:#8B6914;border:1px solid #C9A84C;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:bold}</style></head><body><span class="badge">🔧 DEMO — Set RAZORPAY keys for real payments</span><h2>Payment Summary</h2><div class="amount">₹${amount.toLocaleString("en-IN")}</div><p>Shagun for <strong>${receiverName}</strong></p><p style="font-size:13px;color:#aaa;text-align:center">In demo mode, payment is simulated.<br>Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in environment secrets.</p><button class="btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'demo_success'}))">✓ Simulate Payment</button><button class="btn-skip" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'dismissed'}))">Cancel</button></body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://checkout.razorpay.com/v1/checkout.js"></script><style>body{font-family:sans-serif;background:#FFF8F0;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px}.spinner{border:3px solid #f3f3f3;border-top:3px solid #8B1A1A;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.msg{color:#8B1A1A;font-size:16px}</style></head><body><div class="spinner"></div><div class="msg">Opening payment...</div><script>var o={key:"${keyId}",amount:"${Math.round(amount*100)}",currency:"INR",name:"Shagun",description:"Shagun for ${receiverName}",order_id:"${orderId}",theme:{color:"#8B1A1A"},modal:{ondismiss:function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:"dismissed"}))}},handler:function(r){window.ReactNativeWebView.postMessage(JSON.stringify({type:"success",razorpay_payment_id:r.razorpay_payment_id,razorpay_order_id:r.razorpay_order_id,razorpay_signature:r.razorpay_signature}))}};var rzp=new Razorpay(o);rzp.on("payment.failed",function(r){window.ReactNativeWebView.postMessage(JSON.stringify({type:"failed",error:r.error.description}))});setTimeout(function(){rzp.open()},500);</script></body></html>`;
}

export default function SendShagunScreen() {
  const { eventId, receiverId, receiverName, eventType } = useLocalSearchParams<{
    eventId: string; receiverId: string; receiverName: string; eventType?: string;
  }>();
  const { sendShagun, getAISuggestion, createPaymentOrder, capturePayment, trackEvent } = useApp();
  const insets = useSafeAreaInsets();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [closeness, setCloseness] = useState<"family" | "close" | "friend" | "acquaintance">("friend");
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<{ id: string; keyId: string; isDemoMode: boolean } | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const finalAmount = selectedAmount ?? (customAmount ? parseInt(customAmount) : null);

  useEffect(() => {
    setAiLoading(true);
    setAiSuggestion(null);
    (async () => {
      try {
        const suggestion = await getAISuggestion({
          eventType: eventType ?? "wedding",
          receiverId: receiverId ?? undefined,
          receiverName: receiverName ?? undefined,
          eventId: eventId ?? undefined,
          closeness,
        });
        setAiSuggestion(suggestion);
        if (suggestion) {
          trackEvent("ai_suggestion_fetched", {
            eventType: eventType ?? "wedding",
            closeness,
            hasHistory: suggestion.hasHistory,
            confidence: suggestion.confidenceLevel,
            suggestedAmount: suggestion.suggestedAmount,
            aiVersion: suggestion.aiVersion,
          });
        }
      } finally {
        setAiLoading(false);
      }
    })();
  }, [closeness]);

  const recordTransaction = async () => {
    const tx = await sendShagun({
      eventId: eventId!,
      receiverId: receiverId!,
      receiverName: receiverName ?? undefined,
      amount: finalAmount!,
      message: message.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(tx.id);
  };

  const handlePaymentMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "dismissed") { setPaymentModal(false); setLoading(false); trackEvent("payment_dismissed", { screen: "send_shagun" }); return; }
      if (data.type === "failed") { setPaymentModal(false); setError(data.error ?? "Payment failed. Please try again."); setLoading(false); trackEvent("payment_failed", { screen: "send_shagun", error: data.error }); return; }
      if (data.type === "demo_success") { setPaymentModal(false); await recordTransaction(); trackEvent("payment_success", { screen: "send_shagun", isDemoMode: true, amount: finalAmount }); setLoading(false); return; }
      if (data.type === "success") {
        try {
          const result = await capturePayment({
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
            receiverName: receiverName ?? undefined,
            message: message.trim() || undefined,
          });
          setPaymentModal(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          trackEvent("payment_success", { screen: "send_shagun", amount: finalAmount, eventId });
          setSent(result.transactionId);
        } catch { setPaymentModal(false); setError("Could not verify payment. Please contact support with your payment ID."); trackEvent("payment_failed", { screen: "send_shagun", stage: "capture" }); }
        setLoading(false);
      }
    } catch {}
  };

  const handleSend = async () => {
    if (!finalAmount || finalAmount < 1) {
      setError("Please select or enter an amount");
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    trackEvent("payment_initiated", { screen: "send_shagun", amount: finalAmount, eventType: eventType ?? "wedding" });
    try {
      const order = await createPaymentOrder(finalAmount, { receiverId: receiverId!, eventId: eventId ?? "direct", receiverName: receiverName ?? "" });
      setPaymentOrder({ id: order.id, keyId: order.keyId, isDemoMode: order.isDemoMode });
      setPaymentModal(true);
    } catch {
      setError("Could not initiate payment. Please try again.");
      setLoading(false);
    }
  };

  const razorpayHTML = paymentOrder ? buildRazorpayHTML(paymentOrder.id, paymentOrder.keyId, finalAmount ?? 0, receiverName ?? "", paymentOrder.isDemoMode) : "";

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
              Amount will be revealed after 10 minutes — a moment of anticipation 🙏
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

      <KeyboardAwareScrollView bottomOffset={24} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.recipientCard}>
          <View style={styles.recipientAvatar}>
            <Text style={styles.recipientAvatarText}>{(receiverName ?? "H").charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.recipientTo}>Sending to</Text>
            <Text style={styles.recipientName}>{receiverName}</Text>
          </View>
        </View>

        {/* AI Suggestion Panel */}
        {showAiPanel && (
          <View style={styles.aiPanel}>
            <View style={styles.aiPanelHeader}>
              <View style={styles.aiIconBadge}>
                <Feather name="zap" size={14} color={Colors.gold} />
              </View>
              <Text style={styles.aiPanelTitle}>Smart Suggestion</Text>
              <Pressable onPress={() => setShowAiPanel(false)} style={styles.aiCloseBtn}>
                <Feather name="x" size={14} color={Colors.textLight} />
              </Pressable>
            </View>

            {/* Closeness selector — drives AI multiplier */}
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
                    <Feather name={icons[level] as any} size={11} color={active ? Colors.goldDark : Colors.textLight} />
                    <Text style={[styles.closenessLabel, active && styles.closenessLabelActive]}>{labels[level]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {aiLoading ? (
              <View style={styles.aiLoadingRow}>
                <ActivityIndicator size="small" color={Colors.gold} />
                <Text style={styles.aiLoadingText}>Personalizing for you...</Text>
              </View>
            ) : aiSuggestion ? (
              <>
                <View style={styles.aiAmountRow}>
                  {aiSuggestion.conservativeAmount > 0 && aiSuggestion.conservativeAmount !== aiSuggestion.suggestedAmount && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.aiAmountChip,
                        styles.aiAmountChipCons,
                        selectedAmount === aiSuggestion.conservativeAmount && styles.aiAmountChipSelected,
                        pressed && styles.chipPressed,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedAmount(aiSuggestion.conservativeAmount);
                        setCustomAmount("");
                      }}
                    >
                      <Text style={styles.aiAmountChipLabel}>Conservative</Text>
                      <Text style={[
                        styles.aiAmountChipValue,
                        selectedAmount === aiSuggestion.conservativeAmount && styles.aiAmountChipValueSelected,
                      ]}>
                        ₹{aiSuggestion.conservativeAmount.toLocaleString("en-IN")}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [
                      styles.aiAmountChip,
                      selectedAmount === aiSuggestion.suggestedAmount && styles.aiAmountChipSelected,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setSelectedAmount(aiSuggestion.suggestedAmount);
                      setCustomAmount("");
                    }}
                  >
                    <Text style={styles.aiAmountChipLabel}>Recommended</Text>
                    <Text style={[
                      styles.aiAmountChipValue,
                      selectedAmount === aiSuggestion.suggestedAmount && styles.aiAmountChipValueSelected,
                    ]}>
                      ₹{aiSuggestion.suggestedAmount.toLocaleString("en-IN")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.aiAmountChip,
                      styles.aiAmountChipAlt,
                      selectedAmount === aiSuggestion.alternativeAmount && styles.aiAmountChipSelected,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedAmount(aiSuggestion.alternativeAmount);
                      setCustomAmount("");
                    }}
                  >
                    <Text style={styles.aiAmountChipLabel}>Alternative</Text>
                    <Text style={[
                      styles.aiAmountChipValue,
                      selectedAmount === aiSuggestion.alternativeAmount && styles.aiAmountChipValueSelected,
                    ]}>
                      ₹{aiSuggestion.alternativeAmount.toLocaleString("en-IN")}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.aiReasonRow}>
                  <Feather name="info" size={12} color={Colors.gold} />
                  <Text style={styles.aiReason}>{aiSuggestion.reasoning}</Text>
                  {aiSuggestion.confidenceLevel && (
                    <View style={[styles.confidenceBadge, aiSuggestion.confidenceLevel === "high" ? styles.badgeHigh : aiSuggestion.confidenceLevel === "medium" ? styles.badgeMedium : styles.badgeLow]}>
                      <Text style={styles.confidenceBadgeText}>{aiSuggestion.confidenceLevel === "high" ? "✓ High confidence" : aiSuggestion.confidenceLevel === "medium" ? "~ Medium" : "New"}</Text>
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
                {aiSuggestion.hasHistory && (
                  <View style={styles.aiHistoryRow}>
                    <Feather name="clock" size={12} color={Colors.textLight} />
                    <Text style={styles.aiHistoryText}>
                      Past: given ₹{aiSuggestion.previouslyGiven.toLocaleString("en-IN")}, received ₹{aiSuggestion.previouslyReceived.toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
              </>
            ) : null}
          </View>
        )}

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

        {aiSuggestion && aiSuggestion.suggestedMessages.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.blessingsScroll}>
            {aiSuggestion.suggestedMessages.map((b, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.blessingChip, pressed && styles.chipPressed]}
                onPress={() => setMessage(b)}
              >
                <Text style={styles.blessingChipText}>{b}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

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
            <WebView source={{ html: razorpayHTML }} onMessage={handlePaymentMessage} javaScriptEnabled domStorageEnabled style={{ flex: 1, backgroundColor: Colors.cream }} />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.text },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  recipientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
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
  recipientAvatarText: { color: Colors.cream, fontSize: 20, fontFamily: "Poppins_700Bold" },
  recipientTo: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.textLight },
  recipientName: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.text },
  aiPanel: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: Colors.gold + "60",
    gap: 10,
  },
  aiPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.gold + "25",
    alignItems: "center",
    justifyContent: "center",
  },
  aiPanelTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldDark,
  },
  aiCloseBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  aiLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  aiLoadingText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    fontStyle: "italic",
  },
  closenessRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  closenessChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: 20, backgroundColor: Colors.cream,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  closenessChipActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold + "18",
  },
  closenessLabel: {
    fontSize: 9,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textLight,
  },
  closenessLabelActive: {
    color: Colors.goldDark,
  },
  aiAmountRow: {
    flexDirection: "row",
    gap: 10,
  },
  aiAmountChip: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    backgroundColor: Colors.cream,
    borderWidth: 2,
    borderColor: Colors.gold + "40",
    gap: 4,
  },
  aiAmountChipAlt: {
    backgroundColor: Colors.cream,
    borderColor: Colors.border,
  },
  aiAmountChipCons: {
    backgroundColor: Colors.cream,
    borderColor: "#22c55e40",
  },
  aiAmountChipSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold + "18",
  },
  chipPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  aiAmountChipLabel: {
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  aiAmountChipValue: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  aiAmountChipValueSelected: {
    color: Colors.goldDark,
  },
  aiReasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    flexWrap: "wrap",
  },
  aiReason: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  aiHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.cream,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  aiHistoryText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.textLight,
  },
  confidenceBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeHigh: { backgroundColor: "#22c55e22" },
  badgeMedium: { backgroundColor: Colors.gold + "22" },
  badgeLow: { backgroundColor: Colors.border },
  confidenceBadgeText: { fontSize: 9, fontFamily: "Poppins_700Bold", color: Colors.textSecondary, letterSpacing: 0.3 },
  signalsBox: { gap: 4, paddingTop: 2 },
  signalRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  signalDot: { fontSize: 10, color: Colors.gold, lineHeight: 18, fontFamily: "Poppins_700Bold" },
  signalText: { flex: 1, fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.textLight, lineHeight: 17 },
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
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  presetAmt: { fontSize: 15, fontFamily: "Poppins_700Bold", color: Colors.text },
  presetAmtSelected: { color: Colors.primary },
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
  rupeeSymbol: { fontSize: 20, fontFamily: "Poppins_700Bold", color: Colors.primary, marginRight: 6 },
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
    maxWidth: 240,
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
  sendBtnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  sendBtnEmoji: { fontSize: 20 },
  sendBtnText: { color: Colors.cream, fontSize: 17, fontFamily: "Poppins_700Bold" },
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
  envelopeEmoji: { fontSize: 56 },
  successTitle: { fontSize: 32, fontFamily: "Poppins_700Bold", color: Colors.goldLight },
  successSub: {
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 24,
  },
  successAmountText: { fontFamily: "Poppins_700Bold", color: Colors.goldLight },
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
  revealBtnText: { fontSize: 16, fontFamily: "Poppins_700Bold", color: Colors.primary },
  doneBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  doneBtnText: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "rgba(255,255,255,0.7)" },
  modalContainer: { flex: 1, backgroundColor: Colors.cream },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.text },
  modalClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
