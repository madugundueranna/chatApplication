import client from './client';

// Returns the unwrapped `{ accessToken, refreshToken, user }`.
export const login = (email, password) =>
  client.post('/auth/login', { email, password });

// Returns the current user `{ userId, name, email, role, ... }`.
export const getMe = () => client.get('/users/me');

export const logout = (refreshToken) =>
  client.post('/auth/logout', { refreshToken });
