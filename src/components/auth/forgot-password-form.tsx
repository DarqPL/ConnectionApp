import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useRef, useEffect } from "react";
import { authService } from "@/services/authService";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { CheckCircle2, Mail, KeyRound, Lock } from "lucide-react";

// ─── Step 1: nhập email ──────────────────────────────────────────────────────
const emailSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});
type EmailForm = z.infer<typeof emailSchema>;

// ─── Step 2: nhập OTP ────────────────────────────────────────────────────────
const otpSchema = z.object({
  otp: z
    .string()
    .length(6, "Mã OTP phải có đúng 6 chữ số")
    .regex(/^\d+$/, "Mã OTP chỉ chứa chữ số"),
});
type OtpForm = z.infer<typeof otpSchema>;

// ─── Step 3: đặt mật khẩu mới ───────────────────────────────────────────────
const resetSchema = z
  .object({
    newPassword: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });
type ResetForm = z.infer<typeof resetSchema>;

type Step = "email" | "otp" | "reset" | "success";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // ── OTP input refs ─────────────────────────────────────────────────────────
  const otpDigits = useRef<(HTMLInputElement | null)[]>([]);
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);

  // ── Forms ──────────────────────────────────────────────────────────────────
  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const stepIndex = { email: 0, otp: 1, reset: 2, success: 3 }[step];

  // ── Step 1: Gửi OTP ───────────────────────────────────────────────────────
  const onSubmitEmail = async (data: EmailForm) => {
    try {
      await authService.forgotPassword(data.email);
      setEmail(data.email);
      setStep("otp");
      setCountdown(60);
      toast.success("Mã OTP đã được gửi đến email của bạn!");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra. Vui lòng thử lại.";
      toast.error(msg);
    }
  };

  // ── OTP digit input handler ────────────────────────────────────────────────
  const handleOtpDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otpValues];
    next[index] = value;
    setOtpValues(next);
    otpForm.setValue("otp", next.join(""));
    if (value && index < 5) otpDigits.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpDigits.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...otpValues];
    pasted.split("").forEach((ch, i) => (next[i] = ch));
    setOtpValues(next);
    otpForm.setValue("otp", next.join(""));
    otpDigits.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  };

  // ── Step 2: Xác minh OTP ─────────────────────────────────────────────────
  const onSubmitOtp = async (data: OtpForm) => {
    try {
      await authService.verifyOtp(email, data.otp);
      setOtp(data.otp);
      setStep("reset");
      toast.success("Xác minh OTP thành công!");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Mã OTP không hợp lệ hoặc đã hết hạn";
      toast.error(msg);
    }
  };

  // ── Step 3: Đặt lại mật khẩu ─────────────────────────────────────────────
  const onSubmitReset = async (data: ResetForm) => {
    try {
      await authService.resetPassword(email, otp, data.newPassword);
      setStep("success");
      toast.success("Đặt lại mật khẩu thành công!");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra. Vui lòng thử lại.";
      toast.error(msg);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const resendOtp = async () => {
    try {
      await authService.forgotPassword(email);
      setCountdown(60);
      toast.success("Mã OTP mới đã được gửi!");
      setOtpValues(["", "", "", "", "", ""]);
      otpForm.setValue("otp", "");
      otpDigits.current[0]?.focus();
    } catch {
      toast.error("Không thể gửi lại OTP. Vui lòng thử lại sau.");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 border-border">
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* ── LEFT PANEL ── */}
          <div className="p-6 md:p-8 flex flex-col gap-6">
            {/* Logo */}
            <div className="flex flex-col items-center text-center gap-2">
              <a href="/" className="mx-auto block w-fit text-center">
                <img src="/logo.svg" alt="logo" />
              </a>
              <h1 className="text-2xl font-bold">Quên mật khẩu</h1>
              <p className="text-muted-foreground text-balance text-sm">
                {step === "email" && "Nhập email để nhận mã OTP"}
                {step === "otp" && (
                  <>
                    Nhập mã OTP đã gửi đến{" "}
                    <span className="text-primary font-medium">{email}</span>
                  </>
                )}
                {step === "reset" && "Tạo mật khẩu mới cho tài khoản của bạn"}
                {step === "success" && "Mật khẩu đã được cập nhật thành công"}
              </p>
            </div>

            {/* ── Step Indicator ── */}
            {step !== "success" && (
              <div className="flex items-center justify-center gap-3">
                {["Email", "OTP", "Mật khẩu"].map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300",
                        i < stepIndex
                          ? "border-primary bg-primary text-primary-foreground"
                          : i === stepIndex
                            ? "border-primary text-primary"
                            : "border-muted-foreground/30 text-muted-foreground/50"
                      )}
                    >
                      {i < stepIndex ? "✓" : i + 1}
                    </div>
                    <span
                      className={cn(
                        "text-xs hidden sm:block",
                        i === stepIndex ? "text-primary font-medium" : "text-muted-foreground/50"
                      )}
                    >
                      {label}
                    </span>
                    {i < 2 && (
                      <div
                        className={cn(
                          "h-px w-8 transition-all duration-300",
                          i < stepIndex ? "bg-primary" : "bg-muted-foreground/20"
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── STEP 1: EMAIL ── */}
            {step === "email" && (
              <form
                onSubmit={emailForm.handleSubmit(onSubmitEmail)}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fp-email" className="flex items-center gap-1">
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  <Input
                    id="fp-email"
                    type="email"
                    placeholder="you@example.com"
                    {...emailForm.register("email")}
                  />
                  {emailForm.formState.errors.email && (
                    <p className="text-destructive text-sm">
                      {emailForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={emailForm.formState.isSubmitting}
                >
                  {emailForm.formState.isSubmitting ? "Đang gửi..." : "Gửi mã OTP"}
                </Button>
                <div className="text-center text-sm">
                  <a href="/signin" className="underline underline-offset-4 text-muted-foreground hover:text-primary">
                    ← Quay lại đăng nhập
                  </a>
                </div>
              </form>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === "otp" && (
              <form
                onSubmit={otpForm.handleSubmit(onSubmitOtp)}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-1">
                    <KeyRound className="h-4 w-4" /> Mã OTP (6 chữ số)
                  </Label>
                  <div
                    className="flex gap-2 justify-center"
                    onPaste={handleOtpPaste}
                  >
                    {otpValues.map((val, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpDigits.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={val}
                        onChange={(e) => handleOtpDigit(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className={cn(
                          "h-12 w-11 rounded-md border-2 bg-background text-center text-xl font-bold",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
                          "transition-all duration-150",
                          val ? "border-primary text-primary" : "border-input"
                        )}
                      />
                    ))}
                  </div>
                  {otpForm.formState.errors.otp && (
                    <p className="text-destructive text-sm text-center">
                      {otpForm.formState.errors.otp.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={otpForm.formState.isSubmitting}
                >
                  {otpForm.formState.isSubmitting ? "Đang xác minh..." : "Xác minh OTP"}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Không nhận được mã?{" "}
                  {countdown > 0 ? (
                    <span className="font-medium text-primary">Gửi lại sau {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={resendOtp}
                      className="underline underline-offset-4 hover:text-primary cursor-pointer font-medium"
                    >
                      Gửi lại OTP
                    </button>
                  )}
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
                  >
                    ← Thay đổi email
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 3: RESET PASSWORD ── */}
            {step === "reset" && (
              <form
                onSubmit={resetForm.handleSubmit(onSubmitReset)}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-password" className="flex items-center gap-1">
                    <Lock className="h-4 w-4" /> Mật khẩu mới
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Nhập mật khẩu mới"
                    {...resetForm.register("newPassword")}
                  />
                  {resetForm.formState.errors.newPassword && (
                    <p className="text-destructive text-sm">
                      {resetForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password" className="flex items-center gap-1">
                    <Lock className="h-4 w-4" /> Xác nhận mật khẩu
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Nhập lại mật khẩu"
                    {...resetForm.register("confirmPassword")}
                  />
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="text-destructive text-sm">
                      {resetForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetForm.formState.isSubmitting}
                >
                  {resetForm.formState.isSubmitting ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
                </Button>
              </form>
            )}

            {/* ── STEP 4: SUCCESS ── */}
            {step === "success" && (
              <div className="flex flex-col items-center gap-5 text-center py-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-lg">Thay đổi mật khẩu thành công!</p>
                  <p className="text-muted-foreground text-sm">
                    Mật khẩu của bạn đã được cập nhật. Hãy đăng nhập với mật khẩu mới.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => navigate("/signin")}
                >
                  Đăng nhập ngay
                </Button>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="bg-muted relative hidden md:block">
            <img
              src="/placeholder.png"
              alt="Image"
              className="absolute top-1/2 -translate-y-1/2 object-cover"
            />
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-balance px-6 text-center text-muted-foreground *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary">
        Bằng cách tiếp tục, bạn đồng ý với{" "}
        <a href="#">Điều khoản dịch vụ</a> và{" "}
        <a href="#">Chính sách bảo mật</a> của chúng tôi.
      </div>
    </div>
  );
}
