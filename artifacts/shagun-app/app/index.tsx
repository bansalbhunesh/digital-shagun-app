import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function OnboardingScreen() {
  const { user, requestOTP, verifyOTP } = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otpError, setOtpError] = useState("");
  const phoneRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);

  React.useEffect(() => {
    if (user) router.replace("/(tabs)");
  }, [user]);

  const goToStep2 = () => {
    if (!name.trim() || name.trim().length < 2) {
      setNameError("Please enter your full name");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setNameError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(2);
    setTimeout(() => phoneRef.current?.focus(), 100);
  };

  const goToStep3 = async () => {
    if (!phone.trim() || phone.trim().length < 10) {
      setPhoneError("Enter a valid 10-digit mobile number");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setPhoneError("");
    setLoading(true);
    try {
      const res = await requestOTP(phone.trim());
      setDevCode(res.devCode);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep(3);
      setTimeout(() => otpRef.current?.focus(), 100);
    } catch {
      setPhoneError("Could not send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.trim().length !== 6) {
      setOtpError("Enter the 6-digit OTP");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setOtpError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await verifyOTP(phone.trim(), otp.trim(), name.trim());
      router.replace("/(tabs)");
    } catch {
      setOtpError("Invalid or expired OTP. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.ornamentTop} />
      <View style={styles.ornamentBottom} />

      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 40 }]}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🪔</Text>
          </View>
          <Text style={styles.appName}>Shagun</Text>
          <Text style={styles.tagline}>Blessings that remember</Text>
        </View>

        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepLine, (step === 2 || step === 3) && styles.stepLineActive]} />
          <View style={[styles.stepDot, (step === 2 || step === 3) && styles.stepDotActive]} />
          <View style={[styles.stepLine, step === 3 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step === 3 && styles.stepDotActive]} />
        </View>

        {/* Step 1 — Name */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>Step 1 of 3</Text>
            <Text style={styles.cardTitle}>What's your name?</Text>
            <Text style={styles.cardSub}>How should we address you in blessings?</Text>
            <View style={styles.inputGroup}>
              <View style={[styles.inputWrapper, nameError ? styles.inputError : null]}>
                <Feather name="user" size={20} color={nameError ? Colors.error : Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ramesh Sharma"
                  placeholderTextColor={Colors.textLight}
                  value={name}
                  onChangeText={t => { setName(t); setNameError(""); }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={goToStep2}
                  autoFocus
                />
              </View>
              {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
            </View>
            <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]} onPress={goToStep2}>
              <Text style={styles.btnText}>Continue</Text>
              <Feather name="arrow-right" size={20} color={Colors.cream} />
            </Pressable>
          </View>
        )}

        {/* Step 2 — Phone */}
        {step === 2 && (
          <View style={styles.card}>
            <Pressable style={styles.backStep} onPress={() => setStep(1)}>
              <Feather name="arrow-left" size={16} color={Colors.textLight} />
              <Text style={styles.backStepText}>Back</Text>
            </Pressable>
            <Text style={styles.stepLabel}>Step 2 of 3</Text>
            <Text style={styles.cardTitle}>Namaste, {name.split(" ")[0]}! 🙏</Text>
            <Text style={styles.cardSub}>Enter your mobile number. We'll send you a one-time verification code.</Text>
            <View style={styles.inputGroup}>
              <View style={[styles.inputWrapper, phoneError ? styles.inputError : null]}>
                <Text style={styles.countryCode}>🇮🇳 +91</Text>
                <View style={styles.divider} />
                <TextInput
                  ref={phoneRef}
                  style={styles.input}
                  placeholder="9876543210"
                  placeholderTextColor={Colors.textLight}
                  value={phone}
                  onChangeText={t => { setPhone(t.replace(/[^0-9]/g, "")); setPhoneError(""); }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={goToStep3}
                />
                {phone.length === 10 && <Feather name="check-circle" size={18} color={Colors.success} />}
              </View>
              {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
            </View>
            <Pressable
              style={({ pressed }) => [styles.btn, (loading || phone.length < 10) && styles.btnDisabled, pressed && styles.btnPressed]}
              onPress={goToStep3}
              disabled={loading || phone.length < 10}
            >
              {loading ? <ActivityIndicator color={Colors.cream} /> : (
                <>
                  <Text style={styles.btnText}>Send OTP</Text>
                  <Feather name="send" size={18} color={Colors.cream} />
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Step 3 — OTP */}
        {step === 3 && (
          <View style={styles.card}>
            <Pressable style={styles.backStep} onPress={() => { setStep(2); setOtp(""); setOtpError(""); }}>
              <Feather name="arrow-left" size={16} color={Colors.textLight} />
              <Text style={styles.backStepText}>Back</Text>
            </Pressable>
            <Text style={styles.stepLabel}>Step 3 of 3</Text>
            <Text style={styles.cardTitle}>Enter OTP 🔐</Text>
            <Text style={styles.cardSub}>
              We sent a 6-digit code to +91 {phone}.{"\n"}Enter it below to verify.
            </Text>

            {devCode && (
              <View style={styles.devBanner}>
                <Feather name="info" size={13} color={Colors.gold} />
                <Text style={styles.devBannerText}>Dev mode — your OTP is: <Text style={{ fontFamily: "Poppins_700Bold" }}>{devCode}</Text></Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <View style={[styles.inputWrapper, styles.otpWrapper, otpError ? styles.inputError : null]}>
                <Feather name="lock" size={20} color={otpError ? Colors.error : Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  ref={otpRef}
                  style={[styles.input, styles.otpInput]}
                  placeholder="• • • • • •"
                  placeholderTextColor={Colors.textLight}
                  value={otp}
                  onChangeText={t => { setOtp(t.replace(/[^0-9]/g, "")); setOtpError(""); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOTP}
                />
                {otp.length === 6 && <Feather name="check-circle" size={18} color={Colors.success} />}
              </View>
              {otpError ? <Text style={styles.fieldError}>{otpError}</Text> : null}
            </View>

            <Pressable
              style={({ pressed }) => [styles.btn, (loading || otp.length < 6) && styles.btnDisabled, pressed && styles.btnPressed]}
              onPress={handleVerifyOTP}
              disabled={loading || otp.length < 6}
            >
              {loading ? <ActivityIndicator color={Colors.cream} /> : (
                <>
                  <Text style={styles.btnText}>Verify & Enter</Text>
                  <Text style={styles.btnEmoji}>🙏</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.resendRow} onPress={goToStep3}>
              <Text style={styles.resendText}>Didn't receive OTP? </Text>
              <Text style={styles.resendLink}>Resend</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.features}>
          {[
            { icon: "shield", text: "Verified phone — your account stays secure" },
            { icon: "send", text: "Send shagun to anyone, anytime" },
            { icon: "heart", text: "Track blessings across all your relationships" },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Feather name={f.icon as any} size={15} color={Colors.gold} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  ornamentTop: { position: "absolute", top: 0, right: 0, width: 160, height: 160, borderBottomLeftRadius: 160, backgroundColor: Colors.primary, opacity: 0.07 },
  ornamentBottom: { position: "absolute", bottom: 0, left: 0, width: 120, height: 120, borderTopRightRadius: 120, backgroundColor: Colors.gold, opacity: 0.1 },
  scroll: { paddingHorizontal: 24 },
  header: { alignItems: "center", paddingTop: 36, paddingBottom: 20 },
  logoContainer: { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 14, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  logoEmoji: { fontSize: 34 },
  appName: { fontSize: 34, fontFamily: "Poppins_700Bold", color: Colors.primary, letterSpacing: 2 },
  tagline: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.gold, letterSpacing: 1, marginTop: 2 },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary },
  stepLine: { width: 30, height: 2, backgroundColor: Colors.border },
  stepLineActive: { backgroundColor: Colors.primary },
  card: { backgroundColor: Colors.white, borderRadius: 24, padding: 26, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 24, elevation: 8, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 24 },
  backStep: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14, alignSelf: "flex-start" },
  backStepText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.textLight },
  stepLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.primary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  cardTitle: { fontSize: 22, fontFamily: "Poppins_700Bold", color: Colors.text, marginBottom: 6 },
  cardSub: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.textSecondary, lineHeight: 22, marginBottom: 22 },
  devBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.gold + "18", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, borderWidth: 1, borderColor: Colors.gold + "40" },
  devBannerText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.text, flex: 1 },
  inputGroup: { marginBottom: 18 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.cream, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, height: 54 },
  inputError: { borderColor: Colors.error },
  otpWrapper: { justifyContent: "center" },
  inputIcon: { marginRight: 10 },
  countryCode: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.text },
  divider: { width: 1, height: 22, backgroundColor: Colors.border, marginHorizontal: 12 },
  input: { flex: 1, fontSize: 16, fontFamily: "Poppins_400Regular", color: Colors.text },
  otpInput: { fontSize: 22, fontFamily: "Poppins_700Bold", textAlign: "center", letterSpacing: 8 },
  fieldError: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.error, marginTop: 6, marginLeft: 2 },
  btn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  btnText: { color: Colors.cream, fontSize: 17, fontFamily: "Poppins_600SemiBold" },
  btnEmoji: { fontSize: 18 },
  resendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16 },
  resendText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.textLight },
  resendLink: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.primary },
  features: { gap: 14, paddingHorizontal: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary + "18", alignItems: "center", justifyContent: "center" },
  featureText: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.textSecondary, flex: 1 },
});
