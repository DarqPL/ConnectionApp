import { SidebarInset } from "../ui/sidebar";
import ChatWindowHeader from "./ChatWindowHeader";

const ChatWelcomeScreen = () => {
  return (
    <SidebarInset className="flex w-full h-full bg-transparent border-none">
      <ChatWindowHeader />
      <div className="flex flex-1 items-center justify-center p-8 transition-all duration-1000 animate-in fade-in zoom-in-95">
        <div className="text-center max-w-md">
          <div className="size-32 mx-auto mb-8 bg-gradient-to-tr from-primary/20 to-violet-500/20 rounded-full flex items-center justify-center shadow-2xl relative">
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping duration-[3000ms]" />
            <span className="text-5xl drop-shadow-lg">✨</span>
          </div>
          <h2 className="text-4xl font-extrabold mb-4 tracking-tight text-foreground/90 leading-tight">
            Kết nối mọi lúc, <br /> chia sẻ mọi nơi.
          </h2>
          <p className="text-muted-foreground/80 text-lg font-medium">
            Hãy chọn một người bạn để bắt đầu những câu chuyện thú vị ngay bây giờ!
          </p>
        </div>
      </div>
    </SidebarInset>
  );
};

export default ChatWelcomeScreen;
