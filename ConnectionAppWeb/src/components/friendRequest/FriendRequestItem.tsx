import type { Friend } from "@/types/user";
import type { ReactNode } from "react";
import UserAvatar from "../chat/UserAvatar";

interface RequestItemProps {
  requestInfo: Friend;
  actions: ReactNode;
  type: "sent" | "received";
}

const FriendRequestItem = ({ requestInfo, actions }: RequestItemProps) => {
  if (!requestInfo) {
    return;
  }

  return (
    <div className="flex items-center justify-between rounded-lg shadow-md border border-primary-foreground p-3">
      <div className="flex items-center gap-3">
        <UserAvatar
          type="sidebar"
          name={requestInfo.displayName}
          avatarUrl={requestInfo.avatarUrl}
        />
        <div>
          <p className="font-medium">{requestInfo.displayName}</p>
          <p className="text-sm text-muted-foreground">@{requestInfo.username}</p>
        </div>
      </div>
      {actions}
    </div>
  );
};

export default FriendRequestItem;
