import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList,
  RefreshControl, ActivityIndicator, Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, LedgerEntry } from "@/context/AppContext";

function LedgerCard({ entry, onPress }: { entry: LedgerEntry; onPress: () => void }) {
  const balance = entry.totalGiven - entry.totalReceived;
  const isPositive = balance >= 0;
  const initials = entry.contactName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, { backgroundColor: isPositive ? Colors.primary : Colors.gold }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.contactName}>{entry.contactName}</Text>
        {entry.lastEventName && (
          <Text style={styles.lastEvent} numberOfLines={1}>
            {entry.lastEventName}
          </Text>
        )}
        <View style={styles.amounts}>
          <View style={styles.amtItem}>
            <Text style={styles.amtLabel}>Given</Text>
            <Text style={[styles.amtValue, { color: Colors.success }]}>
              ₹{entry.totalGiven.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.amtDivider} />
          <View style={styles.amtItem}>
            <Text style={styles.amtLabel}>Received</Text>
            <Text style={[styles.amtValue, { color: Colors.primary }]}>
              ₹{entry.totalReceived.toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardRight}>
        <View style={[styles.suggestBadge, { backgroundColor: isPositive ? Colors.successLight : Colors.cream }]}>
          <Text style={[styles.suggestLabel, { color: isPositive ? Colors.success : Colors.textSecondary }]}>
            Suggest
          </Text>
          <Text style={[styles.suggestAmount, { color: isPositive ? Colors.success : Colors.primary }]}>
            ₹{entry.suggestedAmount.toLocaleString("en-IN")}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={Colors.textLight} style={{ marginTop: 8 }} />
      </View>
    </Pressable>
  );
}

export default function LedgerScreen() {
  const { user, getLedger } = useApp();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    try {
      const data = await getLedger();
      setEntries(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getLedger]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalGiven = entries.reduce((s, e) => s + e.totalGiven, 0);
  const totalReceived = entries.reduce((s, e) => s + e.totalReceived, 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Remember Blessings</Text>
        <Text style={styles.headerSub}>Your private gift relationships</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>₹{totalGiven.toLocaleString("en-IN")}</Text>
          <Text style={styles.summaryLabel}>Blessings Given</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.gold }]}>₹{totalReceived.toLocaleString("en-IN")}</Text>
          <Text style={styles.summaryLabel}>Blessings Received</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{entries.length}</Text>
          <Text style={styles.summaryLabel}>Relationships</Text>
        </View>
      </View>

      <View style={styles.privateNote}>
        <Feather name="lock" size={14} color={Colors.textLight} />
        <Text style={styles.privateText}>This data is private and only visible to you</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.contactId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <LedgerCard
              entry={item}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/ledger-detail/[contactId]", params: { contactId: item.contactId, name: item.contactName } });
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Feather name="heart" size={32} color={Colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>No blessings tracked yet</Text>
              <Text style={styles.emptyText}>
                When you give or receive shagun, your relationships will appear here — privately, for your memory.
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  summaryDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  privateNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  privateText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    fontStyle: "italic",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    marginBottom: 12,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardLeft: {},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  contactName: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  lastEvent: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  amounts: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  amtItem: {
    gap: 2,
  },
  amtLabel: {
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  amtValue: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
  },
  amtDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  cardRight: {
    alignItems: "flex-end",
  },
  suggestBadge: {
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    gap: 2,
  },
  suggestLabel: {
    fontSize: 9,
    fontFamily: "Poppins_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestAmount: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
});
