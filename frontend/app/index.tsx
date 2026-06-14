import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";

// Initial route. The session is bootstrapped in AuthProvider; while it resolves we
// keep the splash up (render nothing), then send the user to the app or to auth.
export default function Index() {
  const { status } = useAuth();
  if (status === "loading") return null;
  return <Redirect href={status === "auth" ? "/(tabs)" : "/(auth)/login"} />;
}
