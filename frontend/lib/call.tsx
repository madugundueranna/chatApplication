// Call store — 1:1 WebRTC over the existing socket.
//
// State machine (phase): idle -> outgoing/incoming -> connecting -> active -> ended.
// Signaling contract (backend src/socket/handlers/call.handler.js):
//   caller emits call:initiate -> callee gets call:incoming -> callee emits
//   call:accept -> caller gets call:accepted -> CALLER builds the offer
//   (call:offer) -> callee answers (call:answer) -> trickle ICE -> either ends
//   (call:end). Media is peer-to-peer; the server only relays signaling.
//
// Native-only: react-native-webrtc / react-native-incall-manager don't exist on
// web, so we lazy-require them and no-op calls when Platform.OS === "web".

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import type { MediaStream } from "react-native-webrtc";
import { callApi } from "./api";
import * as socket from "./socket";
import { EVT } from "./socket";
import { CallPeer, CallType } from "./types";

const isWeb = Platform.OS === "web";

// Lazy native modules (avoid loading native code into the web bundle).
let RTC: typeof import("react-native-webrtc") | null = null;
let InCallManager: any = null;
function rtc() {
  if (isWeb) return null;
  if (!RTC) {
    RTC = require("react-native-webrtc");
    InCallManager = require("react-native-incall-manager").default;
  }
  return RTC;
}
function inCall(): any {
  rtc();
  return InCallManager;
}

export type CallPhase =
  | "idle"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "active"
  | "ended";

interface ActiveCall {
  callId: string;
  type: CallType;
  peer: CallPeer; // the other party
  isCaller: boolean;
}

interface CallContextValue {
  phase: CallPhase;
  call: ActiveCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  speaker: boolean;
  endedReason: string | null;
  // Returns the callId (so the screen can navigate), or null if it didn't start.
  startCall: (
    callee: CallPeer,
    type: CallType,
    conversationId?: string
  ) => Promise<string | null>;
  accept: () => Promise<void>;
  reject: () => Promise<void>;
  end: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [endedReason, setEndedReason] = useState<string | null>(null);

  // Mutable refs the socket handlers read without re-subscribing.
  const callRef = useRef<ActiveCall | null>(null);
  const pcRef = useRef<any>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<any[]>([]);
  const pendingOffer = useRef<any>(null); // offer that arrived before our pc existed
  const hasRemoteDesc = useRef(false);
  const iceServersRef = useRef<any[] | null>(null);

  const setCurrentCall = useCallback((c: ActiveCall | null) => {
    callRef.current = c;
    setCall(c);
  }, []);

