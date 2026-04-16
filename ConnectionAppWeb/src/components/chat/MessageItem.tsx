import { cn, formatMessageTime } from "@/lib/utils";
import type {
  Attachment,
  Conversation,
  Message,
  Participant,
} from "@/types/chat";
import type { User } from "@/types/user";
import UserAvatar from "./UserAvatar";
import { Card } from "../ui/card";
import {
  CornerUpLeft,
  Download,
  FileText,
  PlayCircle,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import {
  detectEmailInMessage,
  isValidEmailFormat,
} from "@/lib/emailDetector";
import { userService } from "@/services/userService";
import { friendService } from "@/services/friendService";
import BusinessCard from "../profile/BusinessCard";
import { getOrFetchEmailUser } from "@/lib/userCache";
import { useAuthStore } from "@/stores/useAuthStore";

const isImageAttachment = (attachment: Attachment): boolean => {
  if (attachment.type === "IMAGE") {
    return true;
  }
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(attachment.fileUrl);
};

const isVideoAttachment = (attachment: Attachment): boolean => {
  if (attachment.type === "VIDEO") {
    return true;
  }
  return /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|$)/i.test(attachment.fileUrl);
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
  onReply,
}: MessageItemProps) => {
  const { user: currentUser } = useAuthStore();
  const { recallMessage } = useChatStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showRecallConfirm, setShowRecallConfirm] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [previewImage, setPreviewImage] = useState<Attachment | null>(null);
  const [previewVideo, setPreviewVideo] = useState<Attachment | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [previewViewport, setPreviewViewport] = useState({
    width: 0,
    height: 0,
  });
  const [previewImageSize, setPreviewImageSize] = useState({
    width: 0,
    height: 0,
  });
  const [isPanning, setIsPanning] = useState(false);

  // Email detection & business card display
  const [detectedEmail, setDetectedEmail] = useState<string | null>(null);
  const [emailUser, setEmailUser] = useState<User | null>(null);
  const [emailUserStatus, setEmailUserStatus] = useState<
    "FRIEND" | "SENDING" | "RECEIVED" | "NONE"
  >("NONE");

  const menuRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
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

  // Detect email in message and load user info
  // Trigger for all messages so both sender and receiver can see the business card
  useEffect(() => {
    const email = detectEmailInMessage(message.content || "");
    setDetectedEmail(email);

    // If no email detected or email format invalid, show as normal text
    if (!email || !isValidEmailFormat(email)) {
      setEmailUser(null);
      setEmailUserStatus("NONE");
      return;
    }

    // Fetch user by email via cache controller
    const loadEmailUser = async () => {
      try {
        const result = await getOrFetchEmailUser(email);
        setEmailUser(result.user);
        setEmailUserStatus(result.status);
      } catch (error) {
        console.error("[EmailCard] Error loading email user:", error);
        setEmailUser(null);
        setEmailUserStatus("NONE");
      }
    };

    loadEmailUser();
  }, [message.content, message.isOwn]);

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

  const handleRecallClick = () => {
    setShowMenu(false);
    setShowRecallConfirm(true);
  };

  const handleRecallConfirm = async () => {
    setRecalling(true);
    try {
      await recallMessage(message.conversationId, message.id);
      setShowRecallConfirm(false);
    } catch {
      toast.error("Không thể thu hồi tin nhắn. Vui lòng thử lại!");
    } finally {
      setRecalling(false);
    }
  };

  const handleReply = () => {
    setShowMenu(false);
    onReply(message);
  };

  const handleAddFriend = async () => {
    if (!emailUser) return;
    try {
      await friendService.sendFriendRequest(emailUser.id);
      setEmailUserStatus("SENDING");
      toast.success("Đã gửi lời mời kết bạn");
    } catch {
      toast.error("Không thể kết bạn lúc này");
    }
  };

  const handleAcceptFriend = async () => {
    if (!emailUser) return;
    try {
      await friendService.acceptFriendRequest(emailUser.id);
      setEmailUserStatus("FRIEND");
      toast.success("Đã kết bạn thành công");
    } catch {
      toast.error("Lỗi khi kết bạn");
    }
  };

  const handleCancelRequest = async () => {
    if (!emailUser) return;
    try {
      await friendService.cancelFriendRequest(emailUser.id);
      setEmailUserStatus("NONE");
    } catch {
      toast.error("Lỗi khi hủy lời mời");
    }
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
    setPreviewVideo(null);
    setPreviewImageSize({ width: 0, height: 0 });
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
    setPreviewImage(attachment);
  };

  const openVideoPreview = (attachment: Attachment) => {
    setPreviewImage(null);
    setIsPanning(false);
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
    setPreviewVideo(attachment);
  };

  const closeImagePreview = () => {
    setIsPanning(false);
    setPreviewImage(null);
    setPreviewImageSize({ width: 0, height: 0 });
    setPreviewViewport({ width: 0, height: 0 });
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  const closeVideoPreview = () => {
    setPreviewVideo(null);
  };

  const clampZoom = (value: number): number =>
    Math.max(1, Math.min(4, Number(value.toFixed(2))));

  const getPanBounds = (zoom: number) => {
    const viewportWidth = previewViewport.width;
    const viewportHeight = previewViewport.height;

    if (zoom <= 1 || viewportWidth <= 0 || viewportHeight <= 0) {
      return { maxX: 0, maxY: 0 };
    }

    let renderedWidth = viewportWidth;
    let renderedHeight = viewportHeight;

    if (previewImageSize.width > 0 && previewImageSize.height > 0) {
      const fitScale = Math.min(
        viewportWidth / previewImageSize.width,
        viewportHeight / previewImageSize.height,
      );
      renderedWidth = previewImageSize.width * fitScale;
      renderedHeight = previewImageSize.height * fitScale;
    }

    return {
      maxX: Math.max(0, (renderedWidth * zoom - viewportWidth) / 2),
      maxY: Math.max(0, (renderedHeight * zoom - viewportHeight) / 2),
    };
  };

  const clampPan = (pan: { x: number; y: number }, zoom = previewZoom) => {
    const bounds = getPanBounds(zoom);
    return {
      x: Math.min(bounds.maxX, Math.max(-bounds.maxX, pan.x)),
      y: Math.min(bounds.maxY, Math.max(-bounds.maxY, pan.y)),
    };
  };

  const handlePreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.15 : -0.15;
    setPreviewZoom((prev) => {
      const next = clampZoom(prev + delta);
      setPreviewPan((current) => clampPan(current, next));
      return next;
    });
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

      setPreviewPan(
        clampPan({
          x: panStartRef.current.x + deltaX,
          y: panStartRef.current.y + deltaY,
        }),
      );
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
      return;
    }

    setPreviewPan((current) => clampPan(current, previewZoom));
  }, [previewZoom, previewViewport, previewImageSize]);

  useEffect(() => {
    if (!previewImage) {
      return;
    }

    const updateViewport = () => {
      const rect = previewViewportRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setPreviewViewport({
        width: rect.width,
        height: rect.height,
      });
    };

    const rafId = window.requestAnimationFrame(updateViewport);
    window.addEventListener("resize", updateViewport);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateViewport);
    };
  }, [previewImage]);

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

                        if (isVideoAttachment(attachment)) {
                          return (
                            <button
                              type="button"
                              key={`${attachment.fileUrl}-${idx}`}
                              onClick={() => openVideoPreview(attachment)}
                              className="block w-full overflow-hidden rounded-md border border-border/40 bg-zinc-900/70"
                            >
                              <div className="relative h-36 w-full bg-zinc-900">
                                <video
                                  src={attachment.fileUrl}
                                  preload="metadata"
                                  muted
                                  playsInline
                                  className="pointer-events-none h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                  <PlayCircle className="size-10 text-white" />
                                </div>
                              </div>
                              <div className="min-w-0 bg-black/35 px-2 py-1.5 text-left">
                                <p className="truncate text-xs font-medium text-white">
                                  {resolveFileName(
                                    attachment.originalFileName,
                                    attachment.fileUrl,
                                  )}
                                </p>
                                <p className="text-[11px] text-zinc-300">
                                  Nhấn để xem video
                                </p>
                              </div>
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

                  {/* Display business card if email is detected and the user is found in the system */}
                  {emailUser && (
                    <div className="mt-3 -m-3 p-3 bg-muted/30 rounded-md">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">
                        Danh thiếp từ {detectedEmail}
                      </p>
                      <BusinessCard
                        user={emailUser}
                        relationshipStatus={emailUserStatus}
                        isModal={false}
                        variant="compact"
                        hideActions={
                          emailUser.id === currentUser?.id ||
                          (message.isOwn && emailUserStatus === "FRIEND")
                        }
                        onAddFriend={handleAddFriend}
                        onAccept={handleAcceptFriend}
                        onCancel={handleCancelRequest}
                      />
                    </div>
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
                    onClick={handleRecallClick}
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

      {/* Recall confirm dialog */}
      <Dialog
        open={showRecallConfirm}
        onOpenChange={(open) => {
          if (!open && !recalling) setShowRecallConfirm(false);
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="size-4 text-destructive" />
              Thu hồi tin nhắn
            </DialogTitle>
            <DialogDescription>
              Tin nhắn sẽ bị thu hồi với tất cả mọi người trong cuộc trò chuyện.
              Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRecallConfirm(false)}
              disabled={recalling}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleRecallConfirm}
              disabled={recalling}
            >
              {recalling ? "Đang thu hồi..." : "Thu hồi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) {
            closeImagePreview();
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
                onClick={closeImagePreview}
                className="absolute -top-4 -right-4 z-20 rounded-full border border-zinc-700 bg-black p-2 text-white hover:bg-zinc-900"
                title="Close"
              >
                <X className="size-4" />
              </button>

              <div className="relative overflow-hidden rounded-lg border-4 border-black bg-black">
                <div
                  ref={previewViewportRef}
                  className="relative h-[72vh] overflow-hidden bg-zinc-900"
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
                    onLoad={(event) => {
                      setPreviewImageSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      });
                    }}
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

                <div className="flex items-center justify-center gap-2 border-t border-zinc-700 bg-black/90 px-3 pb-3 pt-2 text-white">
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

      <Dialog
        open={!!previewVideo}
        onOpenChange={(open) => {
          if (!open) {
            closeVideoPreview();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-4xl border-none bg-transparent p-0 shadow-none"
        >
          {previewVideo && (
            <div className="relative pt-2">
              <button
                type="button"
                onClick={closeVideoPreview}
                className="absolute -top-4 -right-4 z-20 rounded-full border border-zinc-700 bg-black p-2 text-white hover:bg-zinc-900"
                title="Close"
              >
                <X className="size-4" />
              </button>

              <div className="relative overflow-hidden rounded-lg border-4 border-black bg-black">
                <div className="relative h-[72vh] overflow-hidden bg-zinc-900">
                  <video
                    className="h-full w-full"
                    src={previewVideo.fileUrl}
                    controls
                    autoPlay
                    preload="metadata"
                  />
                </div>

                <div className="flex items-center justify-center gap-2 border-t border-zinc-700 bg-black/90 px-3 pb-3 pt-2 text-white">
                  <button
                    type="button"
                    onClick={() => handleDownloadAttachment(previewVideo)}
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
