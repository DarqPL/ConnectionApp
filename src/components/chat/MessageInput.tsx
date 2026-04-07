import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation, Message } from "@/types/chat";
import { useState } from "react";
import { Button } from "../ui/button";
import { ImagePlus, Send, X } from "lucide-react";
import { Input } from "../ui/input";
import EmojiPicker from "./EmojiPicker";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";

interface MessageInputProps {
  selectedConvo: Conversation;
  replyTo: Message | null;
  onCancelReply: () => void;
}

const MessageInput = ({ selectedConvo, replyTo, onCancelReply }: MessageInputProps) => {
  const { user } = useAuthStore();
  const { sendMessage } = useChatStore();
  const [value, setValue] = useState("");

  if (!user) return;

  const handleSendMessage = async () => {
    if (!value.trim()) return;
    const currValue = value;
    setValue("");

    try {
      await sendMessage(selectedConvo.id, currValue, replyTo?.id ?? null);
      onCancelReply(); // Clear reply after sending
    } catch (error) {
      console.error(error);
      toast.error("Lỗi xảy ra khi gửi tin nhắn. Bạn hãy thử lại!");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="bg-background">
      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-l-4 border-l-primary/50">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary/80">
              Đang trả lời {replyTo.senderInfo.displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.recalledAt
                ? "Tin nhắn đã được thu hồi"
                : replyTo.content ?? ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 hover:bg-destructive/10"
            onClick={onCancelReply}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 p-3 min-h-[56px]">
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10 transition-smooth"
        >
          <ImagePlus className="size-4" />
        </Button>

        <div className="flex-1 relative">
          <Input
            onKeyPress={handleKeyPress}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Soạn tin nhắn..."
            className="pr-20 h-9 bg-white border-border/50 focus:border-primary/50 transition-smooth resize-none"
          ></Input>
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-primary/10 transition-smooth"
            >
              <div>
                <EmojiPicker
                  onChange={(emoji: string) => setValue(`${value}${emoji}`)}
                />
              </div>
            </Button>
          </div>
        </div>

        <Button
          onClick={handleSendMessage}
          className="bg-gradient-chat hover:shadow-glow transition-smooth hover:scale-105"
          disabled={!value.trim()}
        >
          <Send className="size-4 text-white" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
