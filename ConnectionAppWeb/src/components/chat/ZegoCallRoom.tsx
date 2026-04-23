import { useEffect, useMemo, useRef, useState } from "react";
import type { CallMediaType, CallSession } from "@/types/call";
import { getCallMediaEnvironmentWarning } from "@/lib/apiConfig";

interface ZegoCallRoomProps {
  call: CallSession;
  mediaType: CallMediaType;
  onJoinRoom?: () => void;
  onLeaveRoom?: () => void;
}

interface ZegoRoomHandle {
  destroy?: () => void;
  hangUp?: () => void;
  closeBackgroundProcess?: () => void;
  localStream?: MediaStream;
  autoLeaveRoomWhenOnlySelfInRoom?: boolean;
}

let activeGlobalRoomHandle: ZegoRoomHandle | null = null;
let activeGlobalRoomKey: string | null = null;
let pendingGlobalCleanupTimer: ReturnType<typeof setTimeout> | null = null;

const stopMediaStream = (stream?: MediaStream | null) => {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (trackError) {
      console.warn("Failed to stop media track", trackError);
    }
  });
};

const detachMediaElements = (root?: ParentNode | null) => {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  root.querySelectorAll("audio, video").forEach((element) => {
    const mediaElement = element as HTMLMediaElement & {
      srcObject?: MediaStream | null;
    };
    const srcObject = mediaElement.srcObject;
    if (srcObject instanceof MediaStream) {
      stopMediaStream(srcObject);
    }

    mediaElement.pause?.();
    mediaElement.srcObject = null;
    mediaElement.removeAttribute("src");
    mediaElement.load?.();
  });
};

const cleanupRoomResources = (
  roomHandle: ZegoRoomHandle | null,
  container?: HTMLDivElement | null,
) => {
  try {
    roomHandle?.hangUp?.();
  } catch (cleanupError) {
    console.warn("ZEGO hangUp cleanup failed", cleanupError);
  }

  stopMediaStream(roomHandle?.localStream);
  detachMediaElements(container);
  detachMediaElements(document.body);

  try {
    roomHandle?.closeBackgroundProcess?.();
  } catch (cleanupError) {
    console.warn("ZEGO closeBackgroundProcess cleanup failed", cleanupError);
  }

  try {
    roomHandle?.destroy?.();
  } catch (cleanupError) {
    console.warn("ZEGO destroy cleanup failed", cleanupError);
  }

  container?.replaceChildren();
};

const cleanupGlobalRoomInstance = () => {
  if (pendingGlobalCleanupTimer) {
    clearTimeout(pendingGlobalCleanupTimer);
    pendingGlobalCleanupTimer = null;
  }

  cleanupRoomResources(activeGlobalRoomHandle, null);
  activeGlobalRoomHandle = null;
  activeGlobalRoomKey = null;
};

