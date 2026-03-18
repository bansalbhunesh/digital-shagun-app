import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable,
  ScrollView, ActivityIndicator, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp, EventGift } from "@/context/AppContext";

const CURATED_GIFTS = [
  { name: "Microwave Oven",        category: "Kitchen",         emoji: "📦", amount: 8000,  desc: "Multi-function 25L convection" },
  { name: "Mixer Grinder",         category: "Kitchen",         emoji: "🥣", amount: 4500,  desc: "750W with 3 jars" },
  { name: "Air Fryer",             category: "Kitchen",         emoji: "🍳", amount: 6000,  desc: "5-litre digital panel" },
  { name: "Pressure Cooker Set",   category: "Kitchen",         emoji: "🫕", amount: 3500,  desc: "3L + 5L stainless steel" },
  { name: "Induction Cooktop",     category: "Kitchen",         emoji: "🔥", amount: 3000,  desc: "2000W with auto-off" },
  { name: "Electric Kettle",       category: "Kitchen",         emoji: "☕", amount: 1500,  desc: "1.7L stainless steel" },
  { name: "Non-Stick Cookware Set",category: "Kitchen",         emoji: "🍲", amount: 4000,  desc: "5-piece granite coated" },
  { name: "Dishwasher",            category: "Kitchen",         emoji: "🫧", amount: 22000, desc: "8-place settings, freestanding" },

  { name: "Smart TV 43\"",         category: "Home & Living",   emoji: "📺", amount: 32000, desc: "4K UHD Android TV" },
  { name: "Washing Machine",       category: "Home & Living",   emoji: "🌀", amount: 24000, desc: "7kg fully automatic" },
  { name: "Refrigerator",          category: "Home & Living",   emoji: "🧊", amount: 28000, desc: "265L frost-free" },
  { name: "Sofa Set",              category: "Home & Living",   emoji: "🛋️", amount: 20000, desc: "L-shaped 5-seater fabric" },
  { name: "Bed & Mattress",        category: "Home & Living",   emoji: "🛏️", amount: 16000, desc: "Queen-size orthopaedic" },
  { name: "Air Conditioner",       category: "Home & Living",   emoji: "❄️", amount: 36000, desc: "1.5 Ton 5-star inverter" },
  { name: "Dining Table Set",      category: "Home & Living",   emoji: "🪑", amount: 18000, desc: "6-seater solid wood" },
  { name: "Curtains & Blinds Set", category: "Home & Living",   emoji: "🪟", amount: 5000,  desc: "Blackout for 3 rooms" },

  { name: "Laptop",                category: "Electronics",     emoji: "💻", amount: 55000, desc: "Core i5, 16GB RAM, SSD" },
  { name: "Smartphone",            category: "Electronics",     emoji: "📱", amount: 25000, desc: "Latest model flagship" },
  { name: "Tablet",                category: "Electronics",     emoji: "📲", amount: 18000, desc: "10-inch, Wi-Fi + cellular" },
  { name: "Bluetooth Speaker",     category: "Electronics",     emoji: "🔊", amount: 3000,  desc: "Waterproof, 20hr battery" },
  { name: "Smartwatch",            category: "Electronics",     emoji: "⌚", amount: 8000,  desc: "Health tracking, GPS" },
  { name: "Robot Vacuum",          category: "Electronics",     emoji: "🤖", amount: 15000, desc: "Auto-mapping, app control" },
  { name: "Water Purifier",        category: "Electronics",     emoji: "💧", amount: 12000, desc: "RO+UV, 7-stage filtration" },

  { name: "Baby Cot & Mattress",   category: "Baby & Kids",     emoji: "🛏️", amount: 8000,  desc: "Convertible, with storage" },
  { name: "Baby Monitor",          category: "Baby & Kids",     emoji: "📹", amount: 5000,  desc: "Video + audio, night vision" },
  { name: "Stroller / Pram",       category: "Baby & Kids",     emoji: "🍼", amount: 9000,  desc: "Travel system, foldable" },
  { name: "Baby Swing",            category: "Baby & Kids",     emoji: "🌙", amount: 4000,  desc: "Motorised, 6 speeds" },
  { name: "Learning Toys Set",     category: "Baby & Kids",     emoji: "🧸", amount: 3000,  desc: "Montessori 0–3 years" },
  { name: "Baby Wardrobe Set",     category: "Baby & Kids",     emoji: "👕", amount: 3500,  desc: "50-piece seasonal clothing" },

  { name: "Honeymoon Fund",        category: "Lifestyle",       emoji: "✈️", amount: 50000, desc: "Travel gift towards your trip" },
  { name: "Car Fund",              category: "Lifestyle",       emoji: "🚗", amount: 100000,desc: "Contribution toward a new car" },
  { name: "Gold Savings Fund",     category: "Lifestyle",       emoji: "💰", amount: 50000, desc: "Invest in gold for the future" },
  { name: "Home Décor Fund",       category: "Lifestyle",       emoji: "🏺", amount: 15000, desc: "Curate your dream home" },
  { name: "Book Collection",       category: "Lifestyle",       emoji: "📚", amount: 5000,  desc: "50+ bestsellers curated" },
  { name: "Gym Membership",        category: "Lifestyle",       emoji: "💪", amount: 12000, desc: "1-year premium fitness" },

  { name: "Treadmill",             category: "Health",          emoji: "🏃", amount: 22000, desc: "Motorised, 12 programs" },
  { name: "Yoga Mat & Accessories",category: "Health",          emoji: "🧘", amount: 2500,  desc: "Premium set with blocks" },
  { name: "Air Purifier",          category: "Health",          emoji: "🌬️", amount: 10000, desc: "HEPA H13, 500 sqft coverage" },

  { name: "LED Diyas & Lights Set",category: "Festival & Décor",emoji: "🪔", amount: 3000,  desc: "300-piece festive decor set" },
  { name: "Puja Room Makeover",    category: "Festival & Décor",emoji: "🙏", amount: 8000,  desc: "Marble mandir + accessories" },
  { name: "Garden Furniture Set",  category: "Festival & Décor",emoji: "🌿", amount: 12000, desc: "4-seater outdoor dining" },
] as const;

