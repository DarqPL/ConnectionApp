import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsersRound, Loader2 } from "lucide-react";
import type { User } from "@/types/user";
import { userService } from "@/services/userService";
import { friendService } from "@/services/friendService";
import { useFriendStore } from "@/stores/useFriendStore";
import { toast } from "sonner";
import BusinessCardComponent from "./BusinessCard";

interface BusinessCardModalProps {
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
}

const BusinessCardModal = ({
  triggerLabel = "Danh thiếp",
  triggerVariant = "default",
}: BusinessCardModalProps) => {
  const [open, setOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState<
    "FRIEND" | "SENDING" | "RECEIVED" | "NONE"
  >("NONE");
  const [isUpdating, setIsUpdating] = useState(false);

  const { sendFriendRequest } = useFriendStore();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    setIsSearching(true);
    setSearchDone(false);
    setFoundUser(null);

    try {
      // Tìm kiếm bằng email - backend sẽ xử lý
      // Nếu backend không hỗ trợ, ta dùng searchUsers và filter
      const users = await userService.searchUsers(searchEmail);
      const user = users.find(
        (u) => u.email?.toLowerCase() === searchEmail.toLowerCase()
      );

      if (!user) {
        toast.error("Không tìm thấy người dùng");
        setSearchDone(true);
        setIsSearching(false);
        return;
      }

      if (user.status === "DELETED") {
        toast.error("Tài khoản này đã bị xóa");
        setSearchDone(true);
        setIsSearching(false);
        return;
      }

      setFoundUser(user);

      // Kiểm tra quan hệ
      try {
        const [isFriend, isSending, isReceived] = await Promise.all([
          friendService.checkFriendship(user.id),
          friendService.checkIsSending(user.id),
          friendService.checkIsReceived(user.id),
        ]);

        if (isFriend) setRelationshipStatus("FRIEND");
        else if (isSending) setRelationshipStatus("SENDING");
        else if (isReceived) setRelationshipStatus("RECEIVED");
        else setRelationshipStatus("NONE");
      } catch (err) {
        console.error("Lỗi kiểm tra quan hệ:", err);
        setRelationshipStatus("NONE");
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tìm kiếm");
    } finally {
      setIsSearching(false);
      setSearchDone(true);
    }
  };

  const handleAddFriend = async () => {
    if (!foundUser) return;

    setIsUpdating(true);
    try {
      await sendFriendRequest(foundUser.id);
      toast.success("Đã gửi lời mời kết bạn");
      setRelationshipStatus("SENDING");
    } catch (error) {
      console.error(error);
      toast.error("Không thể gửi lời mời");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAccept = async () => {
    if (!foundUser) return;

    setIsUpdating(true);
    try {
      await friendService.acceptFriendRequest(foundUser.id);
      toast.success("Đã chấp nhận lời mời");
      setRelationshipStatus("FRIEND");
    } catch (error) {
      console.error(error);
      toast.error("Không thể chấp nhận");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!foundUser) return;

    setIsUpdating(true);
    try {
      await friendService.rejectFriendRequest(foundUser.id);
      toast.success("Đã từ chối lời mời");
      setRelationshipStatus("NONE");
    } catch (error) {
      console.error(error);
      toast.error("Không thể từ chối");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!foundUser) return;

    setIsUpdating(true);
    try {
      await friendService.cancelFriendRequest(foundUser.id);
      toast.success("Đã hủy lời mời");
      setRelationshipStatus("NONE");
    } catch (error) {
      console.error(error);
      toast.error("Không thể hủy");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnfriend = async () => {
    if (!foundUser) return;

    setIsUpdating(true);
    try {
      await friendService.unfriend(foundUser.id);
      toast.success("Đã hủy kết bạn");
      setRelationshipStatus("NONE");
    } catch (error) {
      console.error(error);
      toast.error("Không thể hủy kết bạn");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReset = () => {
    setSearchEmail("");
    setFoundUser(null);
    setSearchDone(false);
    setRelationshipStatus("NONE");
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
        <Button variant={triggerVariant} className="gap-2">
          <UsersRound className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Danh thiếp - Tìm kiếm theo Email</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <div className="flex gap-2">
              <Input
                placeholder="Nhập email..."
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                disabled={isSearching}
              />
              <Button 
                type="submit" 
                disabled={isSearching}
                className="gap-2"
              >
                {isSearching && <Loader2 className="size-4 animate-spin" />}
                {isSearching ? "Tìm..." : "Tìm"}
              </Button>
            </div>
          </div>
        </form>

        {/* Results */}
        {searchDone && !foundUser && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Không tìm thấy người dùng với email: <strong>{searchEmail}</strong></p>
          </div>
        )}

        {foundUser && (
          <div className="mt-6 flex justify-center">
            <BusinessCardComponent
              user={foundUser}
              relationshipStatus={relationshipStatus}
              onAddFriend={handleAddFriend}
              onAccept={handleAccept}
              onReject={handleReject}
              onCancel={handleCancel}
              onUnfriend={handleUnfriend}
              isLoading={isUpdating}
              isModal={true}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BusinessCardModal;
