import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// A small inline alert banner for form-level errors (network, 401, 409, 5xx, …).
// Field-level 422 errors render on the individual TextFields instead.
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View
      className="flex-row items-center gap-2 rounded-2xl px-3 py-2.5"
      style={{ backgroundColor: "#FEE2E2" }}
    >
      <Ionicons name="alert-circle" size={18} color="#EF4444" />
      <Text className="flex-1 text-sm font-medium text-danger">{message}</Text>
    </View>
  );
}
