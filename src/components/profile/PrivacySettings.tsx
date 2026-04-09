import { authService, type DeviceSession } from "@/services/authService";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  Bell,
  Globe,
  Laptop,
  Loader2,
  RotateCcw,
  Shield,
  ShieldBan,
  Smartphone,
  Tablet,
} from "lucide-react";
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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { Separator } from "../ui/separator";

const formatDate = (value?: string) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("vi-VN", {
    hour12: false,
  });
};

const iconFromDevice = (deviceName?: string) => {
  const keyword = (deviceName ?? "").toLowerCase();
  if (keyword.includes("iphone") || keyword.includes("android"))
    return Smartphone;
  if (keyword.includes("ipad") || keyword.includes("tablet")) return Tablet;
  if (
    keyword.includes("windows") ||
    keyword.includes("mac") ||
    keyword.includes("linux")
  )
    return Laptop;
  return Globe;
};

const PrivacySettings = () => {
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const { clearState } = useAuthStore();
  const navigate = useNavigate();

  const sortedDevices = useMemo(
    () =>
      [...devices].sort((a, b) => {
        const bTime = new Date(b.lastUsedAt || b.createdAt).getTime();
        const aTime = new Date(a.lastUsedAt || a.createdAt).getTime();
        return bTime - aTime;
      }),
    [devices],
  );

  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const data = await authService.getDevices();
      setDevices(data);
    } catch {
      toast.error("Không tải được danh sách thiết bị");
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    const confirmed = window.confirm(
      "Bạn có chắc muốn đăng xuất khỏi tất cả thiết bị? Bạn sẽ phải đăng nhập lại.",
    );
    if (!confirmed) return;

    setLogoutAllLoading(true);
    try {
      await authService.logoutAllDevices();
      clearState();
      toast.success("Đã đăng xuất tất cả thiết bị");
      navigate("/signin");
    } catch {
      toast.error("Không thể đăng xuất tất cả thiết bị");
    } finally {
      setLogoutAllLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);
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
          Quản lý cài đặt quyền riêng tư và phiên đăng nhập của bạn
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
          <Button
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

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h4 className="font-medium">Thiết bị đang đăng nhập</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDevices}
              disabled={loadingDevices}
            >
              {loadingDevices ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Làm mới"
              )}
            </Button>
          </div>

          {loadingDevices ? (
            <div className="text-sm text-muted-foreground">
              Đang tải danh sách thiết bị...
            </div>
          ) : sortedDevices.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Không có phiên đăng nhập nào đang hoạt động.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedDevices.map((device) => {
                const DeviceIcon = iconFromDevice(device.deviceName);
                return (
                  <div
                    key={device.id}
                    className="rounded-lg border border-border/40 p-3 bg-background/40"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="rounded-md bg-primary/10 p-2 mt-0.5">
                          <DeviceIcon className="size-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium wrap-break-word">
                            {device.deviceName || "Unknown device"}
                          </p>
                          <p className="text-xs text-muted-foreground wrap-break-word">
                            IP: {device.ipAddress || "-"}
                          </p>
                          <p className="text-xs text-muted-foreground break-all leading-relaxed">
                            {device.userAgent || "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground wrap-break-word mt-2">
                      Lần hoạt động gần nhất: {formatDate(device.lastUsedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground wrap-break-word">
                      Hết hạn: {formatDate(device.expiryDate)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border/30">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogoutAllDevices}
            disabled={logoutAllLoading}
          >
            {logoutAllLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4 mr-2" />
            )}
            Đăng xuất tất cả thiết bị
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
