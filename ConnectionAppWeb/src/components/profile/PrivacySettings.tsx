import { Bell, Shield, ShieldBan, Unlock, ShieldCheck, KeyRound, Loader2 } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  user: User | null;
};

const PrivacySettings = ({ user }: Props) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(user?.status);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");

  // Password change states
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("Mật khẩu phải từ 6 ký tự");
      return;
    }

    setPassLoading(true);
    try {
      await userService.changePassword(
        passwordForm.oldPassword,
        passwordForm.newPassword
      );
      toast.success("Thay đổi mật khẩu thành công");
      setIsPasswordOpen(false);
      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      const msg = err.response?.data || "Mật khẩu cũ không chính xác";
      toast.error(msg);
    } finally {
      setPassLoading(false);
    }
  };

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
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start glass-light border-border/30 hover:text-warning"
          >
            <Shield className="h-4 w-4 mr-2" />
            Đổi mật khẩu
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] rounded-3xl backdrop-blur-xl bg-background/95 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Thay đổi mật khẩu
            </DialogTitle>
            <DialogDescription>
              Nhập mật khẩu hiện tại và mật khẩu mới để bảo mật tài khoản.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="priv-old" className="ml-1 text-xs font-bold text-muted-foreground uppercase">Mật khẩu hiện tại</Label>
              <Input
                id="priv-old"
                type="password"
                placeholder="Nhập mật khẩu cũ"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                className="rounded-xl h-11 bg-muted/20"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priv-new" className="ml-1 text-xs font-bold text-muted-foreground uppercase">Mật khẩu mới</Label>
              <Input
                id="priv-new"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                className="rounded-xl h-11 bg-muted/20"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priv-confirm" className="ml-1 text-xs font-bold text-muted-foreground uppercase">Xác nhận mật khẩu</Label>
              <Input
                id="priv-confirm"
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="rounded-xl h-11 bg-muted/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
                className="w-full h-11 rounded-xl shadow-lg shadow-primary/20" 
                onClick={handlePasswordChange}
                disabled={passLoading || !passwordForm.oldPassword || !passwordForm.newPassword}
            >
              {passLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
