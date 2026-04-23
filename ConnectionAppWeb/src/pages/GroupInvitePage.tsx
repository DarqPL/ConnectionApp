import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { savePostLoginRedirect } from "@/lib/authRedirect";

const GroupInvitePage = () => {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const { addConvo, fetchMessages } = useChatStore();
  const [statusText, setStatusText] = useState("Dang mo link nhom...");

  useEffect(() => {
    const token = inviteToken?.trim();
    if (!token) {
      toast.error("Link nhom khong hop le");
      navigate("/", { replace: true });
      return;
    }

    if (!accessToken) {
      savePostLoginRedirect(`/groups/join/${encodeURIComponent(token)}`);
      navigate("/signin", { replace: true });
      return;
    }

    let cancelled = false;

    const joinGroup = async () => {
      try {
        setStatusText("Dang tham gia nhom...");
        const conversation = await chatService.joinGroupByInviteToken(token);
        if (cancelled) {
          return;
        }

        addConvo(conversation);
        await fetchMessages(conversation.id);
        if (cancelled) {
          return;
        }

        toast.success("Da mo nhom chat");
        navigate("/", { replace: true });
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        const message =
          error?.response?.data?.message || "Khong the mo link nhom nay";
        toast.error(message);
        navigate("/", { replace: true });
      }
    };

    void joinGroup();

    return () => {
      cancelled = true;
    };
  }, [accessToken, addConvo, fetchMessages, inviteToken, navigate]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-3 rounded-3xl border border-border/40 bg-background/70 p-8 shadow-xl backdrop-blur">
        <h1 className="text-xl font-semibold">Link nhom</h1>
        <p className="text-sm text-muted-foreground">{statusText}</p>
      </div>
    </div>
  );
};

export default GroupInvitePage;
