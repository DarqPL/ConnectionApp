import { useFriendStore } from "@/stores/useFriendStore";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MessageCircleMore, Users, Search, Hash } from "lucide-react";
import { Card } from "../ui/card";
import UserAvatar from "../chat/UserAvatar";
import GroupChatAvatar from "../chat/GroupChatAvatar";
import { useChatStore } from "@/stores/useChatStore";
import { useState, useMemo } from "react";
import { Input } from "../ui/input";

interface Props {
  setOpen: (b: boolean) => void;
}

const FriendListModal = ({ setOpen }: Props) => {
  const { friends } = useFriendStore();
  const { createConversation, conversations, setActiveConversation } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");

  const groups = useMemo(() => {
    return conversations.filter(c => c.type === "GROUP");
  }, [conversations]);

  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter(f => 
      f.displayName.toLowerCase().includes(q) || 
      f.username.toLowerCase().includes(q)
    );
  }, [friends, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const handleAddConversation = async (friendId: number) => {
    await createConversation("PRIVATE", "", [friendId]);
    setOpen(false);
  };

  const handleSelectGroup = (groupId: number) => {
    setActiveConversation(groupId);
    setOpen(false);
  };

  const hasResults = filteredFriends.length > 0 || filteredGroups.length > 0;

  return (
    <DialogContent className="glass max-w-md p-0 overflow-hidden border-border/40 shadow-2xl rounded-3xl">
      <DialogHeader className="p-6 pb-2">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <div className="size-8 bg-primary/10 rounded-full flex items-center justify-center">
            <MessageCircleMore className="size-5 text-primary" />
          </div>
          Gửi tin nhắn mới
        </DialogTitle>
      </DialogHeader>

      <div className="px-6 pb-4">
        <div className="relative">
          <Input
            placeholder="Tìm theo tên bạn bè hoặc tên nhóm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-muted/30 border-border/20 focus:ring-primary/20 rounded-2xl transition-all"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-6 pb-6 space-y-6 beautiful-scrollbar">
        {/* Groups Section */}
        {filteredGroups.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.1em] ml-1">
              Nhóm chat của bạn ({filteredGroups.length})
            </h3>
            <div className="grid gap-2">
              {filteredGroups.map((group) => (
                <Card
                  key={`group-${group.id}`}
                  onClick={() => handleSelectGroup(group.id)}
                  className="p-3 cursor-pointer border-border/10 hover:bg-muted/50 transition-all rounded-2xl group/item"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0">
                      <GroupChatAvatar participants={group.participants} type="chat" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate group-hover/item:text-primary transition-colors">
                        {group.name}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {group.participants.length} thành viên
                      </p>
                    </div>
                    <Hash className="size-4 text-muted-foreground/20 group-hover/item:text-primary/30 transition-colors" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Friends Section */}
        {(filteredFriends.length > 0 || (searchQuery && filteredFriends.length === 0 && filteredGroups.length === 0)) && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.1em] ml-1">
              Bạn bè ({filteredFriends.length})
            </h3>
            <div className="grid gap-2">
              {filteredFriends.map((friend) => (
                <Card
                  key={`friend-${friend.id}`}
                  onClick={() => handleAddConversation(friend.friendId)}
                  className="p-3 cursor-pointer border-border/10 hover:bg-muted/50 transition-all rounded-2xl group/item"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <UserAvatar
                        type="chat"
                        name={friend.displayName}
                        avatarUrl={friend.avatarUrl}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate group-hover/item:text-primary transition-colors">
                        {friend.displayName}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        @{friend.username}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!hasResults && (
          <div className="text-center py-12">
            <div className="size-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="size-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {searchQuery ? "Không tìm thấy kết quả phù hợp" : "Bạn chưa có bạn bè nào"}
            </p>
          </div>
        )}
      </div>
    </DialogContent>
  );
};

export default FriendListModal;
