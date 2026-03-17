import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function OnboardingScreen() {
  const { user, login } = useApp();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (user) router.replace("/(tabs)");
  }, [user]);

  const handleLogin = async () => {
    if (!name.trim() || !phone.trim()) {
      setError("Please enter your name and phone number");
      return;
    }
    if (phone.trim().length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(name.trim(), phone.trim());
      router.replace("/(tabs)");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.ornamentTop} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🪔</Text>
            </View>
            <Text style={styles.appName}>Shagun</Text>
            <Text style={styles.tagline}>Blessings that remember</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome</Text>
            <Text style={styles.cardSubtitle}>
              Send and receive shagun at celebrations that matter.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Your Name</Text>
              <View style={styles.inputWrapper}>
                <Feather name="user" size={18} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ramesh Sharma"
                  placeholderTextColor={Colors.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={styles.inputWrapper}>
                <Feather name="phone" size={18} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="9876543210"
                  placeholderTextColor={Colors.textLight}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.loginBtn, pressed && styles.loginBtnPressed]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.cream} />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Begin with Blessings</Text>
                  <Feather name="arrow-right" size={20} color={Colors.cream} />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.features}>
            {[
              { icon: "gift", text: "Gift registries for celebrations" },
              { icon: "heart", text: "Track blessings across events" },
              { icon: "share-2", text: "Share via QR & WhatsApp" },
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Feather name={f.icon as any} size={16} color={Colors.gold} />
                </View>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.ornamentBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  ornamentTop: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 150,
    height: 150,
    borderBottomLeftRadius: 150,
    backgroundColor: Colors.primary,
    opacity: 0.08,
  },
  ornamentBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 100,
    height: 100,
    borderTopRightRadius: 100,
    backgroundColor: Colors.gold,
    opacity: 0.1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: 36,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.gold,
    letterSpacing: 1,
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Poppins_400Regular",
    color: Colors.text,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    marginBottom: 12,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  loginBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  loginBtnText: {
    color: Colors.cream,
    fontSize: 17,
    fontFamily: "Poppins_600SemiBold",
  },
  features: {
    marginTop: 28,
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.85,
  },
  featureText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    flex: 1,
  },
});
