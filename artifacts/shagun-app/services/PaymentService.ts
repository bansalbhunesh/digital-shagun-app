import { Linking, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";

export interface PaymentDetails {
  amount: number;
  receiverUpiId: string | null;
  receiverName: string;
}

/**
 * PaymentService handles routing to the correct payment method.
 * Right now it uses Option 1 (Direct Peer-to-Peer UPI Intents).
 * In the future, this class can be swapped to use Razorpay or Cashfree SDK.
 */
class PaymentService {
  async processPayment(details: PaymentDetails): Promise<boolean> {
    if (!details.receiverUpiId) {
      // For MVP: Treat as "success" if there is no UPI ID, just logging it internally.
      // But we can prompt the user that it's going as an offline ledger entry.
      return new Promise((resolve) => {
        Alert.alert(
          "Offline Shagun",
          `${details.receiverName} hasn't added a UPI ID yet. Do you want to record this transaction in the ledger anyway (assuming you paid in cash/directly)?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            {
              text: "Record Offline",
              style: "default",
              onPress: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                resolve(true);
              },
            },
          ]
        );
      });
    }

    if (Platform.OS === "web") {
      Alert.alert("Notice", "UPI payments are only supported on mobile devices.");
      return false;
    }

    const { amount, receiverUpiId, receiverName } = details;
    
    // The strict UPI deep-link format
    const upiUrl = `upi://pay?pa=${receiverUpiId}&pn=${encodeURIComponent(receiverName)}&am=${amount}&cu=INR`;

    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      
      if (!canOpen) {
        Alert.alert("No UPI App", "We couldn't find a UPI app like GPay or PhonePe on your device.");
        return false;
      }

      await Linking.openURL(upiUrl);
      
      // Since `upi://` is a deep link and doesn't return automatic webhooks for Peer-to-Peer,
      // we must rely on the user visually confirming if the transaction was completed.
      // (When Option 2 is implemented, this manual alert will be removed).
      return new Promise((resolve) => {
        Alert.alert(
          "Payment Status",
          "Did you successfully complete the UPI payment in your app?",
          [
            { text: "No, it failed", style: "cancel", onPress: () => resolve(false) },
            { text: "Yes, Paid successfully", style: "default", onPress: () => resolve(true) },
          ]
        );
      });
      
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not initiate payment.");
      return false;
    }
  }
}

export default new PaymentService();
