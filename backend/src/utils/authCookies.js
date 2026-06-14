// HttpOnly auth cookies (the secure way).
//
// The access token is sent on every /api request; the refresh token is scoped to
// /api/auth so it's only exposed to refresh/logout. Cookies are HttpOnly (JS can't
// read them — XSS can't steal the token), Secure in production (HTTPS only), and
// SameSite-guarded against CSRF ('lax' in dev on localhost; 'none' + Secure in
// prod for a cross-site web client).

const isProd = process.env.NODE_ENV === 'production';

// Parse "15m" / "7d" / "30s" / "12h" → milliseconds (for cookie maxAge), so the
// cookie lifetime mirrors the JWT lifetime.
const parseDuration = (value, fallbackMs) => {
  const match = /^(\d+)\s*([smhd])$/.exec(String(value || '').trim());
  if (!match) return fallbackMs;
  const n = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return n * unit;
};

const ACCESS_MAX_AGE = parseDuration(process.env.JWT_ACCESS_EXPIRES, 15 * 60_000);
const REFRESH_MAX_AGE = parseDuration(process.env.JWT_REFRESH_EXPIRES, 7 * 86_400_000);

export const ACCESS_COOKIE = 'accessToken';
export const REFRESH_COOKIE = 'refreshToken';

const baseOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
};

// Path so refresh-token only rides along on the auth routes that need it.
const REFRESH_PATH = '/api/auth';

export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  if (accessToken)
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...baseOptions,
      path: '/',
      maxAge: ACCESS_MAX_AGE,
    });
  if (refreshToken)
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...baseOptions,
      path: REFRESH_PATH,
      maxAge: REFRESH_MAX_AGE,
    });
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions, path: REFRESH_PATH });
};