  const getIceServers = useCallback(async () => {
    if (iceServersRef.current) return iceServersRef.current;
    try {
      iceServersRef.current = await callApi.iceServers();
    } catch {
      iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }];
    }
    return iceServersRef.current;
  }, []);

  const teardown = useCallback((reason: string | null) => {
    try {
      pcRef.current?.close?.();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    localRef.current?.getTracks?.().forEach((t: any) => t.stop());
    localRef.current = null;
    pendingCandidates.current = [];
    pendingOffer.current = null;
    hasRemoteDesc.current = false;
    try {
      inCall()?.stopRingtone?.();
      inCall()?.stopRingback?.();
      inCall()?.stop?.();
    } catch {
      /* ignore */
    }
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setSpeaker(false);
    setEndedReason(reason);
    setPhase(reason ? "ended" : "idle");
    setCurrentCall(null);
    // Briefly show "ended", then return to idle.
    if (reason) setTimeout(() => setPhase("idle"), 1200);
  }, [setCurrentCall]);

  // getUserMedia + InCallManager setup; returns the local MediaStream.
  const acquireMedia = useCallback(async (type: CallType) => {
    const lib = rtc();
    if (!lib) throw new Error("Calls are not supported on this platform");
    const stream = await lib.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video" ? { facingMode: "user" } : false,
    });
    localRef.current = stream as unknown as MediaStream;
    setLocalStream(stream as unknown as MediaStream);
    try {
      inCall()?.start({ media: type === "video" ? "video" : "audio" });
      const useSpeaker = type === "video";
      inCall()?.setForceSpeakerphoneOn(useSpeaker);
      setSpeaker(useSpeaker);
    } catch {
      /* audio routing is best-effort */
    }
    return stream;
  }, []);

  // Build the RTCPeerConnection, wire ICE/track, attach local tracks.
  const createPeer = useCallback(
    async (stream: any) => {
      const lib = rtc()!;
      const iceServers = await getIceServers();
      // Typed as any: react-native-webrtc's event API (addEventListener) isn't in
      // its published d.ts surface, and the lazy require keeps this dynamic anyway.
      const pc: any = new lib.RTCPeerConnection({ iceServers });

      pc.addEventListener("icecandidate", (e: any) => {
        const id = callRef.current?.callId;
        if (e.candidate && id) {
          socket.emit(EVT.CALL_ICE_CANDIDATE, {
            callId: id,
            candidate: e.candidate,
          });
        }
      });
      pc.addEventListener("track", (e: any) => {
        if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]);
      });
      pc.addEventListener("connectionstatechange", () => {
        const s = pc.connectionState;
        if (s === "connected") setPhase("active");
        else if (s === "failed") teardown("connection-failed");
      });

      stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));
      pcRef.current = pc;
      return pc;
    },
    [getIceServers, teardown]
  );

  const drainCandidates = useCallback(async () => {
    const lib = rtc();
    if (!lib || !pcRef.current) return;
    for (const c of pendingCandidates.current) {
      try {
        await pcRef.current.addIceCandidate(new lib.RTCIceCandidate(c));
      } catch {
        /* ignore bad candidate */
      }
    }
    pendingCandidates.current = [];
  }, []);

  // Callee: apply the caller's offer and answer it. If our peer connection isn't
  // ready yet (offer raced ahead of accept()), stash it for accept() to drain.
  const applyOffer = useCallback(
    async (data: { callId: string; sdp: any }) => {
      const lib = rtc();
      const pc = pcRef.current;
      if (!lib || !pc) {
        pendingOffer.current = data;
        return;
      }
      await pc.setRemoteDescription(new lib.RTCSessionDescription(data.sdp));
      hasRemoteDesc.current = true;
      await drainCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit(EVT.CALL_ANSWER, {
        callId: data.callId,
        sdp: pc.localDescription,
      });
    },
    [drainCandidates]
  );

  // ---- Public actions -------------------------------------------------------

  const startCall = useCallback(
    async (callee: CallPeer, type: CallType, conversationId?: string) => {
      if (isWeb) {
        Alert.alert("Not supported", "Calls aren't available on web yet.");
        return null;
      }
      if (callRef.current) return null; // already in a call
      try {
        const stream = await acquireMedia(type);
        const ack = await socket.emitWithAck<{
          success: boolean;
          callId?: string;
          error?: string;
          busy?: boolean;
        }>(EVT.CALL_INITIATE, {
          calleeId: callee._id,
          type,
          conversationId,
        });

        if (!ack?.success || !ack.callId) {
          stream.getTracks().forEach((t: any) => t.stop());
          localRef.current = null;
          setLocalStream(null);
          Alert.alert(
            "Call failed",
            ack?.busy ? `${callee.name} is on another call.` : ack?.error || "Could not start the call."
          );
          return null;
        }

        setCurrentCall({ callId: ack.callId, type, peer: callee, isCaller: true });
        setPhase("outgoing");
        try {
          inCall()?.startRingback();
        } catch {
          /* ignore */
        }
        return ack.callId;
      } catch (e: any) {
        teardown(null);
        Alert.alert("Call failed", e?.message || "Could not access camera/mic.");
        return null;
      }
    },
    [acquireMedia, setCurrentCall, teardown]
  );

  const accept = useCallback(async () => {
    const current = callRef.current;
    if (!current) return;
    try {
      inCall()?.stopRingtone();
    } catch {
      /* ignore */
    }
    try {
      const ack = await socket.emitWithAck<{ success: boolean }>(
        EVT.CALL_ACCEPT,
        { callId: current.callId }
      );
      if (!ack?.success) {
        teardown("unavailable");
        return;
      }
      // Prepare media + peer; the CALLER will now send us an offer.
      const stream = await acquireMedia(current.type);
      await createPeer(stream);
      setPhase("connecting");
      // An offer may have raced ahead of us — apply it now that the peer exists.
      if (pendingOffer.current) {
        const offer = pendingOffer.current;
        pendingOffer.current = null;
        await applyOffer(offer);
      }
    } catch {
      teardown("failed");
    }
  }, [acquireMedia, createPeer, applyOffer, teardown]);

  const reject = useCallback(async () => {
    const current = callRef.current;
    if (current) socket.emit(EVT.CALL_REJECT, { callId: current.callId });
    teardown(null);
  }, [teardown]);

  const end = useCallback(async () => {
    const current = callRef.current;
    if (current) socket.emit(EVT.CALL_END, { callId: current.callId });
    teardown(null);
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks?.() ?? [];
    const next = !muted;
    tracks.forEach((t: any) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    const next = !speaker;
    try {
      inCall()?.setForceSpeakerphoneOn(next);
    } catch {
      /* ignore */
    }
    setSpeaker(next);
  }, [speaker]);

  // ---- Socket signaling subscriptions (mounted once) ------------------------

  useEffect(() => {
    if (isWeb) return;

    const offIncoming = socket.on(
      EVT.CALL_INCOMING,
      (data: { callId: string; type: CallType; caller: any }) => {
        if (callRef.current) return; // already busy locally
        setEndedReason(null);
        setCurrentCall({
          callId: data.callId,
          type: data.type,
          peer: {
            _id: data.caller?.userId,
            name: data.caller?.name ?? "Unknown",
            avatar: data.caller?.avatar ?? "",
          },
          isCaller: false,
        });
        setPhase("incoming");
        try {
          inCall()?.startRingtone("_DEFAULT_");
        } catch {
          /* ignore */
        }
      }
    );

    // Caller: callee accepted -> build and send the offer.
    const offAccepted = socket.on(EVT.CALL_ACCEPTED, async () => {
      const current = callRef.current;
      if (!current?.isCaller || !localRef.current) return;
      try {
        inCall()?.stopRingback();
      } catch {
        /* ignore */
      }
      setPhase("connecting");
      const pc = await createPeer(localRef.current);
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      socket.emit(EVT.CALL_OFFER, {
        callId: current.callId,
        sdp: pc.localDescription,
      });
    });

    // Callee: received the caller's offer -> answer (queues if pc isn't ready yet).
    const offOffer = socket.on(EVT.CALL_OFFER, applyOffer);

    // Caller: received the callee's answer.
    const offAnswer = socket.on(
      EVT.CALL_ANSWER,
      async (data: { sdp: any }) => {
        const lib = rtc();
        const pc = pcRef.current;
        if (!lib || !pc) return;
        await pc.setRemoteDescription(new lib.RTCSessionDescription(data.sdp));
        hasRemoteDesc.current = true;
        await drainCandidates();
      }
    );

    const offIce = socket.on(
      EVT.CALL_ICE_CANDIDATE,
      async (data: { candidate: any }) => {
        const lib = rtc();
        if (!data?.candidate) return;
        if (hasRemoteDesc.current && pcRef.current && lib) {
          try {
            await pcRef.current.addIceCandidate(
              new lib.RTCIceCandidate(data.candidate)
            );
          } catch {
            /* ignore */
          }
        } else {
          pendingCandidates.current.push(data.candidate);
        }
      }
    );

    const offRejected = socket.on(EVT.CALL_REJECTED, () => teardown("declined"));
    const offBusy = socket.on(EVT.CALL_BUSY, () => teardown("busy"));
    const offMissed = socket.on(EVT.CALL_MISSED, () => teardown("no-answer"));
    const offEnded = socket.on(EVT.CALL_ENDED, (d: { reason?: string }) =>
      teardown(d?.reason || "ended")
    );
    const offError = socket.on(EVT.CALL_ERROR, (d: { message?: string }) => {
      if (callRef.current) teardown(d?.message || "error");
    });

    return () => {
      offIncoming();
      offAccepted();
      offOffer();
      offAnswer();
      offIce();
      offRejected();
      offBusy();
      offMissed();
      offEnded();
      offError();
    };
  }, [applyOffer, createPeer, drainCandidates, setCurrentCall, teardown]);

  const value = useMemo<CallContextValue>(
    () => ({
      phase,
      call,
      localStream,
      remoteStream,
      muted,
      speaker,
      endedReason,
      startCall,
      accept,
      reject,
      end,
      toggleMute,
      toggleSpeaker,
    }),
    [
      phase,
      call,
      localStream,
      remoteStream,
      muted,
      speaker,
      endedReason,
      startCall,
      accept,
      reject,
      end,
      toggleMute,
      toggleSpeaker,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within a CallProvider");
  return ctx;
}
