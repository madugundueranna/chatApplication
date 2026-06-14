// Auth resource. These endpoints establish the session, so they opt out of the
// 401 refresh-retry (a bad login is itself a 401 and must surface, not refresh).

import { http, unwrap } from "../http";
import { mapUser } from "./mappers";
import { User } from "../types";

const skipRefresh = { skipAuthRefresh: true };

export async function register(
  name: string,
  email: string,
  password: string
): Promise<{ userId: string }> {
  const res = await http.post(
    "/auth/register",
    { name, email, password },
    skipRefresh
  );
  return unwrap(res);
}

export async function verifyOtp(email: string, code: string): Promise<void> {
  await http.post("/auth/verify-otp", { email, code }, skipRefresh);
}

export async function resendOtp(email: string): Promise<void> {
  await http.post("/auth/resend-otp", { email }, skipRefresh);
}

export async function forgotPassword(email: string): Promise<void> {
  await http.post("/auth/forgot-password", { email }, skipRefresh);
}

export async function resetPassword(
  email: string,
  code: string,
  password: string
): Promise<void> {
  await http.post("/auth/reset-password", { email, code, password }, skipRefresh);
}

export async function login(
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string; user: User }> {
  const res = await http.post("/auth/login", { email, password }, skipRefresh);
  const data = unwrap<any>(res);
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: mapUser(data.user),
  };
}

// refreshToken is optional: on web it's omitted (the HttpOnly cookie carries it).
export async function refresh(
  refreshToken?: string
): Promise<{ accessToken: string }> {
  const res = await http.post("/auth/refresh", { refreshToken }, skipRefresh);
  return unwrap(res);
}

export async function logout(refreshToken?: string): Promise<void> {
  await http.post("/auth/logout", { refreshToken }, skipRefresh);
}
