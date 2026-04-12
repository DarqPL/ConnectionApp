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
  ChevronLeft,
  ChevronRight,
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
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const pointerStartRef = useRef({ x: 0, y: 0 });

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
    setPreviewPan({ x: 0, y: 0 });
    setPreviewImage(attachment);
  };

  const closePreview = () => {
    setIsPanning(false);
    setPreviewImage(null);
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  const clampZoom = (value: number): number =>
    Math.max(1, Math.min(4, Number(value.toFixed(2))));

  const handlePreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.15 : -0.15;
    setPreviewZoom((prev) => clampZoom(prev + delta));
  };

  const handlePreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (previewZoom <= 1) {
      return;
    }

    event.preventDefault();
    setIsPanning(true);
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    panStartRef.current = { ...previewPan };
  };

  useEffect(() => {
    if (!isPanning) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - pointerStartRef.current.x;
      const deltaY = event.clientY - pointerStartRef.current.y;

      setPreviewPan({
        x: panStartRef.current.x + deltaX,
        y: panStartRef.current.y + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning]);

  useEffect(() => {
    if (previewZoom <= 1) {
      setPreviewPan({ x: 0, y: 0 });
    }
  }, [previewZoom]);

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
          className="max-w-4xl border-none bg-transparent p-0 shadow-none"
        >
          {previewImage && (
            <div className="relative pt-2">
              <button
                type="button"
                onClick={closePreview}
                className="absolute -top-4 -right-4 z-20 rounded-full border border-zinc-700 bg-black p-2 text-white hover:bg-zinc-900"
                title="Close"
              >
                <X className="size-4" />
              </button>

              <div className="relative rounded-lg border-4 border-black bg-black">
                <div
                  className="relative h-[80vh] overflow-hidden rounded-[4px] bg-zinc-900"
                  onWheel={handlePreviewWheel}
                  onMouseDown={handlePreviewMouseDown}
                >
                  <img
                    src={previewImage.fileUrl}
                    alt={resolveFileName(
                      previewImage.originalFileName,
                      previewImage.fileUrl,
                    )}
                    draggable={false}
                    className="mx-auto h-full w-full select-none object-contain"
                    style={{
                      transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                      transformOrigin: "center center",
                      transition: isPanning
                        ? "none"
                        : "transform 140ms ease-out",
                      cursor:
                        previewZoom > 1
                          ? isPanning
                            ? "grabbing"
                            : "grab"
                          : "default",
                    }}
                  />
                </div>

                <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-700 bg-black/85 px-2 py-1.5 text-white">
                  <button
                    type="button"
                    disabled
                    className="rounded-full p-2 text-zinc-400"
                    title="Previous"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-full p-2 text-zinc-400"
                    title="Next"
                    aria-label="Next image"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewZoom((prev) => clampZoom(prev - 0.25))
                    }
                    className="rounded-full bg-zinc-900 p-2 hover:bg-zinc-800"
                    title="Zoom out"
                  >
                    <ZoomOut className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewZoom((prev) => clampZoom(prev + 0.25))
                    }
                    className="rounded-full bg-zinc-900 p-2 hover:bg-zinc-800"
                    title="Zoom in"
                  >
                    <ZoomIn className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadAttachment(previewImage)}
                    className="rounded-full bg-zinc-900 p-2 hover:bg-zinc-800"
                    title="Download"
                  >
                    <Download className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MessageItem;
