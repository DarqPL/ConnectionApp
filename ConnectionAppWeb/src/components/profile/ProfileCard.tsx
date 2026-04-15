import type { User } from "@/types/user";
import { Card, CardContent } from "../ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import AvatarUploader from "./AvatarUploader";
import { useState, useEffect, useRef } from "react";



interface ProfileCardProps {
  user: User | null;
}


const ProfileCard = ({ user }: ProfileCardProps) => {
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl);
  const prevAvatarUrlRef = useRef<string | undefined>(user?.avatarUrl);

  // Force re-fetch avatar when URL changes by adding cache-busting query param
  useEffect(() => {
    if (user?.avatarUrl && user.avatarUrl !== prevAvatarUrlRef.current) {
      prevAvatarUrlRef.current = user.avatarUrl;
      // Add timestamp to avatar URL to bust browser cache
      setAvatarUrl(`${user.avatarUrl}?v=${Date.now()}`);
    } else if (!user?.avatarUrl && avatarUrl !== undefined) {
      setAvatarUrl(undefined);
    }
  }, [user?.avatarUrl]);

  if (!user) return;

  if (!user.bio) {
    user.bio = "Will code for food 💻";
  }

  // Hardcoded online status for now
  const isOnline = true;

  return (
    <Card className="overflow-hidden p-0 h-52 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
      <CardContent className="mt-20 pb-8 flex flex-col sm:flex-row items-center sm:items-end gap-6">
        <div className="relative">
          <Avatar className="h-24 w-24 ring-4 ring-white shadow-lg">
            <AvatarImage src={avatarUrl ?? undefined} alt={user.displayName} />
            <AvatarFallback className="text-2xl font-bold">
              {user.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <AvatarUploader />
        </div>

        {/* user info */}
        <div className="text-center sm:text-left flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {user.displayName}
          </h1>

          {user.bio && (
            <p className="text-white/70 text-sm mt-2 max-w-lg line-clamp-2">
              {user.bio}
            </p>
          )}
        </div>

        {/* status */}
        <Badge
          className={cn(
            "flex items-center gap-1 capitalize",
            isOnline ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
          )}
        >
          <div
            className={cn(
              "size-2 rounded-full",
              isOnline ? "bg-green-500 animate-pulse" : "bg-slate-500"
            )}
          />

          {isOnline ? "online" : "offline"}
        </Badge>
      </CardContent>
    </Card>
  );
};

export default ProfileCard;
