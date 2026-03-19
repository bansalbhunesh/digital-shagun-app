import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useJoinEvent, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function JoinEventScreen() {
  const { user } = useApp();
  const queryClient = useQueryClient();
  const { mutateAsync: joinEvent } = useJoinEvent();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleJoin = async () => {
    if (code.trim().length < 4) {
      setError("Please enter a valid event code");
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const detail = await customFetch<{ event: { id: string } }>(`/api/events/${code.trim().toUpperCase()}`);
      await joinEvent({
        eventId: detail.event.id,
        data: { userId: user!.id }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/event/[id]", params: { id: detail.event.id } });
    } catch {
      setError("Event not found. Please check the code.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Join Event</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.illustration}>
          <Text style={styles.illustrationEmoji}>🎟️</Text>
        </View>

        <Text style={styles.title}>Enter Event Code</Text>
        <Text style={styles.subtitle}>
          Get the code from the event host via WhatsApp or QR code
        </Text>

        <View style={styles.codeInputWrapper}>
          <TextInput
            style={styles.codeInput}
            placeholder="ABC123"
            placeholderTextColor={Colors.textLight}
            value={code}
            onChangeText={t => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            textAlign="center"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.joinBtn, pressed && styles.btnPressed]}
          onPress={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.cream} />
          ) : (
            <>
              <Feather name="arrow-right-circle" size={20} color={Colors.cream} />
              <Text style={styles.joinBtnText}>Join Celebration</Text>
            </>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.qrBtn, pressed && styles.btnPressed]}
          onPress={() => Alert.alert("QR Scanner", "Scan the QR code from the event host to join automatically.")}
        >
          <Feather name="camera" size={20} color={Colors.primary} />
          <Text style={styles.qrBtnText}>Scan QR Code</Text>
        </Pressable>
      </View>
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
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
    paddingBottom: 60,
  },
  illustration: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 8,
  },
  illustrationEmoji: {
    fontSize: 44,
  },
  title: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  codeInputWrapper: {
    width: "100%",
    marginVertical: 8,
  },
  codeInput: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.gold,
    paddingVertical: 18,
    fontSize: 32,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
    letterSpacing: 8,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
  },
  joinBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
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
  joinBtnText: {
    color: Colors.cream,
    fontSize: 17,
    fontFamily: "Poppins_600SemiBold",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  qrBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  qrBtnText: {
    color: Colors.primary,
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
  },
});
