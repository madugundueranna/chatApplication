// Token storage lives outside React so the axios interceptors (which run during
// requests, not renders) can read and rotate tokens without a component.
const ACCESS_KEY = 'chatloop_admin_access';
const REFRESH_KEY = 'chatloop_admin_refresh';

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export const setTokens = ({ accessToken, refreshToken }) => {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
};

export const setAccessToken = (accessToken) => {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
};
