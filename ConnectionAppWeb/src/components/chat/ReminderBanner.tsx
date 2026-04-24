import { useState, useEffect } from "react";
import { Bell, ChevronRight, X, Clock, ChevronLeft, Edit2, Trash2, Check } from "lucide-react";
import { chatService } from "@/services/chatService";
import type { Reminder, ReminderRequest } from "@/types/chat";
import { Button } from "../ui/button";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReminderCreator from "./ReminderCreator";

interface ReminderBannerProps {
  conversationId: number;
}

const ReminderBanner = ({ conversationId }: ReminderBannerProps) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<"join" | "decline" | null>(null);
  const { deleteReminder, createReminder } = useChatStore();
  const { client } = useSocketStore();
  const { user } = useAuthStore();

  const fetchReminders = async () => {
    try {
      const data = await chatService.fetchReminders(conversationId);
      const upcoming = data
        .filter(r => new Date(r.reminderTime) > new Date())
        .sort((a, b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime());
      setReminders(upcoming);
    } catch (error) {
      console.error("Failed to fetch reminders for banner", error);
    }
  };

  useEffect(() => {
    fetchReminders();

    if (client && client.connected && user) {
      const subReminders = client.subscribe(`/topic/user.${user.id}/reminders`, (message) => {
        const updatedReminder = JSON.parse(message.body);
        setReminders(prev => {
          const exists = prev.some(r => r.id === updatedReminder.id);
          const newReminders = exists
            ? prev.map(r => r.id === updatedReminder.id ? updatedReminder : r)
            : [...prev, updatedReminder];
          return newReminders
            .filter(r => new Date(r.reminderTime) > new Date())
            .sort((a, b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime());
        });
      });

      const subDeleted = client.subscribe(`/topic/user.${user.id}/reminder-deleted`, (message) => {
        try {
          let deletedId: string;
          try {
            deletedId = JSON.parse(message.body);
          } catch {
            deletedId = message.body;
          }
          
          if (deletedId) {
            const idStr = String(deletedId);
            setReminders(prev => prev.filter(r => String(r.id) !== idStr));
          }
        } catch (error) {
          console.error("Error processing banner reminder-deleted:", error);
        }
      });

      return () => {
        subReminders.unsubscribe();
        subDeleted.unsubscribe();
      };
    }

    const interval = setInterval(fetchReminders, 60000);
    return () => clearInterval(interval);
  }, [conversationId, client?.connected, user?.id]);

  if (!isVisible || reminders.length === 0) return null;

  const current = reminders[currentIndex];
  const reminderDate = new Date(current.reminderTime);
  const isCreator = user?.id === current.creatorId;
  const participantIds = current.participantIds ?? [];
  const declinedIds = current.declinedIds ?? [];
  const isJoined = user ? participantIds.includes(user.id) : false;
  const isDeclined = user ? declinedIds.includes(user.id) : false;

  const nextReminder = () => setCurrentIndex(prev => (prev + 1) % reminders.length);
  const prevReminder = () => setCurrentIndex(prev => (prev - 1 + reminders.length) % reminders.length);

  const handleDelete = async () => {
    try {
      await deleteReminder(current.id);
      toast.success("Đã xóa nhắc hẹn");
      fetchReminders();
    } catch {
      toast.error("Lỗi khi xóa nhắc hẹn");
    }
  };

  const handleUpdate = async (updatedData: Omit<ReminderRequest, "conversationId">) => {
    try {
      await deleteReminder(current.id);
      await createReminder({ ...updatedData, conversationId });
      toast.success("Đã cập nhật nhắc hẹn");
      fetchReminders();
    } catch {
      toast.error("Lỗi khi cập nhật nhắc hẹn");
    }
  };

  const handleJoin = async () => {
    if (isJoined || isLoading) return;
    setIsLoading("join");
    try {
      await chatService.joinReminder(current.id);
      toast.success("Đã đăng ký tham gia!");
      fetchReminders();
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
      await chatService.declineReminder(current.id);
      toast.info("Đã từ chối nhắc hẹn");
      fetchReminders();
    } catch {
      toast.error("Lỗi khi từ chối");
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="bg-gradient-to-r from-violet-50/80 to-indigo-50/60 dark:from-primary/5 dark:to-indigo-900/5 border-b border-primary/10 px-4 py-2.5 flex items-center gap-3 animate-in slide-in-from-top duration-300 relative group">
      {/* Bell icon */}
      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
        <Bell className="size-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Nhắc hẹn ({currentIndex + 1}/{reminders.length})
          </span>
          <span className="text-[10px] text-muted-foreground">•</span>
          <div className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full border border-amber-200/60">
            <Clock className="size-3" />
            {reminderDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} –{" "}
            {reminderDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
          </div>
          <div className="text-[10px] text-violet-600 font-semibold">
            {participantIds.length} tham gia
          </div>
        </div>
        <p className="text-sm font-bold text-foreground truncate leading-tight">
          {current.title}
        </p>
      </div>

      {/* Actions - visible on hover */}
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {/* Join button - for everyone */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleJoin}
          disabled={isLoading !== null}
          className={cn(
            "h-7 px-3 text-[11px] font-bold rounded-full gap-1.5 transition-all",
            isJoined
              ? "bg-primary/10 text-primary border-primary/30 cursor-default"
              : "border-primary/40 text-primary hover:bg-primary hover:text-white"
          )}
        >
          <Check className="size-3" />
          {isJoined ? "Đã tham gia" : "Tham gia"}
        </Button>

        {/* Decline button - for everyone */}
        {!isJoined && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDecline}
            disabled={isLoading !== null}
            className={cn(
              "h-7 px-3 text-[11px] font-bold rounded-full gap-1.5 transition-all",
              isDeclined
                ? "text-destructive bg-destructive/10 cursor-default"
                : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            )}
          >
            {isDeclined ? "Đã từ chối" : "Từ chối"}
          </Button>
        )}

        {/* Creator-only: Edit & Delete */}
        {isCreator && (
          <div className="flex items-center gap-1 ml-1 pl-2 border-l border-border/50">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-primary hover:bg-primary/10"
              onClick={() => setIsEditOpen(true)}
            >
              <Edit2 className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Navigate between reminders */}
        {reminders.length > 1 && (
          <div className="flex items-center ml-1 pl-2 border-l border-border/50">
            <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={prevReminder}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={nextReminder}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Close banner */}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => setIsVisible(false)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <ReminderCreator
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleUpdate}
        initialData={{
          title: current.title,
          content: current.content || "",
          reminderTime: current.reminderTime,
        }}
      />
    </div>
  );
};

export default ReminderBanner;
