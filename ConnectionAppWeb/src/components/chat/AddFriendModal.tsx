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
import { friendService } from "@/services/friendService";

export interface IFormValues {
  username: string;
  message?: string;
}

const AddFriendModal = () => {
  const [open, setOpen] = useState(false);
  const [searchUsername, setSearchUsername] = useState("");
  const [foundUsers, setFoundUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [relationshipMap, setRelationshipMap] = useState<Record<number, string>>({});

  const { sendFriendRequest } = useFriendStore();

  const {
    checkFriendship,
    checkIsSending,
    checkIsReceived,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    unfriend,
  } = friendService;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    setIsSearching(true);
    setSearchDone(false);
    setFoundUsers([]);

    try {
      const users = await userService.searchUsers(searchUsername);

      // ❌ lọc bỏ user DELETED
      const filteredUsers = users.filter((u: User) => u.status !== "DELETED");

      setFoundUsers(filteredUsers);

      const map: Record<number, string> = {};

      await Promise.all(
        filteredUsers.map(async (u: User) => {
          const [isFriend, isSending, isReceived] = await Promise.all([
            checkFriendship(u.id),
            checkIsSending(u.id),
            checkIsReceived(u.id),
          ]);

          if (isFriend) map[u.id] = "FRIEND";
          else if (isSending) map[u.id] = "SENDING";
          else if (isReceived) map[u.id] = "RECEIVED";
          else map[u.id] = "NONE";
        })
      );

      setRelationshipMap(map);
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tìm kiếm");
    } finally {
      setIsSearching(false);
      setSearchDone(true);
    }
  };

  const handleSendRequest = async (userId: number) => {
    try {
      await sendFriendRequest(userId);
      toast.success("Đã gửi lời mời");

      setRelationshipMap((prev) => ({
        ...prev,
        [userId]: "SENDING",
      }));
    } catch (error) {
      toast.error("Không thể gửi");
    }
  };

  const handleCancel = async (userId: number) => {
    try {
      await cancelFriendRequest(userId);
      toast.success("Đã hủy lời mời");

      setRelationshipMap((prev) => ({
        ...prev,
        [userId]: "NONE",
      }));
    } catch (error) {
      toast.error("Lỗi khi hủy");
    }
  };

  const handleUnfriend = async (userId: number) => {
    try {
      await unfriend(userId);
      toast.success("Đã hủy kết bạn");

      setRelationshipMap((prev) => ({
        ...prev,
        [userId]: "NONE",
      }));
    } catch (error) {
      toast.error("Lỗi khi hủy kết bạn");
    }
  };

  const handleAccept = async (userId: number) => {
    try {
      await acceptFriendRequest(userId);
      toast.success("Đã chấp nhận");

      setRelationshipMap((prev) => ({
        ...prev,
        [userId]: "FRIEND",
      }));
    } catch (error) {
      toast.error("Lỗi khi accept");
    }
  };

  const handleReject = async (userId: number) => {
    try {
      await rejectFriendRequest(userId);
      toast.success("Đã từ chối");

      setRelationshipMap((prev) => ({
        ...prev,
        [userId]: "NONE",
      }));
    } catch (error) {
      toast.error("Lỗi khi reject");
    }
  };

  const handleReset = () => {
    setSearchUsername("");
    setFoundUsers([]);
    setSearchDone(false);
    setRelationshipMap({});
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) handleReset();
      }}
    >
      <DialogTrigger asChild>
        <div className="flex justify-center items-center size-5 rounded-full hover:bg-sidebar-accent cursor-pointer">
          <UserPlus className="size-4" />
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-106.25 border-none">
        <DialogHeader>
          <DialogTitle>Kết bạn</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-2">
            <Label>Tìm kiếm</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nhập username..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
              />
              <Button type="submit">
                {isSearching ? "Đang tìm..." : "Tìm"}
              </Button>
            </div>
          </div>

          {searchDone && foundUsers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Không tìm thấy "{searchUsername}"
            </p>
          )}

          {foundUsers.map((u) => {
            const status = relationshipMap[u.id];

            return (
              <div
                key={u.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    type="sidebar"
                    name={u.displayName}
                    avatarUrl={u.avatarUrl}
                  />
                  <div>
                    <p className="font-medium">{u.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      @{u.username}
                    </p>

                    {/* 🔥 tài khoản bị khóa */}
                    {u.status === "LOCKED" && (
                      <p className="text-xs text-red-500">
                        Tài khoản này đã tạm khóa
                      </p>
                    )}
                  </div>
                </div>

                {/* ❌ nếu LOCKED thì không cho thao tác */}
                {u.status !== "LOCKED" && (
                  <>
                    {status === "FRIEND" && (
                      <Button size="sm" variant="destructive" onClick={() => handleUnfriend(u.id)}>
                        Hủy kết bạn
                      </Button>
                    )}

                    {status === "SENDING" && (
                      <Button size="sm" variant="outline" onClick={() => handleCancel(u.id)}>
                        Hủy lời mời
                      </Button>
                    )}

                    {status === "RECEIVED" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAccept(u.id)}>
                          Chấp nhận
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(u.id)}>
                          Từ chối
                        </Button>
                      </div>
                    )}

                    {status === "NONE" && (
                      <Button size="sm" onClick={() => handleSendRequest(u.id)}>
                        <UserPlus className="size-4 mr-1" />
                        Kết bạn
                      </Button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;