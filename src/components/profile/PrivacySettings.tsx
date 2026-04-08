"use client";

import { useState, useEffect } from "react";
import { Shield, Bell, ShieldBan, Unlock } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { userService } from "@/services/userService";
import type { User } from "@/types/user";

type Props = {
  user: User | null;
};

const PrivacySettings = ({ user }: Props) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(user?.status);
  console.log(user);
  
  useEffect(() => {
    if (user?.status) {
      setStatus(user.status);
    }
  }, [user]);

  if (!user) return null;

  const handleLockToggle = async () => {
    try {
      setLoading(true);

      let message = "";

      if (status === "LOCKED") {
        message = await userService.unlockAccount(user.id);
        setStatus("OFFLINE");
      } else {
        message = await userService.lockAccount(user.id);
        setStatus("LOCKED");
      }

      console.log(message);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc muốn xoá tài khoản không?")) return;

    try {
      setLoading(true);
      const message = await userService.deleteAccount(user.id);
      console.log(message);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isLocked = status === "LOCKED";

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Quyền riêng tư & Bảo mật
        </CardTitle>
        <CardDescription>
          Quản lý cài đặt quyền riêng tư và bảo mật của bạn
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Button variant="outline" className="w-full justify-start">
            <Shield className="h-4 w-4 mr-2" />
            Đổi mật khẩu
          </Button>

          <Button variant="outline" className="w-full justify-start">
            <Bell className="h-4 w-4 mr-2" />
            Cài đặt thông báo
          </Button>

          <Button
            variant="outline"
            onClick={handleLockToggle}
            disabled={loading}
            className="w-full justify-start"
          >
            {isLocked ? (
              <>
                <Unlock className="size-4 mr-2" />
                Mở khóa tài khoản
              </>
            ) : (
              <>
                <ShieldBan className="size-4 mr-2" />
                Khóa tài khoản
              </>
            )}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3 text-destructive">
            Khu vực nguy hiểm
          </h4>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDelete}
            disabled={loading}
          >
            Xoá tài khoản
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrivacySettings;