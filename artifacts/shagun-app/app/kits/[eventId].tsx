import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, Kit } from "@/context/AppContext";

function KitCard({ kit, onAdd, adding }: { kit: Kit; onAdd: () => void; adding: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.kitCard, { borderTopColor: kit.color }]}>
      <Pressable
        style={styles.kitHeader}
        onPress={() => setExpanded(v => !v)}
      >
        <View style={[styles.kitEmojiContainer, { backgroundColor: kit.color + "22" }]}>
          <Text style={styles.kitEmoji}>{kit.emoji}</Text>
        </View>
        <View style={styles.kitHeaderBody}>
          <Text style={styles.kitName}>{kit.name}</Text>
          <Text style={styles.kitDesc} numberOfLines={1}>{kit.description}</Text>
          <View style={styles.kitMeta}>
            <Text style={styles.kitItemCount}>{kit.items.length} items</Text>
            <Text style={styles.kitSep}>•</Text>
            <Text style={styles.kitTotal}>₹{kit.totalAmount.toLocaleString("en-IN")}</Text>
          </View>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={Colors.textLight}
        />
      </Pressable>

      {expanded && (
        <View style={styles.kitItems}>
          {kit.items.map((item, i) => (
            <View key={i} style={styles.kitItem}>
              <Text style={styles.kitItemEmoji}>{item.imageEmoji}</Text>
              <View style={styles.kitItemBody}>
                <Text style={styles.kitItemName}>{item.name}</Text>
                <Text style={styles.kitItemCat}>{item.category}</Text>
              </View>
              <Text style={styles.kitItemAmt}>₹{item.targetAmount.toLocaleString("en-IN")}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.addKitBtn, { backgroundColor: kit.color }, pressed && styles.btnPressed]}
        onPress={onAdd}
        disabled={adding}
      >
        {adding ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <>
            <Feather name="plus" size={16} color={Colors.white} />
            <Text style={styles.addKitBtnText}>Add {kit.name}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default function KitsScreen() {
  const { eventId, eventType } = useLocalSearchParams<{ eventId: string; eventType: string }>();
  const { getKits, addKitToEvent } = useApp();
  const insets = useSafeAreaInsets();
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedKits, setAddedKits] = useState<Set<string>>(new Set());
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    try {
      const all = await getKits(eventType);
      setKits(all);
    } finally {
      setLoading(false);
    }
  }, [getKits, eventType]);

  useEffect(() => { load(); }, [load]);

  const handleAddKit = async (kit: Kit) => {
    if (!eventId) return;
    setAdding(kit.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const result = await addKitToEvent(eventId, kit.id);
      setAddedKits(prev => new Set([...prev, kit.id]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        `${kit.emoji} Kit Added!`,
        `${result.itemsAdded} items from "${kit.name}" have been added to your gift registry.`,
        [{ text: "Great!" }]
      );
    } catch {
      Alert.alert("Error", "Could not add kit. Please try again.");
    } finally {
      setAdding(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Gift Kits</Text>
          <Text style={styles.headerSub}>Curated bundles for celebrations</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.heroBanner}>
        <View style={styles.heroBannerIcon}>
          <Text style={styles.heroBannerEmoji}>🎁</Text>
        </View>
        <View style={styles.heroBannerBody}>
          <Text style={styles.heroBannerTitle}>Smart Bundles</Text>
          <Text style={styles.heroBannerText}>
            Add a curated kit — guests can contribute to any item. Perfect for life's big moments.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {kits.map(kit => (
            <View key={kit.id} style={{ position: "relative" }}>
              {addedKits.has(kit.id) && (
                <View style={styles.addedOverlay}>
                  <Feather name="check-circle" size={18} color={Colors.success} />
                  <Text style={styles.addedOverlayText}>Added to Registry</Text>
                </View>
              )}
              <KitCard
                kit={kit}
                onAdd={() => handleAddKit(kit)}
                adding={adding === kit.id}
              />
            </View>
          ))}
          <Text style={styles.footerNote}>
            All amounts in Indian Rupees. Guests contribute any amount to any item.
          </Text>
          <View style={{ height: 60 }} />
        </ScrollView>
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
    textAlign: "center",
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
  },
  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.primary,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    marginBottom: 8,
  },
  heroBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBannerEmoji: {
    fontSize: 24,
  },
  heroBannerBody: {
    flex: 1,
  },
  heroBannerTitle: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
    marginBottom: 2,
  },
  heroBannerText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: 20,
    gap: 14,
  },
  kitCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    overflow: "hidden",
    borderTopWidth: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  kitHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  kitEmojiContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  kitEmoji: {
    fontSize: 26,
  },
  kitHeaderBody: {
    flex: 1,
    gap: 2,
  },
  kitName: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  kitDesc: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  kitMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  kitItemCount: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textSecondary,
  },
  kitSep: {
    color: Colors.border,
  },
  kitTotal: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  kitItems: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
  },
  kitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  kitItemEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  kitItemBody: {
    flex: 1,
  },
  kitItemName: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.text,
  },
  kitItemCat: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  kitItemAmt: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  addKitBtn: {
    margin: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  addKitBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
  },
  addedOverlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.success + "40",
  },
  addedOverlayText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.success,
  },
  footerNote: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
    fontStyle: "italic",
    paddingTop: 8,
  },
});
