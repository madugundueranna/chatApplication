// Mounted once at the app root (inside CallProvider). Renders the global
// incoming-call UI. The active/outgoing call screen is a normal route
// (app/call/[id].tsx); screens navigate to it after startCall()/accept().

import { IncomingCallModal } from "./IncomingCallModal";

export function CallOverlay() {
  return <IncomingCallModal />;
}
