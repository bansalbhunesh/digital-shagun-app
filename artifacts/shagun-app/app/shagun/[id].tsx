import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_BASE_URL } from "../../lib/apiClient";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { MotiView, MotiText } from "moti";

const { width, height } = Dimensions.get("window");

export default function ShagunRevealPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOpened, setIsOpened] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/shagun/public/${id}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      });
  }, [id]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just received a Shagun blessing from ${data?.senderName}! Check it out here: https://shagun-app.vercel.app/shagun/${id}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  if (loading) return <View style={styles.container}><Text>Loading Blessing...</Text></View>;

  if (!data?.isRevealed) {
    return (
      <View style={styles.container}>
        <BlurView intensity={80} style={styles.lockedContainer}>
          <Ionicons name="lock-closed" size={80} color="#8B1A1A" />
          <Text style={styles.lockedTitle}>A blessing is waiting for you...</Text>
          <Text style={styles.lockedSubtitle}>Will reveal in {Math.floor(data?.secondsRemaining / 60)}m {data?.secondsRemaining % 60}s</Text>
        </BlurView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={styles.envelopeContainer}
      >
        {!isOpened ? (
          <TouchableOpacity onPress={() => setIsOpened(true)} style={styles.envelopeClosed}>
            <View style={styles.seal}>
              <Text style={styles.sealText}>ॐ</Text>
            </View>
            <Text style={styles.tapToOpen}>Tap to reveal your Shagun</Text>
            <Text style={styles.fromText}>From: {data.senderName}</Text>
          </TouchableOpacity>
        ) : (
          <MotiView 
            from={{ rotateY: "90deg" }}
            animate={{ rotateY: "0deg" }}
            transition={{ type: "timing", duration: 800 }}
            style={styles.card}
          >
            <Text style={styles.celebrationText}>Congratulations!</Text>
            <MotiText 
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 500 }}
              style={styles.amount}
            >
              ₹{data.amount}
            </MotiText>
            <View style={styles.divider} />
            <Text style={styles.message}>{data.message || "Best wishes for your special occasion!"}</Text>
            <Text style={styles.senderNameSign}>— {data.senderName}</Text>
            
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-social" size={20} color="white" />
              <Text style={styles.shareButtonText}>Share Blessing</Text>
            </TouchableOpacity>
          </MotiView>
        )}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDF5E6", // Cream background
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  lockedContainer: {
    padding: 40,
    borderRadius: 30,
    alignItems: "center",
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#8B1A1A",
    marginTop: 20,
    textAlign: "center",
  },
  lockedSubtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
  },
  envelopeContainer: {
    width: width * 0.9,
    height: height * 0.6,
    backgroundColor: "#8B1A1A", // Royal Red
    borderRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    overflow: "hidden",
  },
  envelopeClosed: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  seal: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFD700", // Gold
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#B8860B",
    marginBottom: 30,
  },
  sealText: {
    fontSize: 40,
    color: "#8B1A1A",
  },
  tapToOpen: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "600",
  },
  fromText: {
    color: "rgba(255, 215, 0, 0.7)",
    marginTop: 10,
    fontSize: 14,
  },
  card: {
    flex: 1,
    backgroundColor: "white",
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  celebrationText: {
    fontSize: 24,
    color: "#8B1A1A",
    fontWeight: "bold",
    marginBottom: 20,
  },
  amount: {
    fontSize: 60,
    fontWeight: "800",
    color: "#4A5C2A",
    marginBottom: 20,
  },
  divider: {
    width: "60%",
    height: 2,
    backgroundColor: "#FFD700",
    marginBottom: 20,
  },
  message: {
    fontSize: 18,
    fontStyle: "italic",
    textAlign: "center",
    color: "#333",
    lineHeight: 26,
    marginBottom: 30,
  },
  senderNameSign: {
    fontSize: 20,
    fontWeight: "600",
    color: "#8B1A1A",
    marginBottom: 40,
  },
  shareButton: {
    flexDirection: "row",
    backgroundColor: "#8B1A1A",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    alignItems: "center",
    gap: 10,
  },
  shareButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});
