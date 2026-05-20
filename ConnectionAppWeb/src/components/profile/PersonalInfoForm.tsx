import { Heart } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { User } from "@/types/user";
import { useState } from "react";
import { useUserStore } from "@/stores/useUserStore";

type Props = {
  userInfo: User | null;
};

const PersonalInfoForm = ({ userInfo }: Props) => {
  const { updateProfile } = useUserStore();
  const [displayName, setDisplayName] = useState(userInfo?.displayName ?? "");

  const handleSave = async () => {
    await updateProfile({ displayName });
  };

  if (!userInfo) return null;

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5 text-primary" />
          Thông tin cá nhân
        </CardTitle>
        <CardDescription>
          Cập nhật chi tiết cá nhân và thông tin hồ sơ của bạn
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Display Name - Editable */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Tên hiển thị</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="glass-light border-border/30"
            />
          </div>

          {/* Username - Read-only */}
          <div className="space-y-2">
            <Label htmlFor="username">Tên người dùng</Label>
            <Input
              id="username"
              type="text"
              value={userInfo.username}
              disabled
              className="glass-light border-border/30 bg-muted/50 cursor-not-allowed"
            />
          </div>

          {/* Email - Read-only */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={userInfo.email}
              disabled
              className="glass-light border-border/30 bg-muted/50 cursor-not-allowed"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          className="w-full md:w-auto bg-gradient-primary hover:opacity-90 transition-opacity"
        >
          Lưu thay đổi
        </Button>
      </CardContent>
    </Card>
  );
};

export default PersonalInfoForm;