type GiftItem = typeof CURATED_GIFTS[number];

const CATEGORIES = ["All", "Kitchen", "Home & Living", "Electronics", "Baby & Kids", "Lifestyle", "Health", "Festival & Décor"];
const MAX_REGISTRY = 10;
const IDEAL_MIN = 8;

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(pct, 100);
  return (
    <View style={pbStyles.track}>
      <View style={[pbStyles.fill, { width: `${clamped}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const pbStyles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: Colors.cream,
    borderRadius: 4,
    overflow: "hidden",
    flex: 1,
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
});

export default function GiftRegistryScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { getEventGifts, addGiftToRegistry } = useApp();
  const insets = useSafeAreaInsets();
  const [gifts, setGifts] = useState<EventGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [tab, setTab] = useState<"registry" | "catalog">("catalog");
  const [isLive, setIsLive] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await getEventGifts(eventId);
      setGifts(data);
      if (data.length > 0) setTab("registry");
    } finally {
      setLoading(false);
    }
  }, [eventId, getEventGifts]);

  useEffect(() => { load(); }, [load]);

  // Real-time polling every 10 seconds — shows live updates without manual refresh
  useEffect(() => {
    if (!eventId) return;
    const interval = setInterval(async () => {
      try {
        const data = await getEventGifts(eventId);
        setGifts(data);
        setIsLive(true);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [eventId, getEventGifts]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        getEventGifts(eventId!).then(data => setGifts(data)).catch(() => {});
      }
    }, [eventId, getEventGifts, loading])
  );

  const addedNames = gifts.map(g => g.name);
  const filteredCatalog = CURATED_GIFTS.filter(g =>
    (selectedCategory === "All" || g.category === selectedCategory)
    && !addedNames.includes(g.name)
  );

  const handleAdd = async (gift: GiftItem) => {
    if (!eventId) return;
    if (gifts.length >= MAX_REGISTRY) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
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
      if (gifts.length + 1 >= IDEAL_MIN) setTab("registry");
    } finally {
      setAdding(null);
    }
  };

  const sortedRegistry = [...gifts].sort((a, b) => {
    if (a.isFullyFunded && !b.isFullyFunded) return 1;
    if (!a.isFullyFunded && b.isFullyFunded) return -1;
    const pctA = a.currentAmount / a.targetAmount;
    const pctB = b.currentAmount / b.targetAmount;
    return pctB - pctA;
  });

  const fundedCount = gifts.filter(g => g.isFullyFunded).length;
  const totalTarget = gifts.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalFunded = gifts.reduce((sum, g) => sum + g.currentAmount, 0);

  const getStatusBadge = (g: EventGift) => {
    const pct = g.currentAmount / g.targetAmount;
    if (g.isFullyFunded) return { label: "Funded!", color: Colors.success };
    if (pct >= 0.75) return { label: "Almost!", color: "#E67E22" };
    if (pct >= 0.5) return { label: "Halfway!", color: Colors.gold };
    return null;
  };

  const getProgressColor = (g: EventGift) => {
    const pct = g.currentAmount / g.targetAmount;
    if (g.isFullyFunded) return Colors.success;
    if (pct >= 0.75) return "#E67E22";
    if (pct >= 0.5) return Colors.gold;
    return Colors.primary;
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gift Registry</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isLive && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" }} />
              <Text style={{ fontSize: 10, color: "#22c55e", fontFamily: "Poppins_600SemiBold" }}>LIVE</Text>
            </View>
          )}
          <View style={styles.headerCount}>
            <Text style={styles.headerCountText}>{gifts.length}/{MAX_REGISTRY}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === "registry" && styles.tabActive]}
          onPress={() => setTab("registry")}
        >
          <Text style={[styles.tabText, tab === "registry" && styles.tabTextActive]}>
            Wishlist {gifts.length > 0 ? `(${gifts.length})` : ""}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "catalog" && styles.tabActive]}
          onPress={() => setTab("catalog")}
        >
          <Text style={[styles.tabText, tab === "catalog" && styles.tabTextActive]}>
            Browse 40+ Gifts
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : tab === "registry" ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {gifts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎁</Text>
              <Text style={styles.emptyTitle}>No gifts added yet</Text>
              <Text style={styles.emptyText}>Browse our catalog and add 8–10 gifts{"\n"}your guests can contribute toward</Text>
              <Pressable style={styles.browseCta} onPress={() => setTab("catalog")}>
                <Text style={styles.browseCtaText}>Browse Catalog →</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {gifts.length >= IDEAL_MIN && gifts.length < MAX_REGISTRY && (
                <View style={styles.guidanceBanner}>
                  <Feather name="check-circle" size={16} color={Colors.success} />
                  <Text style={styles.guidanceText}>
                    Great wishlist! You can add up to {MAX_REGISTRY - gifts.length} more gifts.
                  </Text>
                </View>
              )}
              {gifts.length < IDEAL_MIN && (
                <View style={[styles.guidanceBanner, styles.guidanceBannerHint]}>
                  <Text style={styles.guidanceEmoji}>🎁</Text>
                  <Text style={styles.guidanceText}>
                    Add {IDEAL_MIN - gifts.length} more gifts so guests have great choices.
                  </Text>
                  <Pressable onPress={() => setTab("catalog")}>
                    <Text style={styles.guidanceLink}>Browse →</Text>
                  </Pressable>
                </View>
              )}

              {totalTarget > 0 && (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryStat}>
                      <Text style={styles.summaryValue}>
                        ₹{totalFunded.toLocaleString("en-IN")}
                      </Text>
                      <Text style={styles.summaryLabel}>Contributed</Text>
                    </View>
                    <View style={styles.summaryStat}>
                      <Text style={styles.summaryValue}>
                        ₹{totalTarget.toLocaleString("en-IN")}
                      </Text>
                      <Text style={styles.summaryLabel}>Total Goal</Text>
                    </View>
                    <View style={styles.summaryStat}>
                      <Text style={[styles.summaryValue, { color: Colors.success }]}>
                        {fundedCount}/{gifts.length}
                      </Text>
                      <Text style={styles.summaryLabel}>Funded</Text>
                    </View>
                  </View>
                  <View style={styles.overallProgressRow}>
                    <ProgressBar
                      pct={totalTarget > 0 ? (totalFunded / totalTarget) * 100 : 0}
                      color={Colors.gold}
                    />
                    <Text style={styles.overallPct}>
                      {totalTarget > 0 ? Math.round((totalFunded / totalTarget) * 100) : 0}%
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.section}>
                {sortedRegistry.map(g => {
                  const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
                  const badge = getStatusBadge(g);
                  const barColor = getProgressColor(g);
                  const remaining = g.targetAmount - g.currentAmount;

                  return (
                    <View key={g.id} style={[styles.registryCard, g.isFullyFunded && styles.registryCardFunded]}>
                      <View style={styles.registryCardTop}>
                        <Text style={styles.registryEmoji}>{g.imageEmoji}</Text>
                        <View style={styles.registryBody}>
                          <View style={styles.registryTitleRow}>
                            <Text style={styles.registryName} numberOfLines={1}>{g.name}</Text>
                            {badge && (
                              <View style={[styles.badge, { backgroundColor: badge.color + "20" }]}>
                                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.categoryLabel}>{g.category}</Text>
                        </View>
                      </View>

                      <View style={styles.progressSection}>
                        <View style={styles.progressBarRow}>
                          <ProgressBar pct={pct} color={barColor} />
                          <Text style={[styles.pctText, { color: barColor }]}>{Math.round(pct)}%</Text>
                        </View>
                        <View style={styles.amountsRow}>
                          <Text style={styles.raisedText}>
                            ₹{g.currentAmount.toLocaleString("en-IN")} raised
                          </Text>
                          <Text style={styles.targetText}>
                            Goal: ₹{g.targetAmount.toLocaleString("en-IN")}
                          </Text>
                        </View>
                      </View>

                      {!g.isFullyFunded && (
                        <Pressable
                          style={({ pressed }) => [styles.contributeBtn, pressed && styles.btnPressed]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push({
                              pathname: "/contribute-gift",
                              params: {
                                giftId: g.id,
                                giftName: g.name,
                                giftEmoji: g.imageEmoji,
                                remaining: remaining.toString(),
                              },
                            });
                          }}
                        >
                          <Feather name="heart" size={14} color={Colors.primary} />
                          <Text style={styles.contributeBtnText}>
                            Contribute · ₹{remaining.toLocaleString("en-IN")} needed
                          </Text>
                        </Pressable>
                      )}

                      {g.isFullyFunded && (
                        <View style={styles.fundedBanner}>
                          <Feather name="check-circle" size={14} color={Colors.success} />
                          <Text style={styles.fundedText}>Fully funded by guests 🎉</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={{ height: 32 }} />
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.catalogGuidance}>
            <Text style={styles.catalogGuidanceTitle}>
              {gifts.length === 0
                ? "Pick 8–10 gifts for your wishlist"
                : gifts.length < IDEAL_MIN
                ? `${IDEAL_MIN - gifts.length} more recommended (${gifts.length} added)`
                : `${gifts.length} added · ${MAX_REGISTRY - gifts.length} slots left`}
            </Text>
            <Text style={styles.catalogGuidanceSub}>
              {gifts.length >= MAX_REGISTRY
                ? "Wishlist is full. Remove items to add more."
                : "Guests will see these and can contribute any amount"}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
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

          <View style={styles.section}>
            {filteredCatalog.map(gift => {
              const isAtMax = gifts.length >= MAX_REGISTRY;
              return (
                <Pressable
                  key={gift.name}
                  style={({ pressed }) => [
                    styles.catalogCard,
                    isAtMax && styles.catalogCardDisabled,
                    pressed && !isAtMax && styles.cardPressed,
                  ]}
                  onPress={() => handleAdd(gift)}
                  disabled={adding === gift.name || isAtMax}
                >
                  <Text style={styles.catalogEmoji}>{gift.emoji}</Text>
                  <View style={styles.catalogBody}>
                    <Text style={styles.catalogName}>{gift.name}</Text>
                    <Text style={styles.catalogDesc} numberOfLines={1}>{gift.desc}</Text>
                    <View style={styles.catalogMeta}>
                      <Text style={styles.catalogCategory}>{gift.category}</Text>
                      <Text style={styles.catalogAmount}>₹{gift.amount.toLocaleString("en-IN")}</Text>
                    </View>
                  </View>
                  <View style={styles.addBtnWrap}>
                    {adding === gift.name ? (
                      <ActivityIndicator size="small" color={Colors.cream} />
                    ) : (
                      <Feather name={isAtMax ? "lock" : "plus"} size={16} color={Colors.cream} />
                    )}
                  </View>
                </Pressable>
              );
            })}

            {filteredCatalog.length === 0 && (
              <View style={styles.allAddedBox}>
                <Feather name="check-circle" size={24} color={Colors.success} />
                <Text style={styles.allAddedText}>All gifts in this category added!</Text>
              </View>
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
  headerCount: {
    backgroundColor: Colors.primary + "15",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  headerCountText: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textLight,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
    lineHeight: 22,
  },
  browseCta: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  browseCtaText: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: Colors.cream,
  },
  guidanceBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.success + "15",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
  },
  guidanceBannerHint: {
    backgroundColor: Colors.gold + "18",
  },
  guidanceEmoji: {
    fontSize: 16,
  },
  guidanceText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.text,
  },
  guidanceLink: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    margin: 16,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.gold + "30",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryStat: {
    alignItems: "center",
    gap: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  overallProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  overallPct: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.gold,
    width: 36,
    textAlign: "right",
  },
  section: {
    padding: 16,
    gap: 12,
  },
  registryCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  registryCardFunded: {
    borderColor: Colors.success + "50",
    backgroundColor: Colors.success + "08",
  },
  registryCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  registryEmoji: {
    fontSize: 36,
  },
  registryBody: {
    flex: 1,
    gap: 2,
  },
  registryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  registryName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
  },
  categoryLabel: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  progressSection: {
    gap: 6,
  },
  progressBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pctText: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    width: 36,
    textAlign: "right",
  },
  amountsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  raisedText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textSecondary,
  },
  targetText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  contributeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary + "10",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary + "25",
    alignSelf: "flex-start",
  },
  contributeBtnText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.primary,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  fundedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fundedText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.success,
  },
  catalogGuidance: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 18,
    gap: 4,
  },
  catalogGuidanceTitle: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: Colors.goldLight,
  },
  catalogGuidanceSub: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  catScroll: {
    marginTop: 16,
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
  catalogCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  catalogCardDisabled: {
    opacity: 0.45,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  catalogEmoji: {
    fontSize: 32,
  },
  catalogBody: {
    flex: 1,
    gap: 2,
  },
  catalogName: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  catalogDesc: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  catalogMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  catalogCategory: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.textLight,
    backgroundColor: Colors.cream,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catalogAmount: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  addBtnWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  allAddedBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  allAddedText: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: Colors.textLight,
    textAlign: "center",
  },
});
