import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation, Message } from "@/types/chat";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import {
  FileText,
  ImagePlus,
  Languages,
  ListTodo,
  Loader2,
  Send,
  Sparkles,
  Wand2,
  X,
  Bell,
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
import PollCreator from "./PollCreator";
import ReminderCreator from "./ReminderCreator";
import type { PollRequest, ReminderRequest } from "@/types/chat";

const LOCK_NOTICE_KEY = "auth_lock_notice";

const MAX_FILES = 5;

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
  isImage: boolean;
}

type DeliveryState = "SENT" | "RECEIVED" | null;

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
  const [deliveryState, setDeliveryState] = useState<DeliveryState>(null);
  const deliveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPollCreatorOpen, setIsPollCreatorOpen] = useState(false);
  const [isReminderCreatorOpen, setIsReminderCreatorOpen] = useState(false);

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (deliveryTimeoutRef.current) {
        clearTimeout(deliveryTimeoutRef.current);
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

    if (deliveryTimeoutRef.current) {
      clearTimeout(deliveryTimeoutRef.current);
      deliveryTimeoutRef.current = null;
    }

    setDeliveryState(null);
  }, [notifyStoppedTyping, selectedConvo.id]);

  if (!user) return null;

  const currentUserRole = selectedConvo.participants.find(
    (p) => p.userId === user.id
  )?.role || null;
  const isAdmin = currentUserRole === "OWNER" || currentUserRole === "CO_OWNER";
  const canSendMessage =
    selectedConvo.type !== "GROUP" ||
    selectedConvo.allowMemberSendMessage ||
    isAdmin;

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
    const filesToUpload = [...pendingFiles];
    const replyId = replyTo?.id ?? null;
    if (!currValue && filesToUpload.length === 0) return;
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
    setValue("");
    clearPendingFiles();
    onCancelReply();

    try {
      const uploadedAttachments =
        filesToUpload.length === 0
          ? []
          : await Promise.all(
              filesToUpload.map((item) =>
                chatService.uploadAttachment(item.file),
              ),
            );

      await sendMessage(
        selectedConvo.id,
        currValue,
        replyId,
        uploadedAttachments,
        null, // poll
      );

      setDeliveryState("SENT");
      if (deliveryTimeoutRef.current) {
        clearTimeout(deliveryTimeoutRef.current);
      }
      deliveryTimeoutRef.current = setTimeout(() => {
        setDeliveryState("RECEIVED");
      }, 700);
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
        setDeliveryState(null);
        return;
      }

      if (status === 403 && code === "CHAT_BLOCKED") {
        toast.error(message || "Bạn đã bị chặn");
        await onBlockedDetected?.();
      } else {
        toast.error("Lỗi xảy ra khi gửi tin nhắn. Bạn hãy thử lại!");
      }

      setDeliveryState(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreatePoll = async (poll: PollRequest) => {
    setIsUploading(true);
    try {
      await sendMessage(
        selectedConvo.id,
        "", // content empty for poll-only message
        null, // parentId
        [], // attachments
        poll,
      );
      toast.success("Đã tạo cuộc bầu chọn!");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tạo cuộc bầu chọn.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateReminder = async (
    reminder: Omit<ReminderRequest, "conversationId">,
  ) => {
    setIsUploading(true);
    try {
      await chatService.createReminder({
        ...reminder,
        conversationId: selectedConvo.id,
      });
      toast.success("Đã tạo nhắc hẹn!");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tạo nhắc hẹn.");
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

  const isComposing = value.trim().length > 0;
  const deliveryLabel =
    deliveryState === "SENT"
      ? "Đã gửi"
      : deliveryState === "RECEIVED"
        ? "Đã nhận"
        : null;

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

      {/* Disabled message for non-admin when allowMemberSendMessage is false */}
      {!canSendMessage && (
        <div className="flex items-center justify-center px-4 py-3 bg-muted/30 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            Chỉ trưởng nhóm và phó nhóm được nhắn tin
          </p>
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

      {(isComposing || deliveryLabel) && (
        <div className="px-4 pt-1.5 pb-0.5 text-xs text-muted-foreground flex items-center justify-between">
          {isComposing ? (
            <span className="italic">Bạn đang soạn tin...</span>
          ) : (
            <span></span>
          )}
          {deliveryLabel && (
            <span className="font-medium">{deliveryLabel}</span>
          )}
        </div>
      )}

      <div className={cn("flex items-center gap-2 p-3 min-h-14", !canSendMessage && "opacity-50 pointer-events-none")}>
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
          disabled={isUploading || pendingFiles.length >= MAX_FILES || !canSendMessage}
        >
          <ImagePlus className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10 transition-smooth"
          type="button"
          onClick={() => setIsPollCreatorOpen(true)}
          disabled={isUploading || !canSendMessage}
        >
          <ListTodo className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10 transition-smooth"
          type="button"
          onClick={() => setIsReminderCreatorOpen(true)}
          disabled={isUploading || !canSendMessage}
        >
          <Bell className="size-4" />
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
                      disabled={isUploading || isAiProcessing || !canSendMessage}
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
              disabled={!canSendMessage}
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
          disabled={isUploading || (!value.trim() && pendingFiles.length === 0) || !canSendMessage}
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

      <PollCreator
        isOpen={isPollCreatorOpen}
        onClose={() => setIsPollCreatorOpen(false)}
        onSave={handleCreatePoll}
      />

      <ReminderCreator
        isOpen={isReminderCreatorOpen}
        onClose={() => setIsReminderCreatorOpen(false)}
        onSave={handleCreateReminder}
      />
    </div>
  );
};

export default MessageInput;
