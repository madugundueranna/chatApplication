// Base origin of the backend. Empty string => same-origin, which lets the Vite
// dev proxy forward `/api` to the backend (no CORS needed in local dev).
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

// All endpoints live under `/api`.
export const API_URL = `${BASE_URL}/api`;
