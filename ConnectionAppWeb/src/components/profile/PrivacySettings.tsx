import { Bell, Shield, ShieldBan, Unlock } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { userService } from "@/services/userService";
import type { User } from "@/types/user";

type Props = {
  user: User | null;
};

const PrivacySettings = ({ user }: Props) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(user?.status);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (user?.status) {
      setStatus(user.status);
    }
  }, [user]);

  if (!user) return null;

  const handleLockToggle = async () => {
    try {
      setLoading(true);

      if (status === "LOCKED") {
        await userService.unlockAccount(user.id);
        setStatus("OFFLINE");
      } else {
        await userService.lockAccount(user.id);
        setStatus("LOCKED");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Tài khoản của bạn sẽ bị xóa vĩnh viễn và không thể khôi phục. Bạn có chắc muốn tiếp tục?")) return;

    try {
      setLoading(true);
      await userService.requestDeleteOtp();
      setShowOtpInput(true);
      alert("Mã OTP đã được gửi đến email của bạn.");
    } catch (err) {
      console.error(err);
      alert("Không thể gửi mã OTP. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!otp || otp.length < 6) {
      alert("Vui lòng nhập mã OTP 6 chữ số.");
      return;
    }

    try {
      setLoading(true);
      await userService.confirmDeleteAccount(otp);
      alert("Tài khoản đã được xóa vĩnh viễn.");
      localStorage.clear(); // Clear all auth data
      window.location.href = "/signin";
    } catch (err) {
      console.error(err);
      alert("Mã OTP không xác thực hoặc đã hết hạn.");
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
          Quản lý cài đặt quyền riêng tư cho tài khoản của bạn
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Button
            variant="outline"
            className="w-full justify-start glass-light border-border/30 hover:text-warning"
          >
            <Shield className="h-4 w-4 mr-2" />
            Đổi mật khẩu
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start glass-light border-border/30 hover:text-info"
          >
            <Bell className="h-4 w-4 mr-2" />
            Cài đặt thông báo
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start glass-light border-border/30 hover:text-destructive"
          >
            <ShieldBan className="size-4 mr-2" />
            Chặn & Báo cáo
          </Button>

          <Button
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
          {showOtpInput ? (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nhập mã OTP 6 số"
                className="w-full p-2 rounded-md border bg-background text-center text-lg font-bold tracking-widest"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowOtpInput(false)}>
                  Hủy
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleConfirmDelete} disabled={loading}>
                  {loading ? "Đang xử lý..." : "Xác nhận xóa vĩnh viễn"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDelete}
              disabled={loading}
            >
              Xoá tài khoản
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PrivacySettings;
