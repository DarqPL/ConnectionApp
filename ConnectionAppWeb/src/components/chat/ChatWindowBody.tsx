import { useChatStore } from "@/stores/useChatStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import MessageItem from "./MessageItem";
import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import type { Message } from "@/types/chat";

interface ChatWindowBodyProps {
  onReply: (message: Message) => void;
  isLocked?: boolean;
  isDeleted?: boolean;
}

const ChatWindowBody = ({
  onReply,
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

  const [lastMessageStatus, setLastMessageStatus] = useState<
    "delivered" | "seen"
  >("delivered");
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const messages = allMessages[activeConversationId!]?.items ?? [];
  const reversedMessages = [...messages].reverse();
  const hasMore = allMessages[activeConversationId!]?.hasMore ?? false;

  const selectedConvo = conversations.find(
    (c) => c.id === activeConversationId,
  );

  const key = `chat-scroll-${activeConversationId}`;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const manualScrollToBottomRef = useRef(false);

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
    sessionStorage.removeItem(key);
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [activeConversationId]);

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
          dataLength={messages.length}
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
          {reversedMessages.map((message, index) => (
            <MessageItem
              key={message.id ?? index}
              message={message}
              index={index}
              messages={reversedMessages}
              selectedConvo={selectedConvo}
              lastMessageStatus={lastMessageStatus}
              onReply={onReply}
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
