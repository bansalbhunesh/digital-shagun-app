import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, ActivityIndicator, Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function OnboardingScreen() {
  const { user, login } = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const phoneRef = useRef<TextInput>(null);

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

  const handleLogin = async () => {
    if (!phone.trim() || phone.trim().length < 10) {
      setPhoneError("Enter a valid 10-digit mobile number");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setPhoneError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(name.trim(), phone.trim());
      router.replace("/(tabs)");
    } catch {
      setPhoneError("Something went wrong. Please try again.");
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🪔</Text>
          </View>
          <Text style={styles.appName}>Shagun</Text>
          <Text style={styles.tagline}>Blessings that remember</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepLine, step === 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step === 2 && styles.stepDotActive]} />
        </View>

        {/* Step 1 — Name */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>Step 1 of 2</Text>
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

            <Pressable
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              onPress={goToStep2}
            >
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

            <Text style={styles.stepLabel}>Step 2 of 2</Text>
            <Text style={styles.cardTitle}>Namaste, {name.split(" ")[0]}! 🙏</Text>
            <Text style={styles.cardSub}>Enter your mobile number to continue. We'll remember you next time.</Text>

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
                  onSubmitEditing={handleLogin}
                />
                {phone.length === 10 && (
                  <Feather name="check-circle" size={18} color="#22c55e" />
                )}
              </View>
              {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                (loading || phone.length < 10) && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.cream} />
              ) : (
                <>
                  <Text style={styles.btnText}>Begin with Blessings</Text>
                  <Text style={styles.btnEmoji}>🙏</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.disclaimer}>
              Your number is only used to identify your account. We don't send OTPs or marketing messages.
            </Text>
          </View>
        )}

        {/* Features */}
        <View style={styles.features}>
          {[
            { icon: "send", text: "Send shagun to anyone, anytime" },
            { icon: "gift", text: "Gift registries for celebrations" },
            { icon: "heart", text: "Track blessings for life" },
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
  ornamentTop: {
    position: "absolute", top: 0, right: 0,
    width: 160, height: 160, borderBottomLeftRadius: 160,
    backgroundColor: Colors.primary, opacity: 0.07,
  },
  ornamentBottom: {
    position: "absolute", bottom: 0, left: 0,
    width: 120, height: 120, borderTopRightRadius: 120,
    backgroundColor: Colors.gold, opacity: 0.1,
  },
  scroll: { paddingHorizontal: 24 },
  header: { alignItems: "center", paddingTop: 36, paddingBottom: 20 },
  logoContainer: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
    marginBottom: 14,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  logoEmoji: { fontSize: 34 },
  appName: {
    fontSize: 34, fontFamily: "Poppins_700Bold",
    color: Colors.primary, letterSpacing: 2,
  },
  tagline: {
    fontSize: 13, fontFamily: "Poppins_400Regular",
    color: Colors.gold, letterSpacing: 1, marginTop: 2,
  },
  stepRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 0, marginBottom: 20,
  },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.border,
  },
  stepDotActive: { backgroundColor: Colors.primary },
  stepLine: { width: 40, height: 2, backgroundColor: Colors.border },
  stepLineActive: { backgroundColor: Colors.primary },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24, padding: 26,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1, shadowRadius: 24, elevation: 8,
    borderWidth: 1, borderColor: Colors.borderLight,
    marginBottom: 24,
  },
  backStep: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 14, alignSelf: "flex-start",
  },
  backStepText: {
    fontSize: 13, fontFamily: "Poppins_500Medium", color: Colors.textLight,
  },
  stepLabel: {
    fontSize: 11, fontFamily: "Poppins_600SemiBold",
    color: Colors.primary, textTransform: "uppercase",
    letterSpacing: 1, marginBottom: 6,
  },
  cardTitle: {
    fontSize: 22, fontFamily: "Poppins_700Bold",
    color: Colors.text, marginBottom: 6,
  },
  cardSub: {
    fontSize: 14, fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary, lineHeight: 22, marginBottom: 22,
  },
  inputGroup: { marginBottom: 18 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.cream, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, height: 54,
  },
  inputError: { borderColor: Colors.error },
  inputIcon: { marginRight: 10 },
  countryCode: {
    fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.text,
  },
  divider: {
    width: 1, height: 22, backgroundColor: Colors.border, marginHorizontal: 12,
  },
  input: {
    flex: 1, fontSize: 16,
    fontFamily: "Poppins_400Regular", color: Colors.text,
  },
  fieldError: {
    fontSize: 12, fontFamily: "Poppins_400Regular",
    color: Colors.error, marginTop: 6, marginLeft: 2,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 16,
    paddingVertical: 17, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  btnText: { color: Colors.cream, fontSize: 17, fontFamily: "Poppins_600SemiBold" },
  btnEmoji: { fontSize: 18 },
  disclaimer: {
    fontSize: 11, fontFamily: "Poppins_400Regular",
    color: Colors.textLight, textAlign: "center",
    marginTop: 14, lineHeight: 17,
  },
  features: { gap: 14, paddingHorizontal: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primary + "18",
    alignItems: "center", justifyContent: "center",
  },
  featureText: {
    fontSize: 14, fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary, flex: 1,
  },
});
