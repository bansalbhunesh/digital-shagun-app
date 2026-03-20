import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useCurrentUser, LedgerEntry, formatINR } from "@/context/AppContext";
import { useInfiniteQuery } from "@tanstack/react-query";
import { customFetch } from "@/lib/apiClient";

function LedgerCard({
  entry,
  onPress,
  onSend,
}: {
  entry: LedgerEntry;
  onPress: () => void;
  onSend: () => void;
}) {
  const balance = entry.totalGiven - entry.totalReceived;
  const isPositive = balance >= 0;
  const initials = entry.contactName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardLeft}>
        <View
          style={[styles.avatar, { backgroundColor: isPositive ? Colors.primary : Colors.gold }]}
        >
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
              ₹{formatINR(entry.totalGiven)}
            </Text>
          </View>
          <View style={styles.amtDivider} />
          <View style={styles.amtItem}>
            <Text style={styles.amtLabel}>Received</Text>
            <Text style={[styles.amtValue, { color: Colors.primary }]}>
              ₹{formatINR(entry.totalReceived)}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed]}
          onPress={(e) => {
            e.stopPropagation();
            onSend();
          }}
        >
          <Feather name="send" size={12} color={Colors.primary} />
          <Text style={styles.sendBtnText}>Send Shagun</Text>
        </Pressable>
      </View>

      <View style={styles.cardRight}>
        <View
          style={[
            styles.suggestBadge,
            { backgroundColor: isPositive ? Colors.successLight : Colors.cream },
          ]}
        >
          <Text
            style={[
              styles.suggestLabel,
              { color: isPositive ? Colors.success : Colors.textSecondary },
            ]}
          >
            Suggest
          </Text>
          <Text
            style={[styles.suggestAmount, { color: isPositive ? Colors.success : Colors.primary }]}
          >
            ₹{formatINR(entry.suggestedAmount)}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={Colors.textLight} style={{ marginTop: 8 }} />
      </View>
    </Pressable>
  );
}

export default function LedgerScreen() {
  const currentUser = useCurrentUser();
  const insets = useSafeAreaInsets();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading,
    refetch,
    isRefetching: refreshing,
  } = useInfiniteQuery({
    queryKey: ["ledger", currentUser.id],
    queryFn: ({ pageParam = 0 }) =>
      customFetch<{ data: LedgerEntry[]; nextCursor: number | null }>(
        `/api/ledger/${currentUser.id}?page=${pageParam}&limit=15`
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!currentUser.id,
    initialPageParam: 0,
  });

  const entries = data?.pages.flatMap((page) => page.data) ?? [];
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

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
          <Text style={styles.summaryValue}>₹{formatINR(totalGiven)}</Text>
          <Text style={styles.summaryLabel}>Blessings Given</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.gold }]}>
            ₹{formatINR(totalReceived)}
          </Text>
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
          keyExtractor={(item) => item.contactId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListFooterComponent={
            <View style={{ height: 100, alignItems: "center", justifyContent: "center" }}>
              {isFetchingNextPage && <ActivityIndicator color={Colors.primary} />}
            </View>
          }
          renderItem={({ item }) => (
            <LedgerCard
              entry={item}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: "/ledger-detail/[contactId]",
                  params: { contactId: item.contactId, name: item.contactName },
                });
              }}
              onSend={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({
                  pathname: "/send-direct",
                  params: { receiverName: item.contactName, receiverId: item.contactId },
                });
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
                When you give or receive shagun, your relationships will appear here — privately,
                for your memory.
              </Text>
            </View>
          }
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
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    backgroundColor: Colors.primary + "10",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: Colors.primary + "25",
  },
  sendBtnPressed: { opacity: 0.7 },
  sendBtnText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.primary,
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
