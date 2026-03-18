import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function PaymentScreen() {
  const params = useLocalSearchParams<{
    amount: string;
    receiverName: string;
    orderId: string;
    keyId: string;
    isDemoMode: string;
    redirectPath: string;
    extraParams: string;
  }>();

  const insets = useSafeAreaInsets();
  const { verifyPayment } = useApp();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const webViewRef = useRef<WebView>(null);

  const amount = parseFloat(params.amount ?? "0");
  const isDemoMode = params.isDemoMode === "true";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const razorpayHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { font-family: sans-serif; background: #FFF8F0; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; gap: 16px; }
    .msg { color: #8B1A1A; font-size: 16px; text-align: center; padding: 20px; }
    .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #8B1A1A; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="msg">Opening payment...</div>
  <script>
    var options = {
      key: "${params.keyId}",
      amount: "${Math.round(amount * 100)}",
      currency: "INR",
      name: "Shagun",
      description: "Shagun for ${params.receiverName ?? ""}",
      order_id: "${params.orderId}",
      prefill: {},
      theme: { color: "#8B1A1A" },
      modal: { ondismiss: function() { window.ReactNativeWebView.postMessage(JSON.stringify({ type: "dismissed" })); } },
      handler: function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "success",
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        }));
      }
    };
    var rzp = new Razorpay(options);
    rzp.on("payment.failed", function(response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "failed", error: response.error.description }));
    });
    setTimeout(function() { rzp.open(); }, 500);
  </script>
</body>
</html>`;

  const demoHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: sans-serif; background: #FFF8F0; margin: 0; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; gap: 16px; }
    h2 { color: #8B1A1A; font-size: 22px; margin: 0; }
    p { color: #555; text-align: center; margin: 0; font-size: 15px; }
    .amount { font-size: 42px; font-weight: bold; color: #8B1A1A; }
    .btn { background: #8B1A1A; color: white; border: none; border-radius: 14px; padding: 16px 40px; font-size: 17px; cursor: pointer; width: 100%; max-width: 300px; }
    .btn-skip { background: transparent; color: #888; border: 1px solid #ccc; border-radius: 14px; padding: 14px 40px; font-size: 15px; cursor: pointer; width: 100%; max-width: 300px; }
    .badge { background: #C9A84C22; color: #8B6914; border: 1px solid #C9A84C; border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <span class="badge">🔧 DEMO MODE — No Razorpay keys set</span>
  <h2>Payment Summary</h2>
  <div class="amount">₹${amount.toLocaleString("en-IN")}</div>
  <p>Shagun for <strong>${params.receiverName ?? ""}</strong></p>
  <p style="font-size:13px;color:#aaa;">In demo mode, payment is simulated.<br>Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET<br>in environment secrets for real payments.</p>
  <button class="btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'demo_success'}))">✓ Simulate Payment</button>
  <button class="btn-skip" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'dismissed'}))">Cancel</button>
</body>
</html>`;

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "dismissed") {
        router.back();
        return;
      }
      if (data.type === "failed") {
        setError(data.error ?? "Payment failed. Please try again.");
        return;
      }
      if (data.type === "demo_success") {
        router.back();
        router.setParams({ paymentSuccess: "true", paymentId: "demo_" + Date.now() });
        return;
      }
      if (data.type === "success") {
        setVerifying(true);
        try {
          const result = await verifyPayment({
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
          });
          if (result.verified) {
            router.back();
            router.setParams({ paymentSuccess: "true", paymentId: result.paymentId ?? data.razorpay_payment_id });
          } else {
            setError("Payment verification failed. Contact support.");
          }
        } finally {
          setVerifying(false);
        }
      }
    } catch {}
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.webFallback}>
          <Text style={styles.webFallbackEmoji}>💳</Text>
          <Text style={styles.webFallbackTitle}>Razorpay Payment</Text>
          <Text style={styles.webFallbackSub}>
            Open the app on your Android or iOS device to complete the payment via Razorpay UPI, card, or netbanking.
          </Text>
        </View>
      </View>
    );
  }

  if (verifying) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.verifyText}>Verifying payment...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: topPad }]}>
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Payment Failed</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => setError("")}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Secure Payment</Text>
        <View style={{ width: 40 }} />
      </View>
      <WebView
        ref={webViewRef}
        source={{ html: isDemoMode ? demoHTML : razorpayHTML }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1, backgroundColor: Colors.cream }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  center: { alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Poppins_700Bold", color: Colors.text },
  verifyText: { fontSize: 15, fontFamily: "Poppins_400Regular", color: Colors.textSecondary },
  errorBox: { backgroundColor: Colors.white, borderRadius: 20, padding: 28, alignItems: "center", gap: 12, width: "100%", shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4 },
  errorTitle: { fontSize: 20, fontFamily: "Poppins_700Bold", color: Colors.text },
  errorMsg: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.textSecondary, textAlign: "center" },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  retryBtnText: { color: Colors.cream, fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.textLight },
  webFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  webFallbackEmoji: { fontSize: 60 },
  webFallbackTitle: { fontSize: 22, fontFamily: "Poppins_700Bold", color: Colors.text },
  webFallbackSub: { fontSize: 15, fontFamily: "Poppins_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 24 },
});
