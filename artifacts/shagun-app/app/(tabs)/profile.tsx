import React from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function ProfileScreen() {
  const { user, logout } = useApp();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={[styles.bigAvatar, { backgroundColor: user?.avatarColor ?? Colors.primary }]}>
            <Text style={styles.bigAvatarText}>
              {(user?.name ?? "G").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profilePhone}>{user?.phone}</Text>
          <View style={styles.goldenBadge}>
            <Feather name="star" size={12} color={Colors.gold} />
            <Text style={styles.goldenBadgeText}>Shagun Member</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Account</Text>
          {[
            { icon: "calendar", label: "My Events", sub: "View all your celebrations", onPress: () => router.push("/(tabs)/events") },
            { icon: "heart", label: "Blessings Ledger", sub: "Track gift relationships", onPress: () => router.push("/(tabs)/ledger") },
            { icon: "plus-circle", label: "Create Event", sub: "Host a new celebration", onPress: () => router.push("/create-event") },
            { icon: "users", label: "Join Event", sub: "Scan or enter code", onPress: () => router.push("/join-event") },
          ].map((item, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={item.onPress}
            >
              <View style={styles.menuIcon}>
                <Feather name={item.icon as any} size={18} color={Colors.primary} />
              </View>
              <View style={styles.menuBody}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textLight} />
            </Pressable>
          ))}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>About</Text>
          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>Digital Shagun Platform</Text>
            <Text style={styles.aboutText}>
              Shagun is India's first social gifting platform designed to preserve the emotional tradition of shagun across celebrations — with cultural warmth and digital convenience.
            </Text>
            <View style={styles.aboutDivider} />
            <View style={styles.aboutStats}>
              <View style={styles.aboutStat}>
                <Text style={styles.aboutStatValue}>🔒</Text>
                <Text style={styles.aboutStatLabel}>Private & Secure</Text>
              </View>
              <View style={styles.aboutStat}>
                <Text style={styles.aboutStatValue}>❤️</Text>
                <Text style={styles.aboutStatLabel}>Relationship-first</Text>
              </View>
              <View style={styles.aboutStat}>
                <Text style={styles.aboutStatValue}>🇮🇳</Text>
                <Text style={styles.aboutStatLabel}>Built for India</Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
    paddingTop: 16,
    paddingBottom: 20,
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 8,
  },
  bigAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.gold,
    marginBottom: 4,
  },
  bigAvatarText: {
    color: Colors.white,
    fontSize: 32,
    fontFamily: "Poppins_700Bold",
  },
  profileName: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  profilePhone: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  goldenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.gold + "22",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  goldenBadgeText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.goldDark,
  },
  menuSection: {
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  menuItem: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItemPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  menuBody: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
  },
  menuSub: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
  },
  aboutCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  aboutTitle: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  aboutText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  aboutStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  aboutStat: {
    alignItems: "center",
    gap: 4,
  },
  aboutStatValue: {
    fontSize: 22,
  },
  aboutStatLabel: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.errorLight,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.error + "30",
  },
  logoutBtnPressed: {
    opacity: 0.8,
  },
  logoutText: {
    color: Colors.error,
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
  },
});
