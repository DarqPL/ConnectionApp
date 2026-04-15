import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Mail, Phone, Calendar, User, MessageSquare, Users, Clock, Camera, Loader2, Edit2 } from "lucide-react";
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

  // Form states
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState(user?.phone || "");

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

  const joinedDate = "January 2024"; // Fallback or compute from user data if available

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
                    
                    {/* Hover Overlay */}
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
                  <div className={`absolute bottom-2 right-2 h-6 w-6 rounded-full border-4 border-background ${user.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>

                <div className="flex-1 sm:mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h1 className="text-3xl font-bold">{user.displayName}</h1>
                      <p className="text-muted-foreground">@{user.username}</p>
                    </div>
                    <Badge variant="outline" className="w-fit">
                      <span className={`inline-block h-2 w-2 rounded-full mr-2 ${user.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {user.status}
                    </Badge>
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
                    <CardDescription>Chi tiết về tài khoản của bạn</CardDescription>
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
                  <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Mail className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Phone className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Số điện thoại</p>
                      <p className="font-medium">{user.phone || "Chưa cập nhật"}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Calendar className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Ngày tham gia</p>
                      <p className="font-medium">{joinedDate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
                {/* Stats Section Placeholder */}
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
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
            <DialogDescription>
              Thay đổi thông tin hiển thị của bạn tại đây.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Tên hiển thị
              </Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Điện thoại
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateProfile} disabled={editLoading}>
              {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default ProfilePage;
