import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation, Message } from "@/types/chat";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { FileText, ImagePlus, Loader2, Send, X } from "lucide-react";
import { Input } from "../ui/input";
import EmojiPicker from "./EmojiPicker";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";
import { chatService } from "@/services/chatService";

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
  isImage: boolean;
}

const formatFileSize = (size: number): string => {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const isImageFile = (file: File): boolean => {
  if ((file.type ?? "").startsWith("image/")) {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
};

interface MessageInputProps {
  selectedConvo: Conversation;
  replyTo: Message | null;
  onCancelReply: () => void;
  onBlockedDetected?: () => Promise<void> | void;
}

const MessageInput = ({
  selectedConvo,
  replyTo,
  onCancelReply,
  onBlockedDetected,
}: MessageInputProps) => {
  const { user } = useAuthStore();
  const { sendMessage } = useChatStore();
  const [value, setValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const pendingFilesRef = useRef<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  if (!user) return null;

  const clearPendingFiles = () => {
    pendingFiles.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setPendingFiles([]);
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => {
      const found = prev.find((item) => item.id === id);
      if (found?.previewUrl) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";

    if (selected.length === 0) {
      return;
    }

    const availableSlots = MAX_FILES - pendingFiles.length;
    if (availableSlots <= 0) {
      toast.error(`Ban chi duoc gui toi da ${MAX_FILES} tep mot lan.`);
      return;
    }

    const candidates = selected.slice(0, availableSlots);
    if (selected.length > availableSlots) {
      toast.warning(
        `Chi lay ${availableSlots} tep dau tien vi gioi han ${MAX_FILES} tep.`,
      );
    }

    const nextItems: PendingAttachment[] = [];
    let rejectedBySize = 0;

    candidates.forEach((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejectedBySize += 1;
        return;
      }

      const image = isImageFile(file);
      nextItems.push({
        id: `${Date.now()}-${Math.random()}-${file.name}`,
        file,
        previewUrl: image ? URL.createObjectURL(file) : null,
        isImage: image,
      });
    });

    if (rejectedBySize > 0) {
      toast.error(`${rejectedBySize} tep vuot qua 2MB nen khong duoc them.`);
    }

    if (nextItems.length === 0) {
      return;
    }

    setPendingFiles((prev) => [...prev, ...nextItems]);
  };

  const handleSendMessage = async () => {
    const currValue = value.trim();
    if (!currValue && pendingFiles.length === 0) return;
    if (isUploading) return;

    setIsUploading(true);

    try {
      const uploadedAttachments =
        pendingFiles.length === 0
          ? []
          : await Promise.all(
              pendingFiles.map((item) =>
                chatService.uploadAttachment(item.file),
              ),
            );

      await sendMessage(
        selectedConvo.id,
        currValue,
        replyTo?.id ?? null,
        uploadedAttachments,
      );

      setValue("");
      clearPendingFiles();
      onCancelReply(); // Clear reply after sending
    } catch (error) {
      console.error(error);
      const status = (error as any)?.response?.status;
      const code = (error as any)?.response?.data?.code;
      const message = (error as any)?.response?.data?.message;

      if (status === 403 && code === "CHAT_BLOCKED") {
        toast.error(message || "Bạn đã bị chặn");
        await onBlockedDetected?.();
      } else {
        toast.error("Lỗi xảy ra khi gửi tin nhắn. Bạn hãy thử lại!");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
                : (replyTo.content ?? "")}
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

      {pendingFiles.length > 0 && (
        <div className="px-3 pt-2 border-t border-border/40">
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((item) => (
              <div
                key={item.id}
                className="relative rounded-lg border border-border/50 bg-muted/30 p-2 pr-8 max-w-45"
              >
                <button
                  type="button"
                  onClick={() => removePendingFile(item.id)}
                  className="absolute top-1 right-1 rounded-full p-1 hover:bg-destructive/10"
                  aria-label="Remove file"
                  disabled={isUploading}
                >
                  <X className="size-3" />
                </button>

                {item.isImage && item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="h-14 w-14 rounded object-cover mb-1"
                  />
                ) : (
                  <div className="mb-1">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                )}

                <p
                  className="text-xs font-medium truncate"
                  title={item.file.name}
                >
                  {item.file.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatFileSize(item.file.size)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 p-3 min-h-14">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handlePickFiles}
        />

        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10 transition-smooth"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || pendingFiles.length >= MAX_FILES}
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
                  onChange={(emoji: string) =>
                    setValue((prev) => `${prev}${emoji}`)
                  }
                />
              </div>
            </Button>
          </div>
        </div>

        <Button
          onClick={handleSendMessage}
          className="bg-gradient-chat hover:shadow-glow transition-smooth hover:scale-105"
          disabled={isUploading || (!value.trim() && pendingFiles.length === 0)}
        >
          {isUploading ? (
            <Loader2 className="size-4 text-white animate-spin" />
          ) : (
            <Send className="size-4 text-white" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
