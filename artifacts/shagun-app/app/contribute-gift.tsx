import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useContributeToGift } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export default function ContributeGiftScreen() {
  const { giftId, giftName, giftEmoji, remaining } = useLocalSearchParams<{
    giftId: string; giftName: string; giftEmoji: string; remaining: string;
  }>();
  const { user } = useApp();
  const queryClient = useQueryClient();
  const { mutateAsync: contributeMutation } = useContributeToGift();
  const insets = useSafeAreaInsets();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const finalAmount = selectedAmount ?? (customAmount ? parseInt(customAmount) : null);
  const remainingAmt = parseInt(remaining ?? "0");

  const handleContribute = async () => {
    if (!finalAmount || finalAmount < 1) { setError("Please enter an amount"); return; }
    if (finalAmount > remainingAmt) { setError(`Maximum contribution is ₹${remainingAmt.toLocaleString("en-IN")}`); return; }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await contributeMutation({
        data: { 
          giftId: giftId!,
          amount: finalAmount,
          contributorId: user!.id,
          contributorName: user!.name
        }
      });
      queryClient.invalidateQueries({ queryKey: ["eventDetail"] });
      queryClient.invalidateQueries({ queryKey: ["eventGifts"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.container, styles.doneBg, { paddingTop: topPadding }]}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>{giftEmoji}</Text>
          <Text style={styles.doneTitle}>Contribution Made!</Text>
          <Text style={styles.doneSub}>
            You contributed ₹{finalAmount?.toLocaleString("en-IN")} toward{"\n"}
            <Text style={styles.doneHighlight}>{giftName}</Text>
          </Text>
          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
            onPress={() => router.back()}
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
        <Text style={styles.headerTitle}>Contribute</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.giftInfoCard}>
          <Text style={styles.giftEmoji}>{giftEmoji}</Text>
          <View>
            <Text style={styles.giftName}>{giftName}</Text>
            <Text style={styles.remainingText}>₹{remainingAmt.toLocaleString("en-IN")} remaining</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Choose Amount</Text>
        <View style={styles.presetRow}>
          {QUICK_AMOUNTS.filter(a => a <= remainingAmt).map(amt => (
            <Pressable
              key={amt}
              style={({ pressed }) => [
                styles.presetChip,
                selectedAmount === amt && styles.presetChipSelected,
                pressed && styles.chipPressed,
              ]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedAmount(amt); setCustomAmount(""); }}
            >
              <Text style={[styles.presetChipText, selectedAmount === amt && styles.presetChipTextSelected]}>
                ₹{amt.toLocaleString("en-IN")}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.presetChip,
              selectedAmount === remainingAmt && styles.presetChipSelected,
              pressed && styles.chipPressed,
            ]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSelectedAmount(remainingAmt); setCustomAmount(""); }}
          >
            <Text style={[styles.presetChipText, selectedAmount === remainingAmt && styles.presetChipTextSelected]}>
              Full ₹{remainingAmt.toLocaleString("en-IN")}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Custom Amount</Text>
        <View style={styles.customWrapper}>
          <Text style={styles.rupeeSign}>₹</Text>
          <TextInput
            style={styles.customInput}
            placeholder="Amount"
            placeholderTextColor={Colors.textLight}
            value={customAmount}
            onChangeText={t => { setCustomAmount(t.replace(/[^0-9]/g, "")); setSelectedAmount(null); }}
            keyboardType="numeric"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.payBtn, pressed && styles.btnPressed]}
          onPress={handleContribute}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.cream} />
          ) : (
            <>
              <Feather name="heart" size={18} color={Colors.cream} />
              <Text style={styles.payBtnText}>
                Contribute {finalAmount ? `₹${finalAmount.toLocaleString("en-IN")}` : ""}
              </Text>
            </>
          )}
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
  doneBg: {
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
  content: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  giftInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  giftEmoji: {
    fontSize: 40,
  },
  giftName: {
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  remainingText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.gold,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  presetChip: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  presetChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "0A",
  },
  chipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  presetChipText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  presetChipTextSelected: {
    color: Colors.primary,
  },
  customWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  rupeeSign: {
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
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
  },
  payBtn: {
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
  payBtnText: {
    color: Colors.cream,
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
  },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  doneEmoji: {
    fontSize: 80,
    marginBottom: 8,
  },
  doneTitle: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
  },
  doneSub: {
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 24,
  },
  doneHighlight: {
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
  },
  doneBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
});
