import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { UserPlus } from "lucide-react";
import type { User } from "@/types/user";
import { useFriendStore } from "@/stores/useFriendStore";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import UserAvatar from "./UserAvatar";
import { userService } from "@/services/userService";

const AddFriendModal = () => {
  const [open, setOpen] = useState(false);
  const [searchUsername, setSearchUsername] = useState("");
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const { loading, sendFriendRequest } = useFriendStore();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    setIsSearching(true);
    setSearchDone(false);
    setFoundUsers([]);

    try {
      const users = await userService.searchUsers(searchUsername);
      setFoundUsers(users);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
      setSearchDone(true);
    }
  };

  const handleSendRequest = async (userId: number) => {
    try {
      await sendFriendRequest(userId);
      toast.success("Đã gửi lời mời kết bạn!");
      handleReset();
      setOpen(false);
    } catch (error) {
      console.error("Lỗi xảy ra khi gửi request", error);
      toast.error("Lỗi xảy ra khi gửi kết bạn. Hãy thử lại");
    }
  };

  const handleReset = () => {
    setSearchUsername("");
    setFoundUsers([]);
    setSearchDone(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) handleReset();
    }}>
      <DialogTrigger asChild>
        <div className="flex justify-center items-center size-5 rounded-full hover:bg-sidebar-accent cursor-pointer z-10">
          <UserPlus className="size-4" />
          <span className="sr-only">Kết bạn</span>
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px] border-none">
        <DialogHeader>
          <DialogTitle>Kết Bạn</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-username">Tìm kiêm</Label>
            <div className="flex gap-2">
              <Input
                id="search-username"
                placeholder="Số điện thoại, Tên, Tên đăng nhập..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={isSearching || !searchUsername.trim()}>
                {isSearching ? "Đang tìm..." : "Tìm"}
              </Button>
            </div>
          </div>

          {searchDone && foundUsers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Không tìm thấy người dùng "{searchUsername}"
            </p>
          )}

          {foundUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <UserAvatar
                  type="sidebar"
                  name={u.displayName}
                  avatarUrl={u.avatarUrl}
                />
                <div>
                  <p className="font-medium">{u.displayName}</p>
                  <p className="text-sm text-muted-foreground">@{u.username}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSendRequest(u.id)}
                disabled={loading}
              >
                <UserPlus className="size-4 mr-1" />
                Kết bạn
              </Button>
            </div>
          ))}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;
