import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { X, Check, Search, UserPlus2, UserMinus2, Loader2, Users2 } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { friendService } from "@/services/friendService";
import { userService } from "@/services/userService";
import { chatService } from "@/services/chatService";
import { toast } from "sonner";
import type { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";

interface AddMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
}

// Internal interface to unify Friend and User for display
interface DisplayUser {
  id: number;
  displayName: string;
  username: string;
  email?: string;
  avatarUrl?: string | null;
}

const AddMemberDialog = ({ isOpen, onClose, conversation }: AddMemberDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [friends, setFriends] = useState<DisplayUser[]>([]);
  const [searchResults, setSearchResults] = useState<DisplayUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<DisplayUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  // Get existing member IDs
  const existingMemberIds = useMemo(() => 
    new Set(conversation.participants.map(p => p.userId)),
    [conversation.participants]
  );

  // Load friends on mount
  useEffect(() => {
    if (!isOpen) {
      setSelectedMembers([]);
      setSearchQuery("");
      return;
    }
    
    const loadFriends = async () => {
      try {
        setLoading(true);
        const friendsList = await friendService.getFriends();
        // Filter out existing members and map to DisplayUser
        const availableFriends: DisplayUser[] = friendsList
          .filter(f => !existingMemberIds.has(f.friendId))
          .map(f => ({
            id: f.friendId,
            displayName: f.displayName,
            username: f.username,
            avatarUrl: f.avatarUrl,
          }));
        setFriends(availableFriends);
        setSearchResults([]);
      } catch (error) {
        console.error("Lỗi tải danh sách bạn:", error);
        toast.error("Không thể tải danh sách bạn");
      } finally {
        setLoading(false);
      }
    };

    loadFriends();
  }, [isOpen, existingMemberIds]);

  // Handle search with debounce
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const searchAsync = async () => {
      try {
        setSearching(true);
        // First filter from local friends
        const localResults = friends.filter(f => 
          f.displayName.toLowerCase().includes(query) || 
          f.username.toLowerCase().includes(query) ||
          f.email?.toLowerCase().includes(query)
        );

        if (localResults.length > 0) {
          setSearchResults(localResults);
          setSearching(false);
          return;
        }

        // If no local results, search globally
        const results = await userService.searchUsers(searchQuery);
        const filtered: DisplayUser[] = results
          .filter(r => !existingMemberIds.has(r.id) && !friends.some(f => f.id === r.id))
          .map(user => ({
            id: user.id,
            displayName: user.displayName,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
          }));
        setSearchResults(filtered);
      } catch (error) {
        console.error("Lỗi tìm kiếm:", error);
      } finally {
        setSearching(false);
      }
    };

    const timer = setTimeout(searchAsync, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, friends, existingMemberIds]);

  const toggleMember = (user: DisplayUser) => {
    setSelectedMembers(prev =>
      prev.some(m => m.id === user.id)
        ? prev.filter(m => m.id !== user.id)
        : [...prev, user]
    );
  };

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) {
      toast.error("Vui lòng chọn ít nhất một thành viên");
      return;
    }

    setIsSubmitting(true);
    try {
      const results = await Promise.allSettled(
        selectedMembers.map(member => chatService.addMemberToGroup(conversation.id, member.id))
      );

      const fulfilledCount = results.filter(r => r.status === "fulfilled").length;
      const rejectedCount = results.filter(r => r.status === "rejected").length;

      if (fulfilledCount > 0) {
        toast.success(`Đã thêm thành công ${fulfilledCount} thành viên`);
      }
      if (rejectedCount > 0) {
        toast.error(`Không thể thêm ${rejectedCount} thành viên`);
      }

      if (fulfilledCount > 0) {
        onClose();
      }
    } catch (error) {
      console.error("Lỗi thêm thành viên:", error);
      toast.error("Đã xảy ra lỗi khi thêm thành viên");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayList = searchQuery.trim() ? searchResults : friends;
  const isSelected = (id: number) => selectedMembers.some(m => m.id === id);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none shadow-2xl backdrop-blur-xl bg-background/95">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent h-1 absolute top-0 left-0 right-0" />
        
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Users2 className="size-5" />
            </div>
            <DialogTitle className="text-xl">Thêm thành viên</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Mời bạn bè tham gia cuộc trò chuyện <span className="font-semibold text-foreground">"{conversation.name}"</span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-4 pb-6">
          {/* Selected Members Section */}
          <div className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden",
            selectedMembers.length > 0 ? "h-24 opacity-100 mt-2" : "h-0 opacity-0"
          )}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Đã chọn ({selectedMembers.length})
                </p>
                <button 
                  onClick={() => setSelectedMembers([])}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto pb-2 beautiful-scrollbar">
                {selectedMembers.map((member) => (
                  <div key={member.id} className="relative group shrink-0">
                    <div className="flex flex-col items-center gap-1 w-12">
                      <UserAvatar
                        type="chat"
                        name={member.displayName}
                        avatarUrl={member.avatarUrl ?? undefined}
                        className="size-10 border-2 border-primary/20 ring-2 ring-background"
                      />
                      <span className="text-[10px] font-medium truncate w-full text-center">
                        {member.displayName.split(" ")[0]}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleMember(member)}
                      className="absolute -top-1 -right-1 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-all duration-200"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
              <Search className="size-4" />
            </div>
            <Input
              placeholder="Tìm kiếm theo tên hoặc username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-secondary/30 border-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl transition-all"
            />
            {searching && (
              <div className="absolute inset-y-0 right-3 flex items-center">
                <Loader2 className="size-4 animate-spin text-primary/50" />
              </div>
            )}
          </div>

          {/* Member List */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              {searchQuery ? "Kết quả tìm kiếm" : "Gợi ý bạn bè"}
            </p>
            <div className="border border-border/40 rounded-2xl bg-secondary/10 h-[280px] overflow-y-auto beautiful-scrollbar p-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground opacity-60">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-xs font-medium">Đang tải danh sách...</p>
                </div>
              ) : displayList.length > 0 ? (
                <div className="space-y-1">
                  {displayList.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => toggleMember(user)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group text-left",
                        isSelected(user.id) 
                          ? "bg-primary/10 border-primary/20 shadow-sm"
                          : "hover:bg-background/80"
                      )}
                    >
                      <div className="relative">
                        <UserAvatar
                          type="chat"
                          name={user.displayName}
                          avatarUrl={user.avatarUrl ?? undefined}
                          className="size-10 shadow-sm transition-transform group-hover:scale-105"
                        />
                        {isSelected(user.id) && (
                          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background animate-in zoom-in-50 duration-200">
                            <Check className="size-3" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-semibold truncate transition-colors",
                          isSelected(user.id) ? "text-primary" : "text-foreground"
                        )}>
                          {user.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate opacity-70">
                          @{user.username}
                        </p>
                      </div>
                      <div className={cn(
                        "size-8 rounded-full flex items-center justify-center transition-all duration-200",
                        isSelected(user.id)
                          ? "bg-primary/20 text-primary scale-100"
                          : "bg-secondary text-muted-foreground opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                      )}>
                        {isSelected(user.id) ? <UserMinus2 className="size-4" /> : <UserPlus2 className="size-4" />}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-6 text-center">
                  <div className="p-4 rounded-full bg-secondary/50 mb-2">
                    <Search className="size-8 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">
                    {searchQuery ? "Không tìm thấy kết quả" : "Không có gợi ý nào"}
                  </p>
                  <p className="text-xs opacity-60">
                    {searchQuery ? "Thử lại với từ khóa khác nhé" : "Hãy thêm bạn bè để bắt đầu trò chuyện nhóm"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl border-border/60 hover:bg-secondary/50 font-semibold"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button
              className={cn(
                "flex-1 h-11 rounded-xl font-bold transition-all duration-300 shadow-lg",
                selectedMembers.length > 0 
                  ? "bg-primary shadow-primary/20 hover:shadow-primary/30" 
                  : "bg-primary/50 cursor-not-allowed"
              )}
              onClick={handleAddMembers}
              disabled={selectedMembers.length === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-white" />
                  <span>Đang thêm...</span>
                </div>
              ) : (
                <span>Thêm vào nhóm</span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemberDialog;
