import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Calendar as CalendarIcon, Clock, AlarmClock } from "lucide-react";
import { useState, useEffect } from "react";
import type { ReminderRequest } from "@/types/chat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";

interface ReminderCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<ReminderRequest, "conversationId">) => void;
  initialData?: {
    title: string;
    content: string;
    reminderTime: string;
  };
}

const ReminderCreator = ({ isOpen, onClose, onSave, initialData }: ReminderCreatorProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setContent(initialData.content);
      
      // Parse local time string carefully to avoid timezone shifts
      // backend format is "YYYY-MM-DDTHH:mm:ss"
      const parts = initialData.reminderTime.split("T");
      if (parts.length === 2) {
        setDate(parts[0]);
        setTime(parts[1].substring(0, 5));
      } else {
        const d = new Date(initialData.reminderTime);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setDate(`${year}-${month}-${day}`);
        setTime(`${hours}:${minutes}`);
      }
    } else {
      // Default to tomorrow 9 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
      setTime("09:00");
      setTitle("");
      setContent("");
    }
  }, [initialData, isOpen]);

  const handleSave = () => {
    if (!title.trim() || !date || !time) return;

    // Send local ISO string without "Z" suffix to preserve local time for LocalDateTime
    const localReminderTime = `${date}T${time}:00`;
    onSave({
      title: title.trim(),
      content: content.trim(),
      reminderTime: localReminderTime,
    });
    
    if (!initialData) {
      setTitle("");
      setContent("");
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] overflow-hidden border-none p-0 bg-white dark:bg-zinc-900 shadow-2xl">
        <div className="bg-gradient-to-r from-primary/20 to-secondary/20 p-6 pb-4">
          <DialogHeader>
            <div className="size-12 rounded-2xl bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center mb-4 animate-in zoom-in duration-500">
              <AlarmClock className="size-6 text-primary animate-pulse" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {initialData ? "Chỉnh sửa nhắc hẹn" : "Tạo nhắc hẹn mới"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80">
              {initialData ? "Cập nhật lại thời gian và nội dung công việc cần nhắc." : "Đặt lịch để chúng tôi giúp bạn không bỏ lỡ những sự kiện quan trọng."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Tiêu đề nhắc hẹn</label>
            <Input
              placeholder="Ví dụ: Họp nhóm dự án, Sinh nhật..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 text-base focus-visible:ring-primary border-muted bg-muted/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Ngày nhắc</label>
              <div className="relative">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-12 pl-10 focus-visible:ring-primary border-muted bg-muted/20"
                />
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Giờ nhắc</label>
              <div className="relative">
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-12 pl-10 focus-visible:ring-primary border-muted bg-muted/20"
                />
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-amber-500" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Ghi chú (tùy chọn)</label>
            <Textarea
              placeholder="Thêm mô tả chi tiết cho công việc này..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px] resize-none focus-visible:ring-primary border-muted bg-muted/20"
            />
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 h-12 font-bold hover:bg-muted">
            Để sau
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !date || !time}
            className="flex-[2] h-12 bg-gradient-chat text-white font-bold shadow-glow hover:scale-[1.02] active:scale-95 transition-all"
          >
            {initialData ? "Lưu thay đổi" : "Xác nhận tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderCreator;
