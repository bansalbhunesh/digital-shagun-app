import React from "react";
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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useCurrentUser, formatINR } from "@/context/AppContext";
import { useListEvents, Event } from "@workspace/api-client-react";

const EVENT_TYPE_INFO: Record<string, { emoji: string; label: string; color: string }> = {
  wedding: { emoji: "💍", label: "Shaadi", color: "#8B1A1A" },
  baby_ceremony: { emoji: "👶", label: "Namkaran", color: "#704214" },
  housewarming: { emoji: "🏠", label: "Griha Pravesh", color: "#4A5C2A" },
  birthday: { emoji: "🎂", label: "Birthday", color: "#4A3080" },
  festival: { emoji: "🪔", label: "Festival", color: "#8B5014" },
};

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const typeInfo = EVENT_TYPE_INFO[event.type] ?? {
    emoji: "🎉",
    label: event.type,
    color: Colors.primary,
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.eventCard, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={[styles.eventTypeBar, { backgroundColor: typeInfo.color }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <View style={[styles.emojiContainer, { backgroundColor: typeInfo.color + "22" }]}>
            <Text style={styles.eventEmoji}>{typeInfo.emoji}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.eventTitle} numberOfLines={1}>
              {event.title}
            </Text>
            <Text style={styles.eventSubtitle}>{typeInfo.label}</Text>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.textLight} />
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={13} color={Colors.textLight} />
            <Text style={styles.metaText}>{event.date}</Text>
          </View>
          {event.venue ? (
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={13} color={Colors.textLight} />
              <Text style={styles.metaText} numberOfLines={1}>
                {event.venue}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{formatINR(event.totalReceived ?? 0)}</Text>
            <Text style={styles.statLabel}>Received</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{event.guestCount}</Text>
            <Text style={styles.statLabel}>Guests</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.shareCodeBadge}>
              <Text style={styles.shareCodeText}>{event.shareCode}</Text>
            </View>
            <Text style={styles.statLabel}>Code</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function EventsScreen() {
  const currentUser = useCurrentUser();
  const insets = useSafeAreaInsets();

  const {
    data: events = [],
    isLoading: loading,
    isRefetching: refreshing,
    refetch,
  } = useListEvents(
    { hostId: currentUser.id },
    { query: { enabled: !!currentUser.id, queryKey: ["/api/events", { hostId: currentUser.id }] } }
  );

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const onRefresh = () => refetch();

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Events</Text>
          <Text style={styles.headerSub}>{events.length} celebrations</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.createBtn, pressed && styles.createBtnPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/create-event");
          }}
        >
          <Feather name="plus" size={20} color={Colors.cream} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/event/[id]", params: { id: item.id } });
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Feather name="calendar" size={32} color={Colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.emptyText}>
                Create your first celebration and share it with family & friends
              </Text>
              <Pressable
                style={({ pressed }) => [styles.emptyBtn, pressed && styles.emptyBtnPressed]}
                onPress={() => router.push("/create-event")}
              >
                <Feather name="plus" size={18} color={Colors.cream} />
                <Text style={styles.emptyBtnText}>Create Event</Text>
              </Pressable>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
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
  createBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eventCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 14,
    overflow: "hidden",
    flexDirection: "row",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  eventTypeBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  eventEmoji: {
    fontSize: 22,
  },
  cardInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  eventSubtitle: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  cardStats: {
    flexDirection: "row",
    backgroundColor: Colors.cream,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  shareCodeBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shareCodeText: {
    color: Colors.cream,
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
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
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  emptyBtnText: {
    color: Colors.cream,
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
  },
});
