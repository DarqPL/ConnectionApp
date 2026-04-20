import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation, Message } from "@/types/chat";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  FileText,
  ImagePlus,
  Languages,
  Loader2,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Input } from "../ui/input";
import EmojiPicker from "./EmojiPicker";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { toast } from "sonner";
import {
  chatService,
  type AiRewriteAction,
  type AiRewriteRequest,
} from "@/services/chatService";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_LABEL,
} from "@/config/upload";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const LOCK_NOTICE_KEY = "auth_lock_notice";

const MAX_FILES = 5;

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
  const { notifyTyping, notifyStoppedTyping, disconnectSocket } =
    useSocketStore();
  const { clearState } = useAuthStore();
  const [value, setValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const pendingFilesRef = useRef<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStateRef = useRef(false);
  const conversationRef = useRef<number>(selectedConvo.id);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (typingStateRef.current) {
        notifyStoppedTyping(conversationRef.current);
      }

      pendingFilesRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [notifyStoppedTyping]);

  useEffect(() => {
    if (
      conversationRef.current !== selectedConvo.id &&
      typingStateRef.current
    ) {
      notifyStoppedTyping(conversationRef.current);
    }

    conversationRef.current = selectedConvo.id;
    typingStateRef.current = false;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [notifyStoppedTyping, selectedConvo.id]);

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
      if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
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
      toast.error(
        `${rejectedBySize} tep vuot qua ${MAX_UPLOAD_FILE_SIZE_LABEL} nen khong duoc them.`,
      );
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

    if (typingStateRef.current) {
      notifyStoppedTyping(selectedConvo.id);
      typingStateRef.current = false;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

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
      const remainingMinutes = (error as any)?.response?.data?.remainingMinutes;

      if (status === 403 && code === "ACCOUNT_TEMP_LOCKED") {
        const lockMessage =
          message ||
          (Number(remainingMinutes) > 0
            ? `Bạn đã vi phạm chính sách của chúng tôi. Tài khoản bị khóa ${remainingMinutes} phút.`
            : "Bạn đã vi phạm chính sách của chúng tôi.");

        toast.error(lockMessage);

        sessionStorage.setItem(LOCK_NOTICE_KEY, lockMessage);

        disconnectSocket();
        clearState();

        if (window.location.pathname !== "/signin") {
          window.location.href = "/signin";
        }
        return;
      }

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

  const scheduleStoppedTyping = (conversationId: number) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      notifyStoppedTyping(conversationId);
      typingStateRef.current = false;
      typingTimeoutRef.current = null;
    }, 1200);
  };

  const applyTypingState = (nextValue: string) => {
    const normalized = nextValue.trim();
    const conversationId = selectedConvo.id;

    if (!normalized) {
      if (typingStateRef.current) {
        notifyStoppedTyping(conversationId);
        typingStateRef.current = false;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    if (!typingStateRef.current) {
      notifyTyping(conversationId);
      typingStateRef.current = true;
    }

    scheduleStoppedTyping(conversationId);
  };

  const handleValueChange = (nextValue: string) => {
    setValue(nextValue);
    applyTypingState(nextValue);
  };

  const applyAiRewrittenDraft = (nextDraft: string) => {
    setValue(nextDraft);
    applyTypingState(nextDraft);
  };

  const callAiRewrite = async (
    action: AiRewriteAction,
    targetLanguage?: "EN" | "VI",
  ) => {
    const draft = value.trim();
    if (action !== "SUGGEST_REPLY" && !draft) {
      toast.error("Vui lòng nhập nội dung trước khi dùng AI Rewrite.");
      return;
    }

    const payload: AiRewriteRequest = {
      conversationId: selectedConvo.id,
      draftContent: draft,
      action,
      targetLanguage,
    };

    setIsAiMenuOpen(false);
    setIsAiProcessing(true);

    try {
      const result = await chatService.aiRewriteDraft(payload);

      if (action === "SUGGEST_REPLY") {
        const suggestions = (result.suggestions ?? [])
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 3);

        if (suggestions.length === 0) {
          toast.error("AI chưa tạo được gợi ý trả lời.");
          return;
        }

        setAiSuggestions(suggestions);
        setIsSuggestionDialogOpen(true);
        return;
      }

      const rewritten = result.rewrittenText?.trim();
      if (!rewritten) {
        toast.error("AI Rewrite trả về dữ liệu không hợp lệ.");
        return;
      }

      applyAiRewrittenDraft(rewritten);
      toast.success("Đã thay nội dung soạn bằng kết quả AI.");
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "Không thể xử lý AI Rewrite lúc này.";
      toast.error(message);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    applyAiRewrittenDraft(suggestion);
    setIsSuggestionDialogOpen(false);
    setAiSuggestions([]);
    toast.success("Đã thay nội dung soạn bằng gợi ý AI.");
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
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Soạn tin nhắn..."
            className="pr-28 h-9 bg-white border-border/50 focus:border-primary/50 transition-smooth resize-none"
          ></Input>
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            <Popover open={isAiMenuOpen} onOpenChange={setIsAiMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:bg-primary/10 transition-smooth"
                  disabled={isUploading || isAiProcessing}
                >
                  {isAiProcessing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => callAiRewrite("TRANSLATE", "VI")}
                    disabled={isAiProcessing}
                  >
                    <Languages className="size-4 mr-2" />
                    Dịch sang tiếng Việt
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => callAiRewrite("TRANSLATE", "EN")}
                    disabled={isAiProcessing}
                  >
                    <Languages className="size-4 mr-2" />
                    Translate to English
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => callAiRewrite("SUGGEST_REPLY")}
                    disabled={isAiProcessing}
                  >
                    <Sparkles className="size-4 mr-2" />
                    Gợi ý 3 câu trả lời
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => callAiRewrite("REWRITE_STYLE")}
                    disabled={isAiProcessing}
                  >
                    <Wand2 className="size-4 mr-2" />
                    Viết lịch sự, ngắn gọn
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-primary/10 transition-smooth"
            >
              <div>
                <EmojiPicker
                  onChange={(emoji: string) => {
                    setValue((prev) => {
                      const next = `${prev}${emoji}`;
                      applyTypingState(next);
                      return next;
                    });
                  }}
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

      <Dialog
        open={isSuggestionDialogOpen}
        onOpenChange={(open) => {
          setIsSuggestionDialogOpen(open);
          if (!open) {
            setAiSuggestions([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gợi ý trả lời từ AI</DialogTitle>
            <DialogDescription>
              Chọn 1 gợi ý, nội dung sẽ thay thế toàn bộ ô soạn hiện tại.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {aiSuggestions.map((suggestion, index) => (
              <Button
                key={`${index}-${suggestion}`}
                type="button"
                variant="outline"
                className="w-full h-auto whitespace-normal text-left justify-start"
                onClick={() => handleSuggestionSelect(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessageInput;
