import { Bell, Shield, ShieldBan, ShieldCheck, Loader2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  if (!user) return null;

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
        passwordForm.newPassword,
      );
      toast.success("Thay đổi mật khẩu thành công");
      setIsPasswordOpen(false);
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      toast.error(err.response?.data || "Mật khẩu cũ không chính xác");
    } finally {
      setPassLoading(false);
    }
  };

  const handleLockAccount = async () => {
    const confirmed = window.confirm("Bạn có chắc muốn khoá tài khoản?");
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await userService.lockAccount(user.id);
      localStorage.removeItem("accessToken");
      window.location.href = "/signin";
    } catch {
      toast.error("Không thể khoá tài khoản. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Tài khoản của bạn sẽ bị xóa vĩnh viễn và không thể khôi phục. Bạn có chắc muốn tiếp tục?",
      )
    )
      return;
    try {
      setLoading(true);
      await userService.requestDeleteOtp();
      setShowOtpInput(true);
      toast.success("Mã OTP đã được gửi đến email của bạn.");
    } catch {
      toast.error("Không thể gửi mã OTP. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!otp || otp.length < 6) {
      toast.error("Vui lòng nhập mã OTP 6 chữ số.");
      return;
    }

    try {
      setLoading(true);
      await userService.confirmDeleteAccount(otp);
      toast.success("Tài khoản đã được xóa vĩnh viễn.");
      localStorage.clear();
      window.location.href = "/signin";
    } catch {
      toast.error("Mã OTP không xác thực hoặc đã hết hạn.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Quyền riêng tư và bảo mật
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
                Thay đổi mật khẩu
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
                  <Label
                    htmlFor="priv-old"
                    className="ml-1 text-xs font-bold text-muted-foreground uppercase"
                  >
                    Mật khẩu hiện tại
                  </Label>
                  <Input
                    id="priv-old"
                    type="password"
                    value={passwordForm.oldPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({
                        ...p,
                        oldPassword: e.target.value,
                      }))
                    }
                    className="rounded-xl h-11 bg-muted/20"
                  />
                </div>
                <div className="grid gap-2">
                  <Label
                    htmlFor="priv-new"
                    className="ml-1 text-xs font-bold text-muted-foreground uppercase"
                  >
                    Mật khẩu mới
                  </Label>
                  <Input
                    id="priv-new"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({
                        ...p,
                        newPassword: e.target.value,
                      }))
                    }
                    className="rounded-xl h-11 bg-muted/20"
                  />
                </div>
                <div className="grid gap-2">
                  <Label
                    htmlFor="priv-confirm"
                    className="ml-1 text-xs font-bold text-muted-foreground uppercase"
                  >
                    Xác nhận mật khẩu
                  </Label>
                  <Input
                    id="priv-confirm"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({
                        ...p,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="rounded-xl h-11 bg-muted/20"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="w-full h-11 rounded-xl shadow-lg shadow-primary/20"
                  onClick={handlePasswordChange}
                  disabled={
                    passLoading ||
                    !passwordForm.oldPassword ||
                    !passwordForm.newPassword
                  }
                >
                  {passLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
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
            Chặn & báo cáo
          </Button>

          <Button
            onClick={handleLockAccount}
            disabled={loading}
            className="w-full justify-start"
          >
            <ShieldBan className="size-4 mr-2" />
            Khóa tài khoản
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
                placeholder="Nhập mã OTP 6 chữ số"
                className="w-full p-2 rounded-md border bg-background text-center text-lg font-bold tracking-widest"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowOtpInput(false)}
                >
                  Huỷ
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleConfirmDelete}
                  disabled={loading}
                >
                  {loading ? "Đang xử lý..." : "Xác nhận xoá vĩnh viễn"}
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
