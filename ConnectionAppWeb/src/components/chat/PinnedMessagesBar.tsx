import { useChatStore } from "@/stores/useChatStore";
import { Pin, X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "../ui/button";
import { useState } from "react";

interface PinnedMessagesBarProps {
  conversationId: number;
}

const PinnedMessagesBar = ({ conversationId }: PinnedMessagesBarProps) => {
  const { conversations, unpinMessage } = useChatStore();
  const [currentIndex, setCurrentIndex] = useState(0);

  const conversation = conversations.find((c) => c.id === conversationId);
  const pinnedMessages = conversation?.pinnedMessages || [];

  if (pinnedMessages.length === 0) return null;

  const currentMessage = pinnedMessages[currentIndex];

  const handleUnpin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMessage) {
      await unpinMessage(conversationId, currentMessage.id);
      // Adjust index if needed
      if (currentIndex >= pinnedMessages.length - 1 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  const scrollToMessage = () => {
    const element = document.querySelector(`[data-message-id="${currentMessage.id}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("highlight-pulse");
      setTimeout(() => element.classList.remove("highlight-pulse"), 2000);
    }
  };

  const nextMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % pinnedMessages.length);
  };

  const prevMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + pinnedMessages.length) % pinnedMessages.length);
  };

  return (
    <div 
      onClick={scrollToMessage}
      className="bg-background/95 backdrop-blur-sm border-b border-border/40 px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors group z-10 shadow-sm"
    >
      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Pin className="size-4 text-primary fill-primary/20" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
            Tin nhắn đã ghim {pinnedMessages.length > 1 && `(${currentIndex + 1}/${pinnedMessages.length})`}
          </span>
        </div>
        <p className="text-sm text-foreground/80 truncate font-medium">
          {currentMessage.content || (currentMessage.attachments?.length ? "Đã gửi một tệp đính kèm" : "Tin nhắn không có nội dung")}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {pinnedMessages.length > 1 && (
          <>
            <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={prevMessage}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={nextMessage}>
              <ChevronRight className="size-4" />
            </Button>
          </>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="size-7 rounded-full text-muted-foreground hover:text-destructive" 
          onClick={handleUnpin}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
};

export default PinnedMessagesBar;
