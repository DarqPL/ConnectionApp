import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCallStore } from "@/stores/useCallStore";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Video,
  Mic,
  MicOff,
} from "lucide-react";
import { toast } from "sonner";
import ZegoCallRoom from "./ZegoCallRoom";

interface CallOverlayProps {
  conversationId: number;
}

const CallOverlay = ({ conversationId }: CallOverlayProps) => {
  const { user } = useAuthStore();
  const {
    incomingCall,
    activeCall,
    acceptCall,
    rejectCall,
    endCall,
    updateParticipantState,
    ensureActiveCallToken,
  } = useCallStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const incomingForConversation =
    incomingCall?.conversationId === conversationId ? incomingCall : null;
  const activeForConversation =
    activeCall?.conversationId === conversationId ? activeCall : null;

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

  const myParticipant = useMemo(() => {
    if (!activeForConversation || !user) {
      return null;
    }

    return (
      activeForConversation.participants.find(
        (participant) => participant.userId === user.id,
      ) ?? null
    );
  }, [activeForConversation, user]);

  useEffect(() => {
    if (!activeForConversation) {
      return;
    }

    if (activeForConversation.token?.token) {
      return;
    }

    void ensureActiveCallToken(activeForConversation.callId);
  }, [activeForConversation, ensureActiveCallToken]);

  if (!incomingForConversation && !activeForConversation) {
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

  const handleEnd = async () => {
    if (!activeForConversation || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await endCall(activeForConversation.callId, "ENDED_BY_USER");
      toast.success("Da ket thuc cuoc goi");
    } catch (error) {
      console.error(error);
      toast.error("Khong the ket thuc cuoc goi");
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

  const handleToggleAudio = async () => {
    if (!activeForConversation || !myParticipant || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateParticipantState(activeForConversation.callId, {
        audioMuted: !myParticipant.audioMuted,
      });
    } catch (error) {
      console.error(error);
      toast.error("Khong the cap nhat microphone");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleVideo = async () => {
    if (!activeForConversation || !myParticipant || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateParticipantState(activeForConversation.callId, {
        videoMuted: !myParticipant.videoMuted,
      });
    } catch (error) {
      console.error(error);
      toast.error("Khong the cap nhat camera");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-b border-border/40 bg-muted/40 px-4 py-3">
      {incomingForConversation && (
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

      {activeForConversation && (
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
              {
                activeForConversation.participants.filter(
                  (p) => p.status === "JOINED",
                ).length
              }{" "}
              dang tham gia
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => void handleToggleAudio()}
              disabled={isSubmitting || !myParticipant}
            >
              {myParticipant?.audioMuted ? (
                <MicOff className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
              {myParticipant?.audioMuted ? "Bat mic" : "Tat mic"}
            </Button>

            {activeForConversation.mediaType === "VIDEO" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => void handleToggleVideo()}
                disabled={isSubmitting || !myParticipant}
              >
                <Video className="size-4" />
                {myParticipant?.videoMuted ? "Bat cam" : "Tat cam"}
              </Button>
            )}

            <Button
              size="sm"
              variant="destructive"
              className="ml-auto h-8"
              onClick={() => void handleEnd()}
              disabled={isSubmitting}
            >
              <PhoneOff className="size-4" />
              Ket thuc
            </Button>
          </div>

          <ZegoCallRoom
            call={activeForConversation}
            mediaType={activeForConversation.mediaType}
            onLeaveRoom={() => void handleLeaveFromSdkRoom()}
          />
        </div>
      )}
    </div>
  );
};

export default CallOverlay;
