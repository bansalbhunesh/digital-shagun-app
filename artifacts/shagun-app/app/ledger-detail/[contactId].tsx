import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useApp, formatINR } from "@/context/AppContext";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@/lib/apiClient";

interface LedgerDetail {
  contactId: string;
  contactName: string;
  totalGiven: number;
  totalReceived: number;
  balance: number;
  suggestedAmount: number;
  transactions: Array<{
    id: string;
    direction: "given" | "received";
    amount: number;
    eventName: string;
    eventType: string;
    date: string;
    message?: string;
  }>;
}

const EVENT_TYPE_EMOJI: Record<string, string> = {
  wedding: "💍",
  baby_ceremony: "👶",
  housewarming: "🏠",
  birthday: "🎂",
  festival: "🪔",
};

export default function LedgerDetailScreen() {
  const { contactId, name } = useLocalSearchParams<{ contactId: string; name: string }>();
  const { user } = useApp();
  const insets = useSafeAreaInsets();
  
  const { data: detail, isLoading: loading } = useQuery<LedgerDetail>({
    queryKey: ["ledgerDetail", user?.id, contactId],
    queryFn: () => customFetch(`/api/ledger/${user!.id}/${contactId}`),
    enabled: !!contactId && !!user?.id,
  });

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const initials = (name ?? "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.cream} />
        </Pressable>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.heroAvatar}>
          <Text style={styles.heroAvatarText}>{initials}</Text>
        </View>
        <Text style={styles.heroName}>{detail?.contactName ?? name}</Text>
        <Text style={styles.heroSub}>Blessing History</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={[styles.summaryAmt, { color: Colors.success }]}>
                ₹{detail?.totalGiven.toLocaleString("en-IN") ?? 0}
              </Text>
              <Text style={styles.summaryLabel}>You Gave</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={[styles.summaryAmt, { color: Colors.primary }]}>
                ₹{detail?.totalReceived.toLocaleString("en-IN") ?? 0}
              </Text>
              <Text style={styles.summaryLabel}>They Gave</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={[styles.summaryAmt, { color: Colors.gold }]}>
                ₹{Math.abs(detail?.balance ?? 0).toLocaleString("en-IN")}
              </Text>
              <Text style={styles.summaryLabel}>
                {(detail?.balance ?? 0) >= 0 ? "You're ahead" : "They're ahead"}
              </Text>
            </View>
          </View>

          {detail?.suggestedAmount && detail.suggestedAmount > 0 && (
            <View style={styles.suggestCard}>
              <Feather name="star" size={16} color={Colors.gold} />
              <View style={styles.suggestBody}>
                <Text style={styles.suggestTitle}>Smart Suggestion</Text>
                <Text style={styles.suggestText}>
                  Next time you attend their event, consider giving{" "}
                  <Text style={styles.suggestHighlight}>₹{detail.suggestedAmount.toLocaleString("en-IN")}</Text>
                  {" "}to keep the relationship balanced
                </Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Blessing Timeline</Text>
            {(detail?.transactions ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No transactions found</Text>
            ) : (
              detail?.transactions.map((tx, i) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIndicator, { backgroundColor: tx.direction === "given" ? Colors.success : Colors.primary }]} />
                  <View style={styles.txEmoji}>
                    <Text>{EVENT_TYPE_EMOJI[tx.eventType] ?? "🎉"}</Text>
                  </View>
                  <View style={styles.txBody}>
                    <Text style={styles.txEventName}>{tx.eventName}</Text>
                    <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text>
                    {tx.message && <Text style={styles.txMessage}>{tx.message}</Text>}
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txDirection, { color: tx.direction === "given" ? Colors.success : Colors.primary }]}>
                      {tx.direction === "given" ? "You gave" : "You received"}
                    </Text>
                    <Text style={[styles.txAmount, { color: tx.direction === "given" ? Colors.success : Colors.primary }]}>
                      ₹{tx.amount.toLocaleString("en-IN")}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSection: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 8,
  },
  heroAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.goldLight,
    marginBottom: 4,
  },
  heroAvatarText: {
    color: Colors.primary,
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
  },
  heroName: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    backgroundColor: Colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  summaryRow: {
    flexDirection: "row",
    padding: 20,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  summaryBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryAmt: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
  },
  suggestCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.gold + "1A",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  suggestBody: {
    flex: 1,
    gap: 4,
  },
  suggestTitle: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldDark,
  },
  suggestText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  suggestHighlight: {
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  section: {
    padding: 20,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
    paddingVertical: 24,
    fontStyle: "italic",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  txIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  txEmoji: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  txBody: {
    flex: 1,
    gap: 2,
  },
  txEventName: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  txDate: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  txMessage: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    fontStyle: "italic",
  },
  txRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  txDirection: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  txAmount: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
  },
});
