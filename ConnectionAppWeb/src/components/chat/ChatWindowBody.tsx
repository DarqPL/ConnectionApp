import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import MessageItem from "./MessageItem";
import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import type { Message } from "@/types/chat";
import { toast } from "sonner";

interface ChatWindowBodyProps {
  onReply: (message: Message) => void;
  onForward?: (message: Message) => void;
  isLocked?: boolean;
  isDeleted?: boolean;
}

const ChatWindowBody = ({
  onReply,
  onForward,
  isLocked,
  isDeleted,
}: ChatWindowBodyProps) => {
  const {
    activeConversationId,
    conversations,
    messages: allMessages,
    fetchMessages,
    messageLoading,
  } = useChatStore();
  const { user } = useAuthStore();

  const [lastMessageStatus] = useState<
    "delivered" | "seen"
  >("delivered");
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  const selectedConvo = conversations.find(
    (c) => c.id === activeConversationId,
  );

  const key = `chat-scroll-${activeConversationId}`;

  // Tách biệt việc lấy tin nhắn và xử lý sau khi đã có selectedConvo
  const messages = selectedConvo
    ? (allMessages[selectedConvo.id]?.items ?? [])
    : [];
  const reversedMessages = useMemo(() => {
    const nextMessages = messages.slice();
    nextMessages.reverse();
    return nextMessages;
  }, [messages]);

  // Filter messages based on allowNewMembersReadHistory setting
  const filteredMessages = useMemo(() => {
    if (!selectedConvo || selectedConvo.allowNewMembersReadHistory !== false) {
      return reversedMessages;
    }

    const currentUserParticipant = selectedConvo.participants.find(
      (p) => p.userId === user?.id
    );
    if (!currentUserParticipant) return reversedMessages;

    const joinedAt = new Date(currentUserParticipant.joinedAt).getTime();
    return reversedMessages.filter(
      (msg) => new Date(msg.createdAt).getTime() >= joinedAt
    );
  }, [reversedMessages, selectedConvo, user?.id]);

  // Stop fetching older messages when allowNewMembersReadHistory is false
  // and we've reached messages older than the user's join date
  const shouldFetchMore = useMemo(() => {
    if (!selectedConvo || selectedConvo.allowNewMembersReadHistory !== false) {
      return true;
    }

    const currentUserParticipant = selectedConvo.participants.find(
      (p) => p.userId === user?.id
    );
    if (!currentUserParticipant) return true;

    const joinedAt = new Date(currentUserParticipant.joinedAt).getTime();
    const oldestMessage = reversedMessages[reversedMessages.length - 1];
    if (!oldestMessage) return true;

    return new Date(oldestMessage.createdAt).getTime() >= joinedAt;
  }, [reversedMessages, selectedConvo, user?.id]);

  const hasMore = selectedConvo
    ? (allMessages[selectedConvo.id]?.hasMore ?? false) && shouldFetchMore
    : false;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const manualScrollToBottomRef = useRef(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const scrollToBottom = (
    behavior: ScrollBehavior = "smooth",
    lockIndicator = false,
  ) => {
    const container = containerRef.current;
    if (!container) return;

    if (lockIndicator) {
      manualScrollToBottomRef.current = true;
    }

    container.scrollTo({
      top: 0,
      behavior,
    });

    setShowScrollToBottom(false);
    setIsAtBottom(true);
  };

  useLayoutEffect(() => {
    manualScrollToBottomRef.current = false;
    setShowScrollToBottom(false);
    setIsAtBottom(true);
    setHighlightedMessageId(null);
    sessionStorage.removeItem(key);
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [activeConversationId]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const fetchMoreMessages = async () => {
    if (!activeConversationId) return;
    await fetchMessages(activeConversationId);
  };

  const handleScrollSave = () => {
    const container = containerRef.current;
    if (!container || !activeConversationId) return;

    const distanceFromBottom = Math.abs(container.scrollTop);
    const atBottom = distanceFromBottom <= 24;

    if (manualScrollToBottomRef.current) {
      if (atBottom) {
        manualScrollToBottomRef.current = false;
      }

      setIsAtBottom(atBottom);
      setShowScrollToBottom(false);

      sessionStorage.setItem(
        key,
        JSON.stringify({
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
        }),
      );
      return;
    }

    setIsAtBottom(atBottom);
    setShowScrollToBottom(distanceFromBottom > 56);

    sessionStorage.setItem(
      key,
      JSON.stringify({
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      }),
    );
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const item = sessionStorage.getItem(key);
    if (item) {
      const { scrollTop } = JSON.parse(item);
      requestAnimationFrame(() => {
        container.scrollTop = scrollTop;
      });
    }
  }, [messages.length]);

  useEffect(() => {
    if (!messages.length) {
      setShowScrollToBottom(false);
      setIsAtBottom(true);
      return;
    }

    if (isAtBottom) {
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [messages.length, isAtBottom]);

  const handleReplyPreviewClick = (parentId: string) => {
    const targetExists = messages.some((msg) => msg.id === parentId);
    if (!targetExists) {
      toast.info("Không tìm thấy tin nhắn gốc trong danh sách hiện tại");
      return;
    }

    const targetElement = containerRef.current?.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(parentId)}"]`,
    );

    if (!targetElement) {
      toast.info("Không thể điều hướng đến tin nhắn này");
      return;
    }

    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    setHighlightedMessageId(parentId);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1500);
  };

  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  if (!messages.length) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {messageLoading
          ? "Đang tải tin nhắn..."
          : "Chưa có tin nhắn nào trong cuộc trò chuyện này."}
      </div>
    );
  }

  return (
    <div className="relative p-4 bg-primary-foreground h-full flex flex-col overflow-hidden">
      <div
        id="scrollableDiv"
        ref={containerRef}
        onScroll={handleScrollSave}
        className="relative flex flex-col-reverse overflow-y-auto overflow-x-hidden beautiful-scrollbar"
      >
        <div ref={messagesEndRef}></div>

        <InfiniteScroll
          dataLength={filteredMessages.length}
          next={fetchMoreMessages}
          hasMore={hasMore}
          scrollableTarget="scrollableDiv"
          loader={<p>Đang tải...</p>}
          inverse={true}
          style={{
            display: "flex",
            flexDirection: "column-reverse",
            overflow: "visible",
          }}
        >
          {filteredMessages.map((message, index) => (
            <MessageItem
              key={message.id ?? index}
              message={message}
              index={index}
              messages={filteredMessages}
              selectedConvo={selectedConvo}
              lastMessageStatus={lastMessageStatus}
              onReply={onReply}
              onForward={onForward}
              onReplyPreviewClick={handleReplyPreviewClick}
              isHighlighted={highlightedMessageId === message.id}
            />
          ))}

          {/* 🔥 Thông báo ở cuối chat */}
          {(isLocked || isDeleted) && (
            <div className="text-center text-xs text-muted-foreground mt-2">
              {isLocked && "Tài khoản này đã bị khóa"}
              {isDeleted && "Tài khoản này đã bị xóa"}
            </div>
          )}
        </InfiniteScroll>
      </div>

      {showScrollToBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth", true)}
          className="absolute bottom-6 right-6 z-30 rounded-full bg-primary p-2.5 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
          aria-label="Scroll xuống cuối"
        >
          <ChevronDown className="size-5" />
        </button>
      )}
    </div>
  );
};

export default ChatWindowBody;
