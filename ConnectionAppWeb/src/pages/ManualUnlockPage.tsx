import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function ManualUnlockPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialIdentifier = (location.state as any)?.usernameOrEmail ?? "";
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  const hasRouteIdentifier = initialIdentifier.trim().length >= 3;
  const canSubmitEmail = useMemo(
    () => identifier.trim().length >= 3 && isValidEmail(email),
    [identifier, email],
  );

  const requestOtp = async () => {
    if (!canSubmitEmail) {
      toast.error("Vui lòng nhập tên đăng nhập hợp lệ và email đã đăng ký.");
      return;
    }

    try {
      setLoading(true);
      await authService.requestManualUnlockOtp(identifier.trim(), email.trim());
      setStep("otp");
      toast.success("Mã OTP đã được gửi đến email của bạn.");
    } catch (error: any) {
      const msg = error?.response?.data?.message ?? "Không thể gửi mã OTP.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.trim().length < 6) {
      toast.error("Vui lòng nhập OTP hợp lệ.");
      return;
    }
    try {
      setLoading(true);
      await authService.verifyManualUnlockOtp(
        identifier.trim(),
        email.trim(),
        otp.trim(),
      );
      toast.success("Mở khóa tài khoản thành công. Vui lòng đăng nhập lại.");
      navigate("/signin");
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ??
        "Mã OTP không hợp lệ hoặc đã hết hạn.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tài khoản đã bị khóa</CardTitle>
          <CardDescription>
            Tài khoản của bạn đã bị khóa do yêu cầu của người dùng. Nếu muốn mở
            khóa vui lòng nhập email để xác thực.
          </CardDescription>
          {!hasRouteIdentifier && (
            <p className="text-sm text-amber-600">
              Không tìm thấy identifier từ màn hình đăng nhập. Vui lòng nhập lại
              tên đăng nhập hoặc email.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Tên đăng nhập hoặc email đăng nhập"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading || step === "otp"}
          />
          <Input
            type="email"
            placeholder="Nhập email đã đăng ký"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || step === "otp"}
          />
          {step === "otp" && (
            <Input
              placeholder="Nhập mã OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              disabled={loading}
            />
          )}
          <div className="flex gap-2">
            {step === "email" ? (
              <Button
                className="flex-1"
                onClick={requestOtp}
                disabled={!canSubmitEmail || loading}
              >
                {loading ? "Đang gửi..." : "Gửi OTP"}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("email")}
                  disabled={loading}
                >
                  Nhập lại email
                </Button>
                <Button
                  className="flex-1"
                  onClick={verifyOtp}
                  disabled={loading || otp.trim().length < 6}
                >
                  {loading ? "Đang xác thực..." : "Xác thực OTP"}
                </Button>
              </>
            )}
          </div>
          <Button
            variant="link"
            className="w-full"
            onClick={() => navigate("/signin")}
            disabled={loading}
          >
            Quay lại đăng nhập
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
