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
  AlertTriangle,
  CornerUpLeft,
  Download,
  FileText,
  Loader2,
  PlayCircle,
  Undo2,
  Forward,
  X,
  ZoomIn,
  ZoomOut,
  MoreVertical,
  Trash2,
  Pin,
  ThumbsUp,
  Key,
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
import { detectEmailInMessage, isValidEmailFormat } from "@/lib/emailDetector";
import { friendService } from "@/services/friendService";
import BusinessCard from "../profile/BusinessCard";
import { getOrFetchEmailUser } from "@/lib/userCache";
import { useAuthStore } from "@/stores/useAuthStore";
import PollMessage from "./PollMessage";
import ReminderMessage from "./ReminderMessage";
import React from "react";

const QUICK_REACTIONS = ["👍", "❤️", "😆", "😮", "😢", "😡"] as const;

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
  onForward?: (message: Message) => void;
  onReplyPreviewClick?: (parentId: string) => void;
  isHighlighted?: boolean;
}

const MessageItemBase = ({
  message,
  index,
  messages,
  selectedConvo,
  lastMessageStatus: _lastMessageStatus,
  onReply,
  onForward,
  onReplyPreviewClick,
  isHighlighted = false,
}: MessageItemProps) => {
  const { user: currentUser } = useAuthStore();
  const {
    recallMessage,
    deleteMessage,
    pinMessage,
    reactMessage,
    retrySendMessage,
  } = useChatStore();

  type ActionType = "recall" | "delete" | "pin";

  const [showMenu, setShowMenu] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
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
  const reactionHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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

  const isAdmin = participant?.role === "OWNER" || participant?.role === "CO_OWNER";
  const isOwner = participant?.role === "OWNER";
  const isCoOwner = participant?.role === "CO_OWNER";
  const markAdminMessages = selectedConvo.markAdminMessages ?? false;
  const showKeyIcon = markAdminMessages && isAdmin && !message.isOwn;

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
  const reactions = message.reactions ?? [];
  const myReaction = reactions.find(
    (reaction) => reaction.userId === currentUser?.id,
  );
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const key = reaction.reactionCode;
    const current = acc.get(key);
    if (current) {
      current.count += 1;
      current.userIds.push(reaction.userId);
    } else {
      acc.set(key, {
        emoji: key,
        count: 1,
        userIds: [reaction.userId],
      });
    }
    return acc;
  }, new Map<string, { emoji: string; count: number; userIds: number[] }>());
  const reactionSummary = Array.from(groupedReactions.values());

  const handleReact = async (reactionCode: string | null) => {
    if (!currentUser) {
      return;
    }

    try {
      await reactMessage(message.conversationId, message.id, reactionCode);
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Khong the tha cam xuc luc nay";
      toast.error(errorMsg);
    }
  };

  const handleQuickLike = () => {
    const nextReaction = myReaction?.reactionCode === "👍" ? null : "👍";
    void handleReact(nextReaction);
  };

  const handlePickReaction = (reactionCode: string) => {
    const nextReaction =
      myReaction?.reactionCode === reactionCode ? null : reactionCode;
    setIsReactionPickerOpen(false);
    void handleReact(nextReaction);
  };

  const openReactionPicker = () => {
    if (reactionHoverTimeoutRef.current) {
      clearTimeout(reactionHoverTimeoutRef.current);
      reactionHoverTimeoutRef.current = null;
    }
    setIsReactionPickerOpen(true);
  };

  const closeReactionPickerWithDelay = () => {
    if (reactionHoverTimeoutRef.current) {
      clearTimeout(reactionHoverTimeoutRef.current);
    }

    reactionHoverTimeoutRef.current = setTimeout(() => {
      setIsReactionPickerOpen(false);
      reactionHoverTimeoutRef.current = null;
    }, 160);
  };

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

  useEffect(() => {
    return () => {
      if (reactionHoverTimeoutRef.current) {
        clearTimeout(reactionHoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMoreClick = () => {
    setShowMenu(false);
    setShowActionDialog(true);
  };

  const handleActionSelect = (type: ActionType) => {
    setActionType(type);
    setShowActionDialog(true);
  };

  const handleActionConfirm = async () => {
    setIsProcessing(true);
    try {
      if (actionType === "recall") {
        await recallMessage(message.conversationId, message.id);
        toast.success("Đã thu hồi tin nhắn từ tất cả mọi người");
      } else if (actionType === "delete") {
        await deleteMessage(message.conversationId, message.id);
        toast.success("Đã xóa tin nhắn ở phía bạn");
      } else if (actionType === "pin") {
        await pinMessage(message.conversationId, message.id);
        toast.success("Đã ghim tin nhắn");
      }
      setShowActionDialog(false);
      setActionType(null);
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Thao tác thất bại. Vui lòng thử lại!";
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReply = () => {
    setShowMenu(false);
    onReply(message);
  };

  const handleForward = () => {
    setShowMenu(false);
    if (onForward) {
      onForward(message);
    }
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
        <span className="flex justify-center text-xs text-muted-foreground px-1 mb-2">
          {formatMessageTime(new Date(message.createdAt))}
        </span>
      )}

      {message.reminder ||
      (message.content && message.content.startsWith("[Nhắc hẹn] ")) ? (
        <div className="flex justify-center w-full my-4 px-4">
          <ReminderMessage
            messageId={message.id}
            conversationId={message.conversationId}
            reminder={
              message.reminder || {
                title:
                  message.content?.replace("[Nhắc hẹn] ", "") || "Nhắc hẹn",
                content: "Nhắc hẹn từ tin nhắn cũ",
                reminderTime: message.createdAt,
                isNotified: true,
                creatorId: message.senderInfo.senderId,
                creatorName: message.senderInfo.displayName,
              }
            }
          />
        </div>
      ) : message.poll ? (
        <div className="flex justify-center w-full my-4 px-4">
          <PollMessage
            messageId={message.id}
            poll={message.poll}
            senderId={message.senderInfo.senderId}
          />
        </div>
      ) : (
        <div
          data-message-id={message.id}
          className={cn(
            "flex gap-2 message-bounce mt-1 group rounded-md transition-colors",
            isHighlighted && "bg-yellow-200/40",
            message.isOwn ? "justify-end" : "justify-start",
          )}
        >
          {/* avatar */}
          {!message.isOwn && (
            <div className="w-8 shrink-0 relative">
              {isGroupBreak && (
                <>
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
                  {showKeyIcon && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-4 bg-background rounded-full flex items-center justify-center">
                      <Key
                        className={cn(
                          "size-3",
                          isOwner ? "text-amber-500" : "text-blue-500"
                        )}
                      />
                    </div>
                  )}
                </>
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
              {(() => {
                const replyInfo = message.replyInfo;
                if (!replyInfo || isRecalled) return null;

                return (
                  <button
                    type="button"
                    onClick={() => onReplyPreviewClick?.(replyInfo.parentId)}
                    className="text-left text-xs px-3 py-1.5 rounded-t-lg border-l-2 border-primary/40 bg-muted/60 max-w-full mb-0 hover:bg-muted/80 transition-colors"
                  >
                    <span className="font-semibold text-primary/70 text-[11px]">
                      {replyInfo.parentSenderName}
                    </span>
                    <p className="truncate text-muted-foreground text-[11px]">
                      {(() => {
                        if (replyInfo.parentRecalled)
                          return "Tin nhắn đã được thu hồi";
                        if (replyInfo.parentContent)
                          return replyInfo.parentContent;
                        const atts = replyInfo.parentAttachments;
                        if (atts && atts.length > 0) {
                          const first = atts[0];
                          if (first.type === "IMAGE")
                            return atts.length > 1
                              ? `📷 ${atts.length} hình ảnh`
                              : "📷 Hình ảnh";
                          if (first.type === "VIDEO")
                            return atts.length > 1
                              ? `🎥 ${atts.length} video`
                              : "🎥 Video";
                          if (first.type === "AUDIO") return "🎵 Âm thanh";
                          return `📄 ${first.originalFileName ?? "Tệp đính kèm"}`;
                        }
                        return "Tin nhắn đã được thu hồi";
                      })()}
                    </p>
                  </button>
                );
              })()}

              <div className="relative pb-1">
                <Card
                  className={cn(
                    "p-3",
                    isRecalled
                      ? "bg-muted/30 border-dashed border-muted-foreground/30"
                      : message.isOwn
                        ? "chat-bubble-sent border-0"
                        : showKeyIcon
                          ? isOwner
                            ? "chat-bubble-received border-2 border-amber-400/60"
                            : "chat-bubble-received border-2 border-blue-400/60"
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
                                onClick={() =>
                                  handleDownloadAttachment(attachment)
                                }
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

                {!isRecalled && (
                  <div
                    className={cn(
                      "absolute -bottom-2 z-20 transition-all duration-150",
                      "opacity-0 scale-95 pointer-events-none",
                      "group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto",
                      message.isOwn ? "right-1" : "left-1",
                    )}
                    onMouseEnter={openReactionPicker}
                    onMouseLeave={closeReactionPickerWithDelay}
                  >
                    <button
                      onClick={handleQuickLike}
                      className={cn(
                        "h-6 w-6 rounded-full border border-border/80 bg-background/95 shadow-sm flex items-center justify-center transition-colors",
                        myReaction?.reactionCode === "👍"
                          ? "border-primary/40 bg-primary/10"
                          : "hover:bg-muted",
                      )}
                      title="Thả cảm xúc"
                    >
                      <ThumbsUp
                        className={cn(
                          "size-3",
                          myReaction?.reactionCode === "👍"
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                    </button>
                    <div
                      className={cn(
                        "absolute z-20 bottom-full mb-2 rounded-full border border-zinc-700/80 bg-zinc-900/95 px-2 py-1 shadow-xl backdrop-blur-sm",
                        message.isOwn ? "right-0" : "left-0",
                        "transition-opacity duration-150",
                        isReactionPickerOpen
                          ? "pointer-events-auto opacity-100"
                          : "pointer-events-none opacity-0",
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {QUICK_REACTIONS.map((reactionCode) => (
                          <button
                            key={reactionCode}
                            type="button"
                            onClick={() => handlePickReaction(reactionCode)}
                            className={cn(
                              "rounded-full px-1.5 py-1 text-lg transition-transform hover:scale-110",
                              myReaction?.reactionCode === reactionCode &&
                                "bg-primary/15",
                            )}
                          >
                            {reactionCode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {message.isOwn &&
                (message.status === "SENDING" || message.status === "ERROR") &&
                !isRecalled && (
                  <div
                    className={cn(
                      "mt-1 flex items-center",
                      message.isOwn ? "justify-end" : "justify-start",
                    )}
                  >
                    {message.status === "SENDING" && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        <span>Dang gui...</span>
                      </div>
                    )}
                    {message.status === "ERROR" && (
                      <button
                        type="button"
                        onClick={() =>
                          retrySendMessage(
                            message.conversationId,
                            message.tempId ?? message.id,
                          )
                        }
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                        title="Gui lai"
                      >
                        <AlertTriangle className="size-3" />
                        <span>Gui that bai. Thu lai</span>
                      </button>
                    )}
                  </div>
                )}

              {reactionSummary.length > 0 && (
                <div
                  className={cn(
                    "mt-1 flex",
                    message.isOwn ? "justify-end" : "justify-start",
                  )}
                >
                  <div className="inline-flex items-center gap-1 rounded-full border border-zinc-700/70 bg-zinc-900/90 px-1.5 py-1 text-white shadow-md backdrop-blur-sm">
                    {reactionSummary.map((reaction) => {
                      const isMine =
                        currentUser != null &&
                        reaction.userIds.includes(currentUser.id);

                      return (
                        <button
                          key={reaction.emoji}
                          type="button"
                          onClick={() =>
                            isMine
                              ? void handleReact(null)
                              : void handleReact(reaction.emoji)
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition-colors",
                            isMine && "bg-white/15",
                          )}
                          title={isMine ? "Bo cam xuc" : "Tha cam xuc"}
                        >
                          <span className="text-sm leading-none">
                            {reaction.emoji}
                          </span>
                          <span className="font-medium text-zinc-200">
                            {reaction.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons — inline next to bubble */}
            {!isRecalled && (
              <div
                ref={menuRef}
                className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-0.5">
                  {onForward && (
                    <button
                      onClick={handleForward}
                      className="p-1.5 rounded-full hover:bg-muted transition-colors"
                      title="Chuyển tiếp"
                    >
                      <Forward className="size-3.5 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={handleReply}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors"
                    title="Trả lời"
                  >
                    <CornerUpLeft className="size-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={handleMoreClick}
                    className="p-1.5 rounded-full hover:bg-primary/10 transition-colors"
                    title="Thêm tùy chọn"
                  >
                    <MoreVertical className="size-3.5 text-muted-foreground hover:text-primary" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message action dialog (recall vs delete) */}
      <Dialog
        open={showActionDialog}
        onOpenChange={(open) => {
          if (!open && !isProcessing) {
            setShowActionDialog(false);
            setActionType(null);
          }
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-sm">
          {actionType === null ? (
            <>
              <DialogHeader>
                <DialogTitle>Lựa chọn hành động</DialogTitle>
                <DialogDescription>
                  Bạn muốn xóa tin nhắn này như thế nào?
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => handleActionSelect("recall")}
                  disabled={isProcessing}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">⏮️ Thu hồi</span>
                    <span className="text-xs text-muted-foreground">
                      Xóa từ tất cả mọi người
                    </span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => handleActionSelect("pin")}
                  disabled={isProcessing}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">📌 Ghim tin nhắn</span>
                    <span className="text-xs text-muted-foreground">
                      Hiện thị ở đầu đoạn chat cho mọi người
                    </span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => handleActionSelect("delete")}
                  disabled={isProcessing}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">🗑️ Xóa ở phía tôi</span>
                    <span className="text-xs text-muted-foreground">
                      Chỉ bạn sẽ không thấy
                    </span>
                  </div>
                </Button>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowActionDialog(false)}
                  disabled={isProcessing}
                >
                  Hủy
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {actionType === "recall" ? (
                    <>
                      <Undo2 className="size-4 text-destructive" />
                      Thu hồi tin nhắn
                    </>
                  ) : actionType === "pin" ? (
                    <>
                      <Pin className="size-4 text-primary" />
                      Ghim tin nhắn
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4 text-destructive" />
                      Xóa tin nhắn
                    </>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {actionType === "recall"
                    ? "Tin nhắn sẽ bị thu hồi từ tất cả mọi người trong cuộc trò chuyện."
                    : actionType === "pin"
                      ? "Tin nhắn này sẽ được ghim ở đầu đoạn chat để mọi người cùng thấy."
                      : "Tin nhắn sẽ bị xóa khỏi thiết bị của bạn. Những người khác vẫn sẽ thấy."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setActionType(null)}
                  disabled={isProcessing}
                >
                  Quay lại
                </Button>
                <Button
                  variant={actionType === "pin" ? "default" : "destructive"}
                  onClick={handleActionConfirm}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? actionType === "recall"
                      ? "Đang thu hồi..."
                      : actionType === "pin"
                        ? "Đang ghim..."
                        : "Đang xóa..."
                    : actionType === "recall"
                      ? "Thu hồi"
                      : actionType === "pin"
                        ? "Ghim"
                        : "Xóa"}
                </Button>
              </DialogFooter>
            </>
          )}
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

const MessageItem = React.memo(MessageItemBase);

export default MessageItem;
