import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  UserIcon,
  UserPlus,
  UserCheck,
  Clock,
  Ban,
  X,
} from "lucide-react";
import type { User } from "@/types/user";
import { cn } from "@/lib/utils";

interface BusinessCardProps {
  user: User;
  relationshipStatus?: "FRIEND" | "SENDING" | "RECEIVED" | "NONE";
  onAddFriend?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onUnfriend?: () => void;
  isLoading?: boolean;
  onClose?: () => void;
  isModal?: boolean;
  variant?: "default" | "compact";
  hideActions?: boolean;
}

const BusinessCard = ({
  user,
  relationshipStatus = "NONE",
  onAddFriend,
  onAccept,
  onReject,
  onCancel,
  onUnfriend,
  isLoading = false,
  onClose,
  isModal = false,
  variant = "default",
  hideActions = false,
}: BusinessCardProps) => {
  const getStatusBadge = () => {
    switch (user.status) {
      case "LOCKED":
        return <Badge variant="destructive">Bị khoá</Badge>;
      case "DELETED":
        return <Badge variant="secondary">Đã xoá</Badge>;
      default:
        return null;
    }
  };

  const getRelationshipButton = () => {
    switch (relationshipStatus) {
      case "FRIEND":
        return (
          <Button
            variant="outline"
            className="w-full"
            onClick={onUnfriend}
            disabled={isLoading}
          >
            <UserCheck className="size-4 mr-2" />
            Bạn bè
          </Button>
        );
      case "SENDING":
        return (
          <Button
            variant="outline"
            className="w-full"
            onClick={onCancel}
            disabled={isLoading}
          >
            <Clock className="size-4 mr-2" />
            Đã gửi lời mời
          </Button>
        );
      case "RECEIVED":
        return (
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-gradient-chat text-white"
              onClick={onAccept}
              disabled={isLoading}
            >
              <UserCheck className="size-4 mr-2" />
              Chấp nhận
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={onReject}
              disabled={isLoading}
            >
              <Ban className="size-4 mr-2" />
              Từ chối
            </Button>
          </div>
        );
      default:
        return (
          <Button
            className="w-full bg-gradient-chat text-white"
            onClick={onAddFriend}
            disabled={
              isLoading || user.status === "LOCKED" || user.status === "DELETED"
            }
          >
            <UserPlus className="size-4 mr-2" />
            Kết bạn
          </Button>
        );
    }
  };

  const isDisabled = user.status === "LOCKED" || user.status === "DELETED";

  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-2 w-64 bg-background p-3 rounded-lg border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 border">
            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
            <AvatarFallback>
              {user.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold text-sm text-foreground truncate">
              {user.displayName}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              @{user.username}
            </span>
          </div>
        </div>
        {!hideActions && !isDisabled && (
          <div className="w-full mt-1">{getRelationshipButton()}</div>
        )}
        {!hideActions && isDisabled && (
          <div className="text-xs text-center text-muted-foreground p-1.5 bg-accent rounded w-full mt-1">
            Tài khoản không khả dụng
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-linear-to-br from-background to-accent/50",
        isModal ? "w-full max-w-sm shadow-lg p-6" : "p-4",
      )}
    >
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 hover:bg-accent rounded-md"
        >
          <X className="size-4" />
        </button>
      )}

      <div className="flex flex-col items-center text-center mb-6">
        <Avatar className="size-24 mb-3 border-4 border-primary/10">
          <AvatarImage src={user.avatarUrl} alt={user.displayName} />
          <AvatarFallback className="text-lg">
            {user.displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-bold text-foreground">
          {user.displayName}
        </h2>
        <p className="text-sm text-muted-foreground mb-3">@{user.username}</p>
        {getStatusBadge()}
      </div>

      {user.bio && (
        <p className="text-sm text-muted-foreground text-center mb-6 italic">
          "{user.bio}"
        </p>
      )}
      <div className="w-12 h-1 bg-gradient-chat rounded-full mx-auto mb-6"></div>

      <div className="space-y-3 mb-6">
        {user.email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="size-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground">Email</p>
              <p className="text-foreground truncate" title={user.email}>
                {user.email}
              </p>
            </div>
          </div>
        )}

        {user.phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="size-4 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-muted-foreground">Điện thoại</p>
              <p className="text-foreground">{user.phone}</p>
            </div>
          </div>
        )}

        {user.gender && (
          <div className="flex items-center gap-3 text-sm">
            <UserIcon className="size-4 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-muted-foreground">Giới tính</p>
              <p className="text-foreground">
                {user.gender === "MALE"
                  ? "Nam"
                  : user.gender === "FEMALE"
                    ? "Nữ"
                    : "Khác"}
              </p>
            </div>
          </div>
        )}
      </div>

      {!hideActions && !isDisabled && <div>{getRelationshipButton()}</div>}
      {!hideActions && isDisabled && (
        <div className="text-center text-sm text-muted-foreground p-3 bg-accent rounded-lg">
          Không thể kết bạn với tài khoản này
        </div>
      )}

      {isModal && (
        <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          ID: {user.id}
        </div>
      )}
    </div>
  );
};

export default BusinessCard;
