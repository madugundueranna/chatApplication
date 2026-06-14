// Runtime configuration, read from Expo public env (inlined into the bundle at
// build time — see .env / .env.example). One place to set the backend host per
// target; `localhost` does NOT work from a device/emulator (see README table):
//   Android emulator -> http://10.0.2.2:5000   iOS sim -> http://localhost:5000
//   Physical device  -> http://<your-LAN-IP>:5000
//
// REST lives under `/api`; Socket.io connects to the ROOT origin (not `/api`).

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:5000";

export { API_URL, SOCKET_URL };
