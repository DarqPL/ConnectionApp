import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type { CallSession } from "@/types/call";
import { Phone, PhoneCall, PhoneIncoming, PhoneOff, Video } from "lucide-react";
import { toast } from "sonner";
import ZegoCallRoom from "./ZegoCallRoom";

interface CallOverlayProps {
  conversationId: number;
  isGroupConversation?: boolean;
}

const CallOverlay = ({ conversationId, isGroupConversation }: CallOverlayProps) => {
  const {
    incomingCall,
    activeCall,
    acceptCall,
    rejectCall,
    endCall,
    ensureActiveCallToken,
    groupCallActive,
    joinGroupCall,
    fetchActiveCall,
  } = useCallStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastIncomingCallIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (isGroupConversation) {
      void fetchActiveCall(conversationId);
    }
  }, [conversationId, isGroupConversation, fetchActiveCall]);

  // WebSocket subscription for call participants
  useEffect(() => {
    if (!isGroupConversation) {
      return;
    }

    const { client } = useSocketStore.getState();
    if (!client || !client.connected) {
      return;
    }

    const topic = `/topic/conversation.${conversationId}/call-participants`;
    const subscription = client.subscribe(topic, (message: { body: string }) => {
      const payload = JSON.parse(message.body) as {
        callId: number;
        conversationId: number;
        status: string;
        participants: Array<{ userId: number; status: string }>;
      };

      // Check for any active participants (JOINED or WAITING), not just JOINED
      const hasActiveParticipant = payload.participants.some(
        p => p.status === "JOINED" || p.status === "WAITING"
      );
      const myUserId = useAuthStore.getState().user?.id;
      const isUserJoined = payload.participants.some(
        p => p.userId === myUserId && p.status === "JOINED"
      );

      if (hasActiveParticipant && payload.status === "ONGOING") {
        if (!isUserJoined) {
          useCallStore.getState().setGroupCallActive({
            callId: payload.callId,
            conversationId: payload.conversationId,
            status: payload.status,
            participants: payload.participants,
            isGroupCall: true,
          } as CallSession);
        }
      } else if (!hasActiveParticipant || payload.status === "ENDED" || payload.status === "MISSED") {
        const current = useCallStore.getState().groupCallActive;
        if (current?.conversationId === payload.conversationId) {
          useCallStore.getState().setGroupCallActive(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, isGroupConversation]);

  const groupCallForConversation =
    groupCallActive?.conversationId === conversationId ? groupCallActive : null;

  const myUserId = useAuthStore.getState().user?.id;
  const isUserInGroupCall = groupCallForConversation?.participants.some(
    (p) => p.userId === myUserId && p.status === "JOINED"
  );

  const incomingForConversation =
    incomingCall?.conversationId === conversationId ? incomingCall : null;
  const activeForConversation =
    activeCall?.conversationId === conversationId ? activeCall : null;

  // Reset isSubmitting when a new incoming call appears (different callId)
  useEffect(() => {
    if (incomingForConversation?.callId !== lastIncomingCallIdRef.current) {
      setIsSubmitting(false);
      lastIncomingCallIdRef.current = incomingForConversation?.callId ?? null;
    }
  }, [incomingForConversation?.callId]);

  const callerDisplayName = useMemo(() => {
    if (!incomingForConversation) {
      return "Nguoi dung";
    }

    return (
      incomingForConversation.participants.find(
        (participant) =>
          participant.userId === incomingForConversation.initiatedBy,
      )?.displayName ?? "Nguoi dung"
    );
  }, [incomingForConversation]);

  useEffect(() => {
    if (!activeForConversation) {
      return;
    }

    if (activeForConversation.status !== "ONGOING") {
      return;
    }

    if (activeForConversation.token?.token) {
      return;
    }

    void ensureActiveCallToken(activeForConversation.callId);
  }, [activeForConversation, ensureActiveCallToken]);

  // If there's an active call for this conversation, don't show incoming UI
  // even if a stale socket event re-set incomingCall.
  const showIncoming =
    incomingForConversation && !activeForConversation;
  const showActive = !!activeForConversation;
  const showGroupCallBanner = !!groupCallForConversation;

  // Always render for group conversations so fetchActiveCall can run
  if (!showIncoming && !showActive && !showGroupCallBanner && !isGroupConversation) {
    return null;
  }

  const handleAccept = async () => {
    if (!incomingForConversation || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptCall(incomingForConversation.callId);
      toast.success("Da tham gia cuoc goi");
    } catch (error) {
      console.error(error);
      toast.error("Khong the chap nhan cuoc goi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!incomingForConversation || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await rejectCall(incomingForConversation.callId);
      toast.success("Da tu choi cuoc goi");
    } catch (error) {
      console.error(error);
      toast.error("Khong the tu choi cuoc goi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrEnd = async () => {
    if (!activeForConversation || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await endCall(activeForConversation.callId, "ENDED_BY_USER");
      toast.success(
        activeForConversation.status === "RINGING"
          ? "Da huy cuoc goi"
          : "Da ket thuc cuoc goi",
      );
    } catch (error) {
      console.error(error);
      toast.error(
        activeForConversation.status === "RINGING"
          ? "Khong the huy cuoc goi"
          : "Khong the ket thuc cuoc goi",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveFromSdkRoom = async () => {
    if (!activeForConversation || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await endCall(activeForConversation.callId, "ENDED_BY_ROOM_LEAVE");
      toast.success("Da roi phong va ket thuc cuoc goi");
    } catch (error) {
      console.error(error);
      toast.error("Khong the dong bo ket thuc cuoc goi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinGroupCall = async () => {
    if (!groupCallForConversation || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await joinGroupCall(groupCallForConversation.callId);
      toast.success("Da tham gia cuoc goi nhom");
    } catch (error) {
      console.error(error);
      toast.error("Khong the tham gia cuoc goi");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-b border-border/40 bg-muted/40 px-4 py-3">
      {isGroupConversation && groupCallForConversation && !isUserInGroupCall && !activeForConversation && (
        <div className="mb-3 rounded-lg border border-blue-300/60 bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <PhoneCall className="size-4" />
            <span>Dang co cuoc goi nhom dien ra, ban co muon tham gia?</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8"
              onClick={() => void handleJoinGroupCall()}
              disabled={isSubmitting}
            >
              <PhoneCall className="size-4" />
              Tham gia
            </Button>
          </div>
        </div>
      )}

      {showIncoming && (
        <div className="mb-3 rounded-lg border border-emerald-300/60 bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <PhoneIncoming className="size-4" />
            <span>
              {callerDisplayName} dang goi{" "}
              {incomingForConversation.mediaType === "VIDEO"
                ? "video"
                : "thoai"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8"
              onClick={() => void handleAccept()}
              disabled={isSubmitting}
            >
              <PhoneCall className="size-4" />
              Nhan
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8"
              onClick={() => void handleReject()}
              disabled={isSubmitting}
            >
              <PhoneOff className="size-4" />
              Tu choi
            </Button>
          </div>
        </div>
      )}

      {showActive && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              {activeForConversation.mediaType === "VIDEO" ? (
                <Video className="size-4" />
              ) : (
                <Phone className="size-4" />
              )}
              <span>
                Cuoc goi{" "}
                {activeForConversation.mediaType === "VIDEO"
                  ? "video"
                  : "thoai"}{" "}
                - {activeForConversation.status}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {activeForConversation.status === "RINGING"
                ? "Dang do chuong..."
                : `${activeForConversation.participants.filter((p) => p.status === "JOINED").length} dang tham gia`}
            </span>
          </div>

          {activeForConversation.status === "RINGING" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Dang cho nguoi nhan tham gia phong goi.
              </span>
              <Button
                size="sm"
                variant="destructive"
                className="ml-auto h-8"
                onClick={() => void handleCancelOrEnd()}
                disabled={isSubmitting}
              >
                <PhoneOff className="size-4" />
                Huy
              </Button>
            </div>
          ) : (
            <ZegoCallRoom
              key={`${activeForConversation.callId}:${activeForConversation.roomId}`}
              call={activeForConversation}
              mediaType={activeForConversation.mediaType}
              onLeaveRoom={() => void handleLeaveFromSdkRoom()}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default CallOverlay;
