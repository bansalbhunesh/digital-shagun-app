import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, ActivityIndicator, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { useCreateEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const EVENT_TYPES = [
  { key: "wedding", emoji: "💍", label: "Shaadi", desc: "Wedding" },
  { key: "baby_ceremony", emoji: "👶", label: "Namkaran", desc: "Baby Ceremony" },
  { key: "housewarming", emoji: "🏠", label: "Griha Pravesh", desc: "Housewarming" },
  { key: "birthday", emoji: "🎂", label: "Birthday", desc: "Birthday" },
  { key: "festival", emoji: "🪔", label: "Utsav", desc: "Festival" },
] as const;

export default function CreateEventScreen() {
  const { user } = useApp();
  const queryClient = useQueryClient();
  const { mutateAsync: createEvent } = useCreateEvent();
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState<string>("wedding");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string; shareCode: string } | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleCreate = async () => {
    if (!title.trim()) { setError("Please enter event title"); return; }
    if (!date.trim()) { setError("Please enter event date"); return; }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const event = await createEvent({
        data: {
          title: title.trim(),
          type: selectedType as any,
          date: date.trim(),
          venue: venue.trim() || undefined,
          description: description.trim() || undefined,
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess({ id: event.id, shareCode: event.shareCode });
    } catch {
      setError("Failed to create event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successEmoji}>🎉</Text>
          </View>
          <Text style={styles.successTitle}>Event Created!</Text>
          <Text style={styles.successText}>Share this code with your guests</Text>

          <View style={styles.codeCard}>
            <Text style={styles.codePre}>Event Code</Text>
            <Text style={styles.codeValue}>{success.shareCode}</Text>
            <Text style={styles.codeHint}>Guests can join by entering this code</Text>
          </View>

          <View style={styles.successActions}>
            <Pressable
              style={({ pressed }) => [styles.successBtn, pressed && styles.btnPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: "/event/[id]", params: { id: success.id } });
              }}
            >
              <Feather name="eye" size={18} color={Colors.cream} />
              <Text style={styles.successBtnText}>View Event</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.successBtnOutline, pressed && styles.btnPressed]}
              onPress={() => router.back()}
            >
              <Text style={styles.successBtnOutlineText}>Done</Text>
            </Pressable>
          </View>
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
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Celebration Type</Text>
        <View style={styles.typeGrid}>
          {EVENT_TYPES.map(t => (
            <Pressable
              key={t.key}
              style={({ pressed }) => [
                styles.typeCard,
                selectedType === t.key && styles.typeCardSelected,
                pressed && styles.typeCardPressed,
              ]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedType(t.key); }}
            >
              <Text style={styles.typeEmoji}>{t.emoji}</Text>
              <Text style={[styles.typeLabel, selectedType === t.key && styles.typeLabelSelected]}>{t.label}</Text>
              <Text style={[styles.typeDesc, selectedType === t.key && styles.typeDescSelected]}>{t.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Event Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Event Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sharma Ji Ki Shaadi"
            placeholderTextColor={Colors.textLight}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Date *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 15 March 2025"
            placeholderTextColor={Colors.textLight}
            value={date}
            onChangeText={setDate}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Venue</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Birla Auditorium, Jaipur"
            placeholderTextColor={Colors.textLight}
            value={venue}
            onChangeText={setVenue}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Message to Guests</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="A personal message for your guests..."
            placeholderTextColor={Colors.textLight}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.createBtn, pressed && styles.btnPressed]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.cream} />
          ) : (
            <>
              <Feather name="check-circle" size={20} color={Colors.cream} />
              <Text style={styles.createBtnText}>Create Celebration</Text>
            </>
          )}
        </Pressable>

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
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  typeCard: {
    width: "30%",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "0A",
  },
  typeCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  typeEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  typeLabel: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.text,
    textAlign: "center",
  },
  typeLabelSelected: {
    color: Colors.primary,
  },
  typeDesc: {
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
  },
  typeDescSelected: {
    color: Colors.primaryLight,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    color: Colors.text,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    marginBottom: 12,
  },
  createBtn: {
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
    marginTop: 8,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  createBtnText: {
    color: Colors.cream,
    fontSize: 17,
    fontFamily: "Poppins_600SemiBold",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  successEmoji: {
    fontSize: 44,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: Colors.text,
  },
  successText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  codeCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 6,
    width: "100%",
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  codePre: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 40,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
    letterSpacing: 6,
  },
  codeHint: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.textLight,
    textAlign: "center",
  },
  successActions: {
    width: "100%",
    gap: 12,
  },
  successBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  successBtnText: {
    color: Colors.cream,
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
  },
  successBtnOutline: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  successBtnOutlineText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
  },
});
