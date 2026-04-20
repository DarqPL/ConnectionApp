import { useState } from "react";
import { Button } from "../ui/button";
import type { Poll } from "@/types/chat";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { Check, Users, ListTodo, ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";

interface PollMessageProps {
  messageId: string;
  poll: Poll;
  senderId: number;
}

const PollMessage = ({ messageId, poll, senderId }: PollMessageProps) => {
  const { votePoll, closePoll } = useChatStore();
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalVotes = poll.options.reduce((acc, opt) => acc + opt.voterIds.length, 0);
  const isCreator = user?.id === senderId;
  const isClosed = poll.closed;

  // Pre-select current votes when opening modal
  const openModal = () => {
    const currentVotes = poll.options
      .filter(o => user && o.voterIds.includes(user.id))
      .map(o => o.id);
    setSelectedOptionIds(currentVotes);
    setIsModalOpen(true);
  };

  const handleOptionToggle = (optionId: string) => {
    if (isClosed) return;

    if (poll.multiChoice) {
      setSelectedOptionIds(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId) 
          : [...prev, optionId]
      );
    } else {
      setSelectedOptionIds([optionId]);
    }
  };

  const handleConfirmVote = async () => {
    if (selectedOptionIds.length >= 0 && !isClosed) {
      setIsProcessing(true);
      try {
        await votePoll(messageId, selectedOptionIds);
        setIsModalOpen(false);
      } catch (error) {
        toast.error("Không thể thực hiện bình chọn");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleClosePoll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCreator) return;
    
    setIsProcessing(true);
    try {
      await closePoll(messageId);
      toast.success("Đã kết thúc cuộc bình chọn");
    } catch (error) {
      toast.error("Lỗi khi kết thúc bình chọn");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Centered Preview Card */}
      <div 
        onClick={openModal}
        className={cn(
          "w-full max-w-[450px] bg-white dark:bg-zinc-900 rounded-2xl shadow-md border border-border/50 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 group animate-in fade-in zoom-in duration-500",
          isClosed && "opacity-85 grayscale-[0.3]"
        )}
      >
        <div className="bg-primary/5 p-3 px-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            {isClosed ? <Lock className="size-4 text-muted-foreground" /> : <ListTodo className="size-4" />}
            <span className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              isClosed && "text-muted-foreground"
            )}>
              {isClosed ? "Bình chọn đã kết thúc" : "Cuộc bầu chọn"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
             <Users className="size-3.5" />
             <span className="text-[11px] font-medium">{totalVotes} người tham gia</span>
          </div>
        </div>

        <div className="p-5">
          <h4 className={cn(
            "font-bold text-lg leading-tight mb-5 transition-colors",
            isClosed ? "text-muted-foreground" : "text-foreground/90 group-hover:text-primary"
          )}>
            {poll.question}
          </h4>
          
          <div className="space-y-4">
            {poll.options.slice(0, 3).map((option) => {
              const isVoted = user ? option.voterIds.includes(user.id) : false;
              const votePercentage = totalVotes > 0 
                ? Math.round((option.voterIds.length / totalVotes) * 100) 
                : 0;

              return (
                <div key={option.id} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold px-0.5">
                    <span className="truncate max-w-[85%] text-foreground/80">{option.text}</span>
                    <span className="text-primary">{votePercentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000 ease-out",
                        isClosed ? "bg-muted-foreground/40" : (isVoted ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-primary/30")
                      )}
                      style={{ width: `${votePercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            
            {poll.options.length > 3 && (
              <div className="pt-2 text-center">
                <span className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full italic">
                  +{poll.options.length - 3} lựa chọn khác
                </span>
              </div>
            )}
          </div>
        </div>

        {isClosed ? (
          <div className="bg-zinc-100 dark:bg-zinc-800/50 p-2.5 text-center border-t border-border/30">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Cuộc bình chọn đã kết thúc
            </span>
          </div>
        ) : (
          <div className="bg-muted/20 p-2.5 flex items-center justify-center gap-4 border-t border-border/30 group-hover:bg-primary/5 transition-colors">
            <span className="text-xs font-bold text-primary flex items-center gap-1">
              Xem chi tiết & Bình chọn <ChevronRight className="size-3" />
            </span>
            {isCreator && (
              <button 
                onClick={handleClosePoll}
                disabled={isProcessing}
                className="text-[10px] font-bold text-destructive hover:underline ml-auto border-l border-border/50 pl-4 disabled:opacity-50"
              >
                Kết thúc bình chọn
              </button>
            )}
          </div>
        )}
      </div>

      {/* Voting Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <ListTodo className="size-5" />
              Chi tiết bình chọn
            </DialogTitle>
          </DialogHeader>
          
          <div className="px-6 py-2 space-y-5">
             <h3 className="font-extrabold text-2xl leading-tight text-foreground/90">{poll.question}</h3>
             <div className="flex items-center gap-2">
               <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest bg-muted/50 w-fit px-2 py-1 rounded">
                 {poll.multiChoice ? "Được chọn nhiều phương án" : "Chọn một phương án"}
               </p>
               {isClosed && (
                 <span className="text-[10px] font-bold text-white bg-destructive px-2 py-1 rounded uppercase tracking-tighter">
                   Đã kết thúc
                 </span>
               )}
             </div>

             <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1 pb-4 scrollbar-thin">
               {poll.options.map((option) => {
                 const isSelected = selectedOptionIds.includes(option.id);
                 const voteCount = option.voterIds.length;
                 const isVoted = user ? option.voterIds.includes(user.id) : false;

                 return (
                   <div 
                     key={option.id}
                     onClick={() => handleOptionToggle(option.id)}
                     className={cn(
                       "flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200",
                       !isClosed && "cursor-pointer",
                       isSelected 
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                        : "border-border/60 hover:border-primary/40 hover:bg-muted/30",
                       isVoted && !isSelected && "bg-primary/5 border-dashed border-primary/20",
                       isClosed && "pointer-events-none opacity-80"
                     )}
                   >
                     <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <p className={cn("font-bold text-base truncate", isSelected ? "text-primary" : "text-foreground/80")}>
                            {option.text}
                          </p>
                          {isVoted && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Đã chọn</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">{voteCount} lượt bình chọn</p>
                     </div>
                     <div className={cn(
                       "size-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300",
                       isSelected ? "bg-primary border-primary scale-110 shadow-glow" : "border-muted-foreground/30"
                     )}>
                        {isSelected && <Check className="size-3.5 text-white stroke-[3px]" />}
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>

          <DialogFooter className="p-6 bg-muted/10 border-t border-border/40 gap-3">
             <Button variant="ghost" className="flex-1 font-bold h-11" onClick={() => setIsModalOpen(false)}>
               {isClosed ? "Đóng" : "Hủy"}
             </Button>
             {!isClosed && (
               <Button 
                  className={cn(
                    "flex-1 font-bold h-11 shadow-lg transition-all active:scale-95",
                    selectedOptionIds.length > 0 ? "bg-gradient-chat text-white" : "bg-muted text-muted-foreground"
                  )} 
                  onClick={handleConfirmVote}
                  disabled={isProcessing}
               >
                 {isProcessing ? "Đang xử lý..." : "Xác nhận bình chọn"}
               </Button>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PollMessage;
