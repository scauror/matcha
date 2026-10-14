import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

type CallKind = "audio" | "video";

type Incoming = { fromUserId: string; kind: CallKind };

type CallContextValue = {
  startCall: (peerId: string, kind: CallKind, peerName?: string) => void;
  hangup: () => void;
};

const ICE = [{ urls: "stun:stun.l.google.com:19302" }];
const Ctx = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [active, setActive] = useState<{ peerId: string; kind: CallKind; peerName: string } | null>(
    null,
  );
  const [status, setStatus] = useState("");

  const attachVideos = useCallback(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, []);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    peerIdRef.current = null;
    pendingIceRef.current = [];
    setActive(null);
    setIncoming(null);
    setStatus("");
  }, []);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const queued = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        // ignore
      }
    }
  }, []);

  const ensurePc = useCallback(
    (peerId: string) => {
      if (pcRef.current) return pcRef.current;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      pcRef.current = pc;
      peerIdRef.current = peerId;
      remoteStreamRef.current = new MediaStream();
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          socketRef.current?.emit("call:ice", { toUserId: peerId, candidate: ev.candidate });
        }
      };
      pc.ontrack = (ev) => {
        for (const track of ev.streams[0]?.getTracks() ?? [ev.track]) {
          remoteStreamRef.current?.addTrack(track);
        }
        attachVideos();
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") setStatus("Connexion perdue");
      };
      return pc;
    },
    [attachVideos],
  );

  const addLocalMedia = useCallback(
    async (kind: CallKind, peerId: string) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video",
      });
      localStreamRef.current = stream;
      const pc = ensurePc(peerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      attachVideos();
    },
    [attachVideos, ensurePc],
  );

  const hangup = useCallback(() => {
    const peerId = peerIdRef.current;
    if (peerId) socketRef.current?.emit("call:hangup", { toUserId: peerId });
    cleanup();
  }, [cleanup]);

  const startCall = useCallback(
    (peerId: string, kind: CallKind, peerName = "Match") => {
      void (async () => {
        try {
          setStatus("Appel…");
          setActive({ peerId, kind, peerName });
          peerIdRef.current = peerId;
          await addLocalMedia(kind, peerId);
          socketRef.current?.emit("call:invite", { toUserId: peerId, kind });
        } catch {
          setStatus("Micro / caméra refusés.");
          cleanup();
        }
      })();
    },
    [addLocalMedia, cleanup],
  );

  const accept = useCallback(async () => {
    if (!incoming) return;
    const { fromUserId, kind } = incoming;
    setIncoming(null);
    setActive({ peerId: fromUserId, kind, peerName: "Match" });
    try {
      await addLocalMedia(kind, fromUserId);
      socketRef.current?.emit("call:accept", { toUserId: fromUserId });
    } catch {
      setStatus("Micro / caméra refusés.");
      socketRef.current?.emit("call:reject", { toUserId: fromUserId });
      cleanup();
    }
  }, [incoming, addLocalMedia, cleanup]);

  useEffect(() => {
    if (!user) return;
    const socket = io({ withCredentials: true });
    socketRef.current = socket;

    socket.on("call:invite", (payload: { fromUserId: string; kind: CallKind }) => {
      if (peerIdRef.current) {
        socket.emit("call:reject", { toUserId: payload.fromUserId });
        return;
      }
      setIncoming({ fromUserId: payload.fromUserId, kind: payload.kind });
    });

    socket.on("call:accept", async (payload: { fromUserId: string }) => {
      if (payload.fromUserId !== peerIdRef.current) return;
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", { toUserId: payload.fromUserId, sdp: pc.localDescription });
      } catch {
        setStatus("Négociation impossible.");
      }
    });

    socket.on("call:offer", async (payload: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      if (payload.fromUserId !== peerIdRef.current) return;
      const pc = ensurePc(payload.fromUserId);
      await pc.setRemoteDescription(payload.sdp);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { toUserId: payload.fromUserId, sdp: pc.localDescription });
    });

    socket.on(
      "call:answer",
      async (payload: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
        if (payload.fromUserId !== peerIdRef.current || !payload.sdp) return;
        await pcRef.current?.setRemoteDescription(payload.sdp);
        await flushIce();
      },
    );

    socket.on("call:ice", async (payload: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      if (payload.fromUserId !== peerIdRef.current) return;
      if (!pcRef.current?.remoteDescription) {
        pendingIceRef.current.push(payload.candidate);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(payload.candidate);
      } catch {
        // ignore
      }
    });

    socket.on("call:hangup", () => cleanup());
    socket.on("call:reject", () => {
      setStatus("Appel refusé.");
      window.setTimeout(() => cleanup(), 800);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [user, cleanup, ensurePc, flushIce]);

  useEffect(() => {
    attachVideos();
  }, [active, attachVideos]);

  const value = useMemo(() => ({ startCall, hangup }), [startCall, hangup]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {incoming ? (
        <div className="call-modal" role="dialog" aria-labelledby="incoming-call">
          <div className="panel">
            <h2 id="incoming-call">Appel {incoming.kind === "video" ? "vidéo" : "audio"}</h2>
            <p>Un match t’appelle.</p>
            <div className="form-row">
              <button type="button" className="btn" onClick={() => void accept()}>
                Accepter
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  socketRef.current?.emit("call:reject", { toUserId: incoming.fromUserId });
                  setIncoming(null);
                }}
              >
                Refuser
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {active ? (
        <div className="call-overlay">
          <div className="call-stage">
            <video
              ref={remoteVideoRef}
              className={active.kind === "video" ? "call-remote" : "call-remote-audio"}
              autoPlay
              playsInline
            />
            {active.kind === "video" ? (
              <video ref={localVideoRef} className="call-local" autoPlay playsInline muted />
            ) : (
              <p className="call-audio-only">Appel audio</p>
            )}
            <p className="call-status">
              {active.kind === "video" ? "Visio" : "Audio"} avec {active.peerName}
              {status ? ` — ${status}` : ""}
            </p>
            <button type="button" className="btn" onClick={hangup}>
              Raccrocher
            </button>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function useCall(): CallContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
