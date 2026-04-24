import { Calendar, Clock, ChevronRight, AlarmClock, Users, Check, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { chatService } from "@/services/chatService";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import ReminderCreator from "./ReminderCreator";
import UserAvatar from "./UserAvatar";
import type { ReminderRequest } from "@/types/chat";

interface ReminderMessageProps {
  messageId: string;
  conversationId: number;
  reminder: {
    title: string;
    content?: string;
    reminderTime: string;
    isNotified?: boolean;
    notified?: boolean;
    creatorId: number;
    creatorName: string;
    participantIds?: number[];
    declinedIds?: number[];
  };
}

const ReminderMessage = ({ messageId, conversationId, reminder }: ReminderMessageProps) => {
  const { user } = useAuthStore();
  const { deleteReminder, createReminder, conversations } = useChatStore();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<"join" | "decline" | null>(null);

  const isCreator = user?.id === reminder.creatorId;
  const participantIds = reminder.participantIds ?? [];
  const declinedIds = reminder.declinedIds ?? [];
  const isJoined = user ? participantIds.includes(user.id) : false;
  const isDeclined = user ? declinedIds.includes(user.id) : false;
  const participantCount = participantIds.length;

  const reminderDate = new Date(reminder.reminderTime);
  const isNotified = reminder.isNotified || reminder.notified;

  const currentConvo = useMemo(() => 
    conversations.find(c => c.id === conversationId),
  [conversations, conversationId]);

  const joinedUsers = useMemo(() => {
    return participantIds.map(id => 
      currentConvo?.participants.find(p => p.userId === id)
    ).filter(Boolean);
  }, [participantIds, currentConvo]);

  const declinedUsers = useMemo(() => {
    return declinedIds.map(id => 
      currentConvo?.participants.find(p => p.userId === id)
    ).filter(Boolean);
  }, [declinedIds, currentConvo]);

  const handleJoin = async () => {
    if (isJoined || isLoading) return;
    setIsLoading("join");
    try {
      await chatService.joinReminder(messageId);
      toast.success("Đã đăng ký tham gia!");
    } catch {
      toast.error("Lỗi khi tham gia");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDecline = async () => {
    if (isDeclined || isLoading) return;
    setIsLoading("decline");
    try {
      await chatService.declineReminder(messageId);
      toast.info("Đã từ chối nhắc hẹn");
    } catch {
      toast.error("Lỗi khi từ chối");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteReminder(messageId);
      toast.success("Đã xóa nhắc hẹn");
    } catch {
      toast.error("Lỗi khi xóa nhắc hẹn");
    }
  };

  const handleUpdate = async (updatedData: Omit<ReminderRequest, "conversationId">) => {
    try {
      await deleteReminder(messageId);
      await createReminder({ ...updatedData, conversationId });
      toast.success("Đã cập nhật nhắc hẹn");
    } catch {
      toast.error("Lỗi khi cập nhật nhắc hẹn");
    }
  };

  return (
    <>
      <div className="w-full max-w-[460px] bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-border/40 overflow-hidden hover:shadow-2xl transition-all duration-300 animate-in fade-in zoom-in duration-500">

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-primary/10 dark:to-indigo-900/10 px-4 py-3 flex items-center justify-between border-b border-primary/10">
          <div className="flex items-center gap-2 text-primary font-bold text-[11px] uppercase tracking-wider">
            <AlarmClock className="size-4" />
            Lời Nhắc Hẹn
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-700">
              <Users className="size-3" />
              {participantCount} tham gia
            </div>
            {isNotified && (
              <div className="text-[11px] font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-700">
                Đã thông báo
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <h4 className="font-extrabold text-[18px] leading-snug text-foreground mb-3">
            {reminder.title}
          </h4>

          {reminder.content && (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed bg-muted/30 p-3 rounded-xl border border-dashed border-border/60">
              {reminder.content}
            </p>
          )}

          {/* Date/Time row */}
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 p-3 rounded-xl mb-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="size-9 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm shrink-0">
                <Calendar className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Ngày</p>
                <p className="text-sm font-bold">
                  {reminderDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </p>
              </div>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="flex items-center gap-2 flex-1">
              <div className="size-9 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm shrink-0">
                <Clock className="size-4 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Giờ nhắc</p>
                <p className="text-sm font-bold">
                  {reminderDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons - Join / Decline */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={handleJoin}
              disabled={isLoading !== null}
              variant="default"
              className={cn(
                "h-11 font-bold rounded-xl transition-all text-sm gap-2",
                isJoined
                  ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15"
                  : "bg-primary text-white hover:bg-primary/90 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {isLoading === "join" ? (
                <Clock className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {isJoined ? "Đã tham gia" : "Tôi sẽ tham gia"}
            </Button>

            <Button
              onClick={handleDecline}
              disabled={isLoading !== null}
              variant="outline"
              className={cn(
                "h-11 font-bold rounded-xl transition-all text-sm gap-2",
                isDeclined
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : "border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5"
              )}
            >
              {isLoading === "decline" ? (
                <Clock className="size-4 animate-spin" />
              ) : (
                <X className="size-4" />
              )}
              {isDeclined ? "Đã từ chối" : "Từ chối"}
            </Button>
          </div>

          {/* Participant Lists */}
          {(joinedUsers.length > 0 || declinedUsers.length > 0) && (
            <div className="space-y-4 border-t border-border/40 pt-4 animate-in slide-in-from-top-2 duration-300">
              {joinedUsers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase mb-2 flex items-center gap-1.5">
                    <Check className="size-3" />
                    Đã xác nhận ({joinedUsers.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {joinedUsers.map((u: any) => (
                      <div key={u.userId} className="flex items-center gap-1.5 bg-primary/5 border border-primary/10 rounded-full pl-1 pr-2 py-0.5" title={u.displayName}>
                        <UserAvatar 
                          type="chat" 
                          name={u.displayName} 
                          avatarUrl={u.avatarUrl} 
                          className="size-5 text-[8px]" 
                        />
                        <span className="text-[10px] font-medium max-w-[80px] truncate">{u.displayName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {declinedUsers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-destructive uppercase mb-2 flex items-center gap-1.5">
                    <X className="size-3" />
                    Đã từ chối ({declinedUsers.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {declinedUsers.map((u: any) => (
                      <div key={u.userId} className="flex items-center gap-1.5 bg-destructive/5 border border-destructive/10 rounded-full pl-1 pr-2 py-0.5" title={u.displayName}>
                        <UserAvatar 
                          type="chat" 
                          name={u.displayName} 
                          avatarUrl={u.avatarUrl} 
                          className="size-5 text-[8px]" 
                        />
                        <span className="text-[10px] font-medium max-w-[80px] truncate">{u.displayName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-muted/10 px-4 py-2.5 flex items-center justify-between border-t border-border/30">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <ChevronRight className="size-3 text-primary" />
            Người tạo: <span className="text-primary ml-1">{reminder.creatorName}</span>
          </span>

          {isCreator && (
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <button
                onClick={() => setIsEditOpen(true)}
                className="text-primary hover:text-primary/70 transition-colors uppercase tracking-wide"
              >
                Chỉnh sửa
              </button>
              <button
                onClick={handleDelete}
                className="text-destructive hover:text-destructive/70 transition-colors uppercase tracking-wide"
              >
                Xóa nhắc
              </button>
            </div>
          )}
        </div>
      </div>

      <ReminderCreator
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleUpdate}
        initialData={{
          title: reminder.title,
          content: reminder.content || "",
          reminderTime: reminder.reminderTime,
        }}
      />
    </>
  );
};

export default ReminderMessage;
