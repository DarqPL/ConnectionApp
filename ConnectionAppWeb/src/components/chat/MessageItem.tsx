import { cn, formatMessageTime } from "@/lib/utils";
import type {
  Attachment,
  Conversation,
  Message,
  Participant,
} from "@/types/chat";
import UserAvatar from "./UserAvatar";
import { Card } from "../ui/card";
import {
  CornerUpLeft,
  Download,
  FileText,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Dialog, DialogContent } from "../ui/dialog";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";

const isImageAttachment = (attachment: Attachment): boolean => {
  if (attachment.type === "IMAGE") {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(attachment.fileUrl);
};

const resolveFileName = (
  originalFileName: string | null | undefined,
  url: string,
): string => {
  if (originalFileName && originalFileName.trim().length > 0) {
    return originalFileName;
  }

  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] || "attached-file");
  } catch {
    return "attached-file";
  }
};

interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  selectedConvo: Conversation;
  lastMessageStatus: "delivered" | "seen";
  onReply: (message: Message) => void;
}

const MessageItem = ({
  message,
  index,
  messages,
  selectedConvo,
  lastMessageStatus,
  onReply,
}: MessageItemProps) => {
  const { recallMessage } = useChatStore();
  const [showMenu, setShowMenu] = useState(false);
  const [previewImage, setPreviewImage] = useState<Attachment | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const menuRef = useRef<HTMLDivElement>(null);

  const prev = index + 1 < messages.length ? messages[index + 1] : undefined;

  const isShowTime =
    index === 0 ||
    new Date(message.createdAt).getTime() -
      new Date(prev?.createdAt || 0).getTime() >
      300000; // 5 phút

  const isGroupBreak =
    isShowTime || message.senderInfo.senderId !== prev?.senderInfo.senderId;

  const participant = selectedConvo.participants.find(
    (p: Participant) => p.userId === message.senderInfo.senderId,
  );

  const isRecalled = !!message.recalledAt;
  const attachments = message.attachments ?? [];

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const handleRecall = async () => {
    setShowMenu(false);
    try {
      await recallMessage(message.conversationId, message.id);
    } catch {
      toast.error("Không thể thu hồi tin nhắn. Vui lòng thử lại!");
    }
  };

  const handleReply = () => {
    setShowMenu(false);
    onReply(message);
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    const fileName = resolveFileName(
      attachment.originalFileName,
      attachment.fileUrl,
    );

    try {
      const response = await fetch(attachment.fileUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(objectUrl);
    } catch {
      const anchor = document.createElement("a");
      anchor.href = attachment.fileUrl;
      anchor.download = fileName;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  };

  const openImagePreview = (attachment: Attachment) => {
    setPreviewZoom(1);
    setPreviewImage(attachment);
  };

  const closePreview = () => {
    setPreviewImage(null);
    setPreviewZoom(1);
  };

  return (
    <>
      {/* time */}
      {isShowTime && (
        <span className="flex justify-center text-xs text-muted-foreground px-1">
          {formatMessageTime(new Date(message.createdAt))}
        </span>
      )}

      <div
        className={cn(
          "flex gap-2 message-bounce mt-1 group",
          message.isOwn ? "justify-end" : "justify-start",
        )}
      >
        {/* avatar */}
        {!message.isOwn && (
          <div className="w-8 shrink-0">
            {isGroupBreak && (
              <UserAvatar
                type="chat"
                name={
                  participant?.displayName ??
                  message.senderInfo.displayName ??
                  "User"
                }
                avatarUrl={
                  participant?.avatarUrl ??
                  message.senderInfo.avatarUrl ??
                  undefined
                }
              />
            )}
          </div>
        )}

        {/* Message + action row */}
        <div
          className={cn(
            "flex items-center gap-1",
            message.isOwn ? "flex-row-reverse" : "flex-row",
          )}
        >
          {/* Bubble column */}
          <div
            className={cn(
              "max-w-xs lg:max-w-md space-y-0 flex flex-col",
              message.isOwn ? "items-end" : "items-start",
            )}
          >
            {/* Reply preview */}
            {message.replyInfo && !isRecalled && (
              <div className="text-xs px-3 py-1.5 rounded-t-lg border-l-2 border-primary/40 bg-muted/60 max-w-full mb-0">
                <span className="font-semibold text-primary/70 text-[11px]">
                  {message.replyInfo.parentSenderName}
                </span>
                <p className="truncate text-muted-foreground text-[11px]">
                  {message.replyInfo.parentContent ??
                    "Tin nhắn đã được thu hồi"}
                </p>
              </div>
            )}

            <Card
              className={cn(
                "p-3",
                isRecalled
                  ? "bg-muted/30 border-dashed border-muted-foreground/30"
                  : message.isOwn
                    ? "chat-bubble-sent border-0"
                    : "chat-bubble-received",
                message.replyInfo && !isRecalled ? "rounded-t-none" : "",
              )}
            >
              {isRecalled ? (
                <p className="text-sm leading-relaxed italic text-muted-foreground">
                  Tin nhắn đã được thu hồi
                </p>
              ) : (
                <div className="space-y-2">
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((attachment, idx) => {
                        if (isImageAttachment(attachment)) {
                          return (
                            <button
                              type="button"
                              key={`${attachment.fileUrl}-${idx}`}
                              onClick={() => openImagePreview(attachment)}
                              className="block"
                            >
                              <img
                                src={attachment.fileUrl}
                                alt="attachment"
                                className="rounded-md max-h-52 w-auto object-cover border border-border/40"
                              />
                            </button>
                          );
                        }

                        return (
                          <button
                            type="button"
                            key={`${attachment.fileUrl}-${idx}`}
                            onClick={() => handleDownloadAttachment(attachment)}
                            className="flex w-full items-center gap-2 rounded-md border border-border/40 px-2 py-1.5 hover:bg-muted/40"
                          >
                            <FileText className="size-4 shrink-0" />
                            <span className="text-xs truncate text-left">
                              {resolveFileName(
                                attachment.originalFileName,
                                attachment.fileUrl,
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {message.content && (
                    <p className="text-sm leading-relaxed wrap-break-word">
                      {message.content}
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Action buttons — inline next to bubble */}
          {!isRecalled && (
            <div
              ref={menuRef}
              className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleReply}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  title="Trả lời"
                >
                  <CornerUpLeft className="size-3.5 text-muted-foreground" />
                </button>
                {message.isOwn && (
                  <button
                    onClick={handleRecall}
                    className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors"
                    title="Thu hồi"
                  >
                    <Undo2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) {
            closePreview();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-4xl p-2 border-4 border-black bg-black"
        >
          {previewImage && (
            <div className="relative">
              <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((prev) =>
                      Math.max(0.5, Number((prev - 0.25).toFixed(2))),
                    )
                  }
                  className="rounded-full bg-black/80 p-2 text-white hover:bg-black"
                  title="Zoom out"
                >
                  <ZoomOut className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((prev) =>
                      Math.min(4, Number((prev + 0.25).toFixed(2))),
                    )
                  }
                  className="rounded-full bg-black/80 p-2 text-white hover:bg-black"
                  title="Zoom in"
                >
                  <ZoomIn className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(previewImage)}
                  className="rounded-full bg-black/80 p-2 text-white hover:bg-black"
                  title="Download"
                >
                  <Download className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-full bg-black p-2 text-white hover:bg-zinc-800"
                  title="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="max-h-[80vh] overflow-auto rounded border border-black bg-zinc-900 p-4">
                <img
                  src={previewImage.fileUrl}
                  alt={resolveFileName(
                    previewImage.originalFileName,
                    previewImage.fileUrl,
                  )}
                  className="mx-auto max-h-[72vh] w-auto object-contain transition-transform"
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MessageItem;