const ZegoCallRoom = ({
  call,
  mediaType,
  onJoinRoom,
  onLeaveRoom,
}: ZegoCallRoomProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onJoinRoomRef = useRef<(() => void) | undefined>(onJoinRoom);
  const onLeaveRoomRef = useRef<(() => void) | undefined>(onLeaveRoom);
  const hasJoinedRoomRef = useRef(false);
  const isCleanupDestroyRef = useRef(false);
  const hasReportedLeaveRef = useRef(false);
  const roomInstanceKeyRef = useRef("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onJoinRoomRef.current = onJoinRoom;
  }, [onJoinRoom]);

  useEffect(() => {
    onLeaveRoomRef.current = onLeaveRoom;
  }, [onLeaveRoom]);

  const displayName = useMemo(() => {
    const expectedId = Number(call.token?.userId);
    if (Number.isFinite(expectedId)) {
      const matched = call.participants.find(
        (participant) => participant.userId === expectedId,
      );
      if (matched?.displayName?.trim()) {
        return matched.displayName.trim();
      }
    }

    return `user_${call.token?.userId ?? "unknown"}`;
  }, [call.participants, call.token?.userId]);

  useEffect(() => {
    let destroyed = false;
    let roomHandle: ZegoRoomHandle | null = null;
    const container = containerRef.current;
    const roomInstanceKey = `${call.callId}:${call.roomId}:${call.token?.userId ?? "unknown"}`;

    hasJoinedRoomRef.current = false;
    hasReportedLeaveRef.current = false;
    isCleanupDestroyRef.current = false;
    roomInstanceKeyRef.current = roomInstanceKey;

    const bootstrap = async () => {
      if (!container || !call.token?.token) {
        return;
      }

      try {
        setError(null);
        const environmentWarning = getCallMediaEnvironmentWarning();
        if (environmentWarning) {
          throw new Error(environmentWarning);
        }

        const zegoModule = await import("@zegocloud/zego-uikit-prebuilt");
        const ZegoUIKitPrebuilt =
          zegoModule.ZegoUIKitPrebuilt ?? zegoModule.default ?? zegoModule;
        const generateKitTokenForProduction =
          ZegoUIKitPrebuilt.generateKitTokenForProduction;

        const roomId = call.token?.roomId || call.roomId;
        const userId = call.token?.userId;
        const appId = call.token?.appId;
        const rawToken = call.token?.token;

        if (!roomId || !userId || !appId || !rawToken) {
          throw new Error("Missing token payload for ZEGO room");
        }

        if (typeof generateKitTokenForProduction !== "function") {
          throw new Error(
            "ZEGO SDK does not expose generateKitTokenForProduction",
          );
        }

        if (activeGlobalRoomKey && activeGlobalRoomKey !== roomInstanceKey) {
          cleanupGlobalRoomInstance();
        }

        container.innerHTML = "";

        const kitToken = generateKitTokenForProduction(
          appId,
          rawToken,
          roomId,
          userId,
          displayName,
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zp.autoLeaveRoomWhenOnlySelfInRoom = false;

        roomHandle = zp;
        activeGlobalRoomHandle = zp;
        activeGlobalRoomKey = roomInstanceKey;
        if (destroyed || !container) {
          cleanupRoomResources(zp, container);
          if (activeGlobalRoomKey === roomInstanceKey) {
            activeGlobalRoomHandle = null;
            activeGlobalRoomKey = null;
          }
          return;
        }

        zp.joinRoom({
          container,
          sharedLinks: [],
          scenario: {
            mode:
              mediaType === "VIDEO"
                ? ZegoUIKitPrebuilt.VideoConference
                : ZegoUIKitPrebuilt.OneONoneCall,
          },
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: mediaType === "VIDEO",
          showMyCameraToggleButton: mediaType === "VIDEO",
          showLeavingView: false,
          showLeaveRoomConfirmDialog: false,
          showPreJoinView: false,
          onJoinRoom: () => {
            if (roomInstanceKeyRef.current !== roomInstanceKey) {
              return;
            }

            hasJoinedRoomRef.current = true;
            onJoinRoomRef.current?.();
          },
          onLeaveRoom: () => {
            // Ignore leave events emitted by SDK destroy/cleanup or before room join.
            if (
              roomInstanceKeyRef.current !== roomInstanceKey ||
              isCleanupDestroyRef.current ||
              !hasJoinedRoomRef.current ||
              hasReportedLeaveRef.current
            ) {
              return;
            }

            hasReportedLeaveRef.current = true;
            onLeaveRoomRef.current?.();
          },
        });
      } catch (roomError) {
        console.error(roomError);
        const reason =
          roomError instanceof Error && roomError.message
            ? roomError.message
            : "Unknown SDK error";
        setError(`Khong the khoi tao phong goi ZEGO: ${reason}`);
      }
    };

    void bootstrap();

    return () => {
      destroyed = true;
      isCleanupDestroyRef.current = true;
      hasJoinedRoomRef.current = false;
      hasReportedLeaveRef.current = true;
      cleanupRoomResources(roomHandle, container);

      if (activeGlobalRoomKey === roomInstanceKey) {
        activeGlobalRoomHandle = null;
        activeGlobalRoomKey = null;
      }

      pendingGlobalCleanupTimer = setTimeout(() => {
        if (activeGlobalRoomHandle === roomHandle) {
          cleanupGlobalRoomInstance();
        }
      }, 1500);
    };
  }, [
    call.callId,
    call.roomId,
    call.token?.appId,
    call.token?.roomId,
    call.token?.token,
    call.token?.userId,
    displayName,
    mediaType,
  ]);

  if (!call.token?.token) {
    return (
      <div className="mt-3 rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Dang tai call token...
      </div>
    );
  }

  return (
    <div className="mt-3">
      {error && (
        <div className="mb-2 rounded-md border border-red-400/50 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        className="h-105 w-full overflow-hidden rounded-lg border border-border/50 bg-black"
      />
    </div>
  );
};

export default ZegoCallRoom;
