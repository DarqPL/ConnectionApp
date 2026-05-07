import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Users,
  Camera,
  Loader2,
  Edit2,
  Lock,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useState, useRef } from "react";
import { userService } from "@/services/userService";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ProfilePage = () => {
  const { user, setUser } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Form states
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState(user?.phone || "");

  // Password Form states
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  if (!user) return null;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const updatedUser = await userService.updateAvatar(formData);
      setUser(updatedUser);
      toast.success("Cập nhật ảnh đại diện thành công");
    } catch (err) {
      console.error(err);
      toast.error("Không thể upload ảnh. Thử lại sau.");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setEditLoading(true);
    try {
      const updatedUser = await userService.updateProfile({
        displayName,
        phone,
      });
      setUser(updatedUser);
      setIsEditDialogOpen(false);
      toast.success("Cập nhật thông tin thành công");
    } catch (err) {
      console.error(err);
      toast.error("Cập nhật thất bại. Vui lòng kiểm tra lại.");
    } finally {
      setEditLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    setPasswordLoading(true);
    try {
      await userService.changePassword(
        passwordForm.oldPassword,
        passwordForm.newPassword,
      );
      toast.success("Đổi mật khẩu thành công!");
      setIsPasswordDialogOpen(false);
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data || "Mật khẩu cũ không chính xác";
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const joinedDate = "January 2024";

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex-1 h-screen overflow-auto bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container max-w-5xl mx-auto p-6 space-y-6">
          {/* Header Section */}
          <div className="relative">
            <div className="h-32 bg-gradient-primary rounded-t-xl" />
            <div className="relative px-6 pb-6 bg-card rounded-b-xl shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 -mt-16">
                <div className="relative group">
                  <Avatar className="h-32 w-32 border-4 border-background shadow-xl cursor-pointer overflow-hidden">
                    <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                    <AvatarFallback className="text-4xl font-bold bg-muted">
                      {user.displayName.charAt(0)}
                    </AvatarFallback>
                    <div
                      onClick={handleAvatarClick}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {uploading ? (
                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                      ) : (
                        <Camera className="h-8 w-8 text-white" />
                      )}
                    </div>
                  </Avatar>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>

                <div className="flex-1 sm:mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h1 className="text-3xl font-bold">{user.displayName}</h1>
                      <p className="text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Personal Information */}
              <Card className="shadow-lg border-none glass-light">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Thông tin cá nhân</CardTitle>
                    <CardDescription>
                      Chi tiết về tài khoản của bạn
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDisplayName(user.displayName);
                      setPhone(user.phone || "");
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex items-center gap-4 p-3 rounded-lg">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-4 p-3 rounded-lg">
                    <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        Số điện thoại
                      </p>
                      <p className="font-medium">
                        {user.phone || "Chưa cập nhật"}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-4 p-3 rounded-lg">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        Ngày tham gia
                      </p>
                      <p className="font-medium">{joinedDate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Stats Section */}
              <Card className="shadow-lg border-none glass-light">
                <CardHeader>
                  <CardTitle>Hoạt động</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="text-sm">Tin nhắn</span>
                    </div>
                    <span className="font-bold">1.2k</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm">Bạn bè</span>
                    </div>
                    <span className="font-bold">42</span>
                  </div>
                </CardContent>
              </Card>

              {/* Security Section */}
              <Card className="shadow-lg border-none glass-light border-l-4 border-l-yellow-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-yellow-500" />
                    Bảo mật
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-yellow-500/20 hover:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                    onClick={() => setIsPasswordDialogOpen(true)}
                  >
                    <KeyRound className="h-4 w-4" />
                    Đổi mật khẩu
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin cá nhân của bạn.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ename">Tên hiển thị</Label>
              <Input
                id="ename"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ephone">Điện thoại</Label>
              <Input
                id="ephone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUpdateProfile}
              disabled={editLoading}
              className="w-full"
            >
              {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Modal */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px] rounded-3xl backdrop-blur-xl bg-background/95 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Thay đổi mật khẩu
            </DialogTitle>
            <DialogDescription>
              Nhập mật khẩu hiện tại và mật khẩu mới.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label
                htmlFor="pass-old"
                className="ml-1 text-xs font-bold text-muted-foreground uppercase"
              >
                Mật khẩu hiện tại
              </Label>
              <Input
                id="pass-old"
                type="password"
                placeholder="Nhập mật khẩu cũ"
                value={passwordForm.oldPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    oldPassword: e.target.value,
                  }))
                }
                className="rounded-xl h-11 bg-muted/20"
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="pass-new"
                className="ml-1 text-xs font-bold text-muted-foreground uppercase"
              >
                Mật khẩu mới
              </Label>
              <Input
                id="pass-new"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                className="rounded-xl h-11 bg-muted/20"
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="pass-confirm"
                className="ml-1 text-xs font-bold text-muted-foreground uppercase"
              >
                Xác nhận mật khẩu
              </Label>
              <Input
                id="pass-confirm"
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
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
                passwordLoading ||
                !passwordForm.oldPassword ||
                !passwordForm.newPassword
              }
            >
              {passwordLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Xác nhận thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default ProfilePage;
