import { useEffect, useRef, useState } from "react";
import type { CallMediaType, CallSession } from "@/types/call";
import { getCallMediaEnvironmentWarning } from "@/lib/apiConfig";

interface ZegoCallRoomProps {
  call: CallSession;
  mediaType: CallMediaType;
  onJoinRoom?: () => void;
  onLeaveRoom?: () => void;
}

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onJoinRoomRef.current = onJoinRoom;
  }, [onJoinRoom]);

  useEffect(() => {
    onLeaveRoomRef.current = onLeaveRoom;
  }, [onLeaveRoom]);

  const resolveDisplayName = (): string => {
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
  };

  useEffect(() => {
    let destroyed = false;
    let roomHandle: { destroy?: () => void } | null = null;
    hasJoinedRoomRef.current = false;
    isCleanupDestroyRef.current = false;

    const bootstrap = async () => {
      if (!containerRef.current || !call.token?.token) {
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

        const kitToken = generateKitTokenForProduction(
          appId,
          rawToken,
          roomId,
          userId,
          resolveDisplayName(),
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);

        roomHandle = zp;
        if (destroyed || !containerRef.current) {
          zp.destroy?.();
          return;
        }

        zp.joinRoom({
          container: containerRef.current,
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
          showPreJoinView: false,
          onJoinRoom: () => {
            hasJoinedRoomRef.current = true;
            onJoinRoomRef.current?.();
          },
          onLeaveRoom: () => {
            // Ignore leave events emitted by SDK destroy/cleanup or before room join.
            if (isCleanupDestroyRef.current || !hasJoinedRoomRef.current) {
              return;
            }

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
      roomHandle?.destroy?.();
    };
  }, [call.roomId, call.token?.token, mediaType]);

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
