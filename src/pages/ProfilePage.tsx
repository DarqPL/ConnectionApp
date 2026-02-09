import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Mail, Phone, Calendar, User, MessageSquare, Users, Clock } from "lucide-react";

const ProfilePage = () => {
  // Hardcoded user data
  const user = {
    id: '1',
    username: 'johndoe',
    displayName: 'John Doe',
    email: 'johndoe@example.com',
    phone: '+84 123 456 789',
    avatarUrl: 'https://i.pravatar.cc/150?img=3',
    bio: 'Passionate about technology and connecting with people. Love to code and explore new ideas.',
    status: 'online',
    joinedDate: 'January 2024',
    stats: {
      totalMessages: 1234,
      totalFriends: 42,
      totalGroups: 8,
      hoursOnline: 156
    }
  };

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
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                    <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                    <AvatarFallback className="text-4xl font-bold">
                      {user.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-2 right-2 h-6 w-6 bg-green-500 rounded-full border-4 border-background" />
                </div>

                <div className="flex-1 sm:mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h1 className="text-3xl font-bold">{user.displayName}</h1>
                      <p className="text-muted-foreground">@{user.username}</p>
                    </div>
                    <Badge variant="outline" className="w-fit">
                      <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-2" />
                      {user.status}
                    </Badge>
                  </div>
                  <p className="mt-4 text-muted-foreground">{user.bio}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{user.stats.totalMessages}</p>
                    <p className="text-xs text-muted-foreground">Tin nhắn</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <Users className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{user.stats.totalFriends}</p>
                    <p className="text-xs text-muted-foreground">Bạn bè</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <User className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{user.stats.totalGroups}</p>
                    <p className="text-xs text-muted-foreground">Nhóm</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <Clock className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{user.stats.hoursOnline}h</p>
                    <p className="text-xs text-muted-foreground">Online</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Personal Information */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Thông tin cá nhân</CardTitle>
              <CardDescription>Chi tiết về tài khoản của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Phone className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Số điện thoại</p>
                  <p className="font-medium">{user.phone}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Ngày tham gia</p>
                  <p className="font-medium">{user.joinedDate}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Cài đặt tài khoản</CardTitle>
              <CardDescription>Quản lý thông tin và cài đặt của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                Chỉnh sửa thông tin
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Đổi mật khẩu
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Cài đặt quyền riêng tư
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ProfilePage;
