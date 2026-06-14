// Auth store — React Context + reducer (no extra state library).
//
// Holds the session: status (loading | auth | unauth) and the current user.
// Bootstraps on launch (stored token -> getMe -> connect socket), and exposes
// login()/logout(). It wires session.onAuthFailure to a local teardown so a failed
// token refresh (deep inside the http layer) routes the user back to auth.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { Platform } from "react-native";
import { authApi } from "./api";
import { getMe } from "./api/users";
import { User } from "./types";
import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
} from "./storage";
import { setCurrentUserId, setOnAuthFailure } from "./session";
import * as socket from "./socket";
import { registerForPush, unregisterFromPush } from "./push";

// Web keeps the session in an HttpOnly cookie (nothing stored client-side);
// native stores the tokens and sends them in the Authorization header.
const isWeb = Platform.OS === "web";

type Status = "loading" | "auth" | "unauth";

type State = { status: Status; currentUser: User | null };

type Action =
  | { type: "READY"; user: User | null }
  | { type: "LOGIN"; user: User }
  | { type: "SET_USER"; user: User }
  | { type: "LOGOUT" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "READY":
      return action.user
        ? { status: "auth", currentUser: action.user }
        : { status: "unauth", currentUser: null };
    case "LOGIN":
      return { status: "auth", currentUser: action.user };
    case "SET_USER":
      return { ...state, currentUser: action.user };
    case "LOGOUT":
      return { status: "unauth", currentUser: null };
    default:
      return state;
  }
}

interface AuthContextValue {
  status: Status;
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    status: "loading",
    currentUser: null,
  });

  // Local teardown only (no network) — used by both logout() and onAuthFailure.
  const applyLocalLogout = useCallback(() => {
    socket.disconnect();
    setCurrentUserId(null);
    dispatch({ type: "LOGOUT" });
  }, []);

  // Route back to auth when a token refresh fails inside the http layer.
  useEffect(() => {
    setOnAuthFailure(applyLocalLogout);
    return () => setOnAuthFailure(null);
  }, [applyLocalLogout]);

  // Bootstrap on launch. Native gates on a stored token; web has no client-side
  // token, so it just asks getMe() — the cookie (if any) authenticates it.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!isWeb && !(await getAccessToken())) {
        if (active) dispatch({ type: "READY", user: null });
        return;
      }
      try {
        const user = await getMe(); // transparently refreshes if access expired
        setCurrentUserId(user._id);
        const fresh = isWeb ? undefined : (await getAccessToken()) ?? undefined;
        socket.connect(fresh);
        if (active) dispatch({ type: "READY", user });
        registerForPush(); // best-effort; no-ops when push is unavailable
      } catch {
        await clearTokens();
        setCurrentUserId(null);
        if (active) dispatch({ type: "READY", user: null });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken, user } = await authApi.login(
      email,
      password
    );
    // Web is now authenticated by the cookie the server just set; only native
    // persists the tokens for its Authorization-header requests.
    if (!isWeb) await saveTokens({ accessToken, refreshToken });
    setCurrentUserId(user._id);
    socket.connect(isWeb ? undefined : accessToken);
    dispatch({ type: "LOGIN", user });
    registerForPush(); // best-effort; no-ops when push is unavailable
  }, []);

  const logout = useCallback(async () => {
    await unregisterFromPush(); // while still authenticated, so the call is accepted
    try {
      // Web sends nothing — the cookie carries the refresh token; native sends it.
      const refreshToken = isWeb ? undefined : (await getRefreshToken()) ?? undefined;
      await authApi.logout(refreshToken);
    } catch {
      /* best-effort; tear down locally regardless */
    }
    await clearTokens();
    applyLocalLogout();
  }, [applyLocalLogout]);

  const setCurrentUser = useCallback((user: User) => {
    dispatch({ type: "SET_USER", user });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      currentUser: state.currentUser,
      isAuthenticated: state.status === "auth",
      login,
      logout,
      setCurrentUser,
    }),
    [state.status, state.currentUser, login, logout, setCurrentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// The logged-in user's id (= their readable userId), for "is this mine?" checks.
export function useMyId(): string | null {
  return useContext(AuthContext)?.currentUser?._id ?? null;
}
