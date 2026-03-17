import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ScrollView, ActivityIndicator, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, EventGift } from "@/context/AppContext";

const PREDEFINED_GIFTS = [
  { name: "Microwave Oven", category: "Kitchen", emoji: "📦", amount: 8000 },
  { name: "Mixer Grinder", category: "Kitchen", emoji: "🥣", amount: 4500 },
  { name: "Air Fryer", category: "Kitchen", emoji: "🍳", amount: 6000 },
  { name: "Toaster", category: "Kitchen", emoji: "🍞", amount: 2500 },
  { name: "Pressure Cooker", category: "Kitchen", emoji: "🫕", amount: 3000 },
  { name: "Smart TV", category: "Home", emoji: "📺", amount: 35000 },
  { name: "Washing Machine", category: "Home", emoji: "🫧", amount: 25000 },
  { name: "Refrigerator", category: "Home", emoji: "🧊", amount: 30000 },
  { name: "Sofa Set", category: "Home", emoji: "🛋️", amount: 20000 },
  { name: "Bed & Mattress", category: "Home", emoji: "🛏️", amount: 15000 },
  { name: "Air Conditioner", category: "Home", emoji: "❄️", amount: 38000 },
  { name: "Dining Table Set", category: "Home", emoji: "🪑", amount: 18000 },
  { name: "Honeymoon Fund", category: "Lifestyle", emoji: "✈️", amount: 50000 },
  { name: "Car Fund", category: "Lifestyle", emoji: "🚗", amount: 100000 },
  { name: "Travel Fund", category: "Lifestyle", emoji: "🌍", amount: 30000 },
  { name: "Home Décor Fund", category: "Lifestyle", emoji: "🏺", amount: 15000 },
  { name: "Gold Savings", category: "Lifestyle", emoji: "💰", amount: 50000 },
  { name: "Study Lamp", category: "Study", emoji: "💡", amount: 2000 },
  { name: "Laptop Stand", category: "Study", emoji: "💻", amount: 3000 },
  { name: "Water Purifier", category: "Health", emoji: "💧", amount: 12000 },
] as const;

const CATEGORIES = ["All", "Kitchen", "Home", "Lifestyle", "Study", "Health"];

export default function GiftRegistryScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { getEventGifts, addGiftToRegistry } = useApp();
  const insets = useSafeAreaInsets();
  const [gifts, setGifts] = useState<EventGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await getEventGifts(eventId);
      setGifts(data);
    } finally {
      setLoading(false);
    }
  }, [eventId, getEventGifts]);

  useEffect(() => { load(); }, [load]);

  const addedIds = gifts.map(g => g.name);
  const filteredPredefined = PREDEFINED_GIFTS.filter(g =>
    (selectedCategory === "All" || g.category === selectedCategory) && !addedIds.includes(g.name)
  );

  const handleAdd = async (gift: typeof PREDEFINED_GIFTS[number]) => {
    if (!eventId) return;
    setAdding(gift.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const newGift = await addGiftToRegistry(eventId, {
        name: gift.name,
        category: gift.category,
        targetAmount: gift.amount,
        imageEmoji: gift.emoji,
      });
      setGifts(prev => [...prev, newGift]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        <Text style={styles.headerTitle}>Gift Registry</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {gifts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Added to Registry ({gifts.length})</Text>
            {gifts.map(g => (
              <View key={g.id} style={styles.addedGiftCard}>
                <Text style={styles.addedEmoji}>{g.imageEmoji}</Text>
                <View style={styles.addedBody}>
                  <Text style={styles.addedName}>{g.name}</Text>
                  <View style={styles.progressRow}>
                    <View style={styles.progressBg}>
                      <View style={[
                        styles.progressFill,
                        { width: `${Math.min((g.currentAmount / g.targetAmount) * 100, 100)}%` as any }
                      ]} />
                    </View>
                    <Text style={styles.progressText}>
                      ₹{g.currentAmount.toLocaleString("en-IN")} / ₹{g.targetAmount.toLocaleString("en-IN")}
                    </Text>
                  </View>
                </View>
                {g.isFullyFunded && (
                  <Feather name="check-circle" size={20} color={Colors.success} />
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Gifts</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat}
                style={[styles.catChip, selectedCategory === cat && styles.catChipSelected]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextSelected]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filteredPredefined.map(gift => (
            <Pressable
              key={gift.name}
              style={({ pressed }) => [styles.giftOption, pressed && styles.cardPressed]}
              onPress={() => handleAdd(gift)}
              disabled={adding === gift.name}
            >
              <View style={styles.giftOptionLeft}>
                <Text style={styles.giftOptionEmoji}>{gift.emoji}</Text>
                <View style={styles.giftOptionBody}>
                  <Text style={styles.giftOptionName}>{gift.name}</Text>
                  <Text style={styles.giftOptionCategory}>{gift.category}</Text>
                </View>
              </View>
              <View style={styles.giftOptionRight}>
                <Text style={styles.giftOptionAmount}>₹{gift.amount.toLocaleString("en-IN")}</Text>
                {adding === gift.name ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <View style={styles.addBtn}>
                    <Feather name="plus" size={14} color={Colors.cream} />
                  </View>
                )}
              </View>
            </Pressable>
          ))}

          {filteredPredefined.length === 0 && (
            <Text style={styles.allAddedText}>All gifts in this category have been added!</Text>
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
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
  section: {
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  addedGiftCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  addedEmoji: {
    fontSize: 28,
  },
  addedBody: {
    flex: 1,
    gap: 6,
  },
  addedName: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  progressRow: {
    gap: 4,
  },
  progressBg: {
    height: 6,
    backgroundColor: Colors.cream,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.textSecondary,
  },
  catScroll: {
    marginBottom: 4,
  },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  catChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catChipText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.textSecondary,
  },
  catChipTextSelected: {
    color: Colors.cream,
  },
  giftOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  giftOptionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  giftOptionEmoji: {
    fontSize: 28,
  },
  giftOptionBody: {
    flex: 1,
  },
  giftOptionName: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  giftOptionCategory: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  giftOptionRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  giftOptionAmount: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  allAddedText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
    paddingVertical: 24,
    fontStyle: "italic",
  },
});
