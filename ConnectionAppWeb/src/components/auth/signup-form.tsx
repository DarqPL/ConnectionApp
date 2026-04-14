import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "../ui/label";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { Mail, KeyRound, UserPlus } from "lucide-react";

// ─── Step 1: Nhập email ───────────────────────────────────────────────────────
const emailSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});
type EmailForm = z.infer<typeof emailSchema>;

// ─── Step 2: Nhập OTP ─────────────────────────────────────────────────────────
const otpSchema = z.object({
  otp: z
    .string()
    .length(6, "Mã OTP phải có đúng 6 chữ số")
    .regex(/^\d+$/, "Mã OTP chỉ chứa chữ số"),
});
type OtpForm = z.infer<typeof otpSchema>;

// ─── Step 3: Đăng ký tài khoản ────────────────────────────────────────────────
const registerSchema = z
  .object({
    firstname: z.string().min(1, "Tên bắt buộc phải có"),
    lastname: z.string().min(1, "Họ bắt buộc phải có"),
    username: z.string().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });
type RegisterForm = z.infer<typeof registerSchema>;

type Step = "email" | "otp" | "register";

export function SignupForm({ className, ...props }: React.ComponentProps<"div">) {
  const { signUp } = useAuthStore();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(0);

  // ── Đếm ngược chỉ bắt đầu khi bước OTP được hiển thị ──────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // ── OTP digit refs ──────────────────────────────────────────────────────────
  const otpDigits = useRef<(HTMLInputElement | null)[]>([]);
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);

  // ── Forms ───────────────────────────────────────────────────────────────────
  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  // ── Step index cho thanh progress ──────────────────────────────────────────
  const stepIndex = { email: 0, otp: 1, register: 2 }[step];

  // ── Step 1: Gửi OTP đến email ──────────────────────────────────────────────
  const onSubmitEmail = async (data: EmailForm) => {
    try {
      // Gửi OTP với username rỗng tạm thời (backend chỉ cần email để gửi OTP)
      await authService.sendSignupOtp(data.email, "");
      setEmail(data.email);
      setStep("otp");
      setCountdown(60); // bắt đầu đếm ngược khi vào bước OTP
      toast.success("Mã OTP đã được gửi đến email của bạn!");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Không thể gửi mã OTP. Vui lòng thử lại.";
      toast.error(msg);
    }
  };

  // ── OTP digit input handler ─────────────────────────────────────────────────
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

  // ── Step 2: Xác minh OTP ───────────────────────────────────────────────
  const onSubmitOtp = async (data: OtpForm) => {
    try {
      await authService.verifyOtp(email, data.otp);
      // Backend đã đánh dấu email "đã xác minh" (10 phút)
      // Frontend chỉ cần chuyển bước — không cần lưu OTP nữa
      setStep("register");
      toast.success("Xác minh email thành công! Hãy điền thông tin tài khoản.");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Mã OTP không hợp lệ hoặc đã hết hạn";
      toast.error(msg);
    }
  };

  // ── Gửi lại OTP ────────────────────────────────────────────────────────────
  const resendOtp = async () => {
    try {
      await authService.sendSignupOtp(email, "");
      setCountdown(60);
      setOtpValues(["", "", "", "", "", ""]);
      otpForm.setValue("otp", "");
      otpDigits.current[0]?.focus();
      toast.success("Mã OTP mới đã được gửi!");
    } catch {
      toast.error("Không thể gửi lại OTP. Vui lòng thử lại sau.");
    }
  };

  // ── Step 3: Đăng ký tài khoản ──────────────────────────────────────────
  const onSubmitRegister = async (data: RegisterForm) => {
    try {
      // Backend kiểm tra trạng thái xác minh email (không cần gửi OTP)
      await signUp(data.username, data.password, email, data.firstname, data.lastname);
      toast.success("Đăng ký tài khoản thành công!");
      navigate("/signin");
    } catch (error: any) {
      const message =
        error.response?.data?.message ?? "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.";
      toast.error(message);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 border-border">
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* ── LEFT PANEL ── */}
          <div className="p-6 md:p-8 flex flex-col gap-6">
            {/* Logo + tiêu đề */}
            <div className="flex flex-col items-center text-center gap-2">
              <a href="/" className="mx-auto block w-fit text-center">
                <img src="/logo.svg" alt="logo" />
              </a>
              <h1 className="text-2xl font-bold">Tạo tài khoản Connection</h1>
              <p className="text-muted-foreground text-balance text-sm">
                {step === "email" && "Nhập email để nhận mã xác nhận"}
                {step === "otp" && (
                  <>
                    Nhập mã OTP đã gửi đến{" "}
                    <span className="text-primary font-medium">{email}</span>
                  </>
                )}
                {step === "register" && "Điền thông tin để hoàn tất đăng ký"}
              </p>
            </div>

            {/* ── Thanh tiến trình ── */}
            <div className="flex items-center justify-center gap-3">
              {["Email", "OTP", "Tài khoản"].map((label, i) => (
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

            {/* ── BƯỚC 1: EMAIL ── */}
            {step === "email" && (
              <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-email" className="flex items-center gap-1">
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@gmail.com"
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
                  Đã có tài khoản?{" "}
                  <a href="/signin" className="underline underline-offset-4 hover:text-primary">
                    Đăng nhập
                  </a>
                </div>
              </form>
            )}

            {/* ── BƯỚC 2: OTP ── */}
            {step === "otp" && (
              <form onSubmit={otpForm.handleSubmit(onSubmitOtp)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <Label className="flex items-center gap-1">
                    <KeyRound className="h-4 w-4" /> Mã OTP (6 chữ số)
                  </Label>
                  <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
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

                  {/* Đếm ngược / gửi lại */}
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
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={otpForm.formState.isSubmitting}
                >
                  {otpForm.formState.isSubmitting ? "Đang xác minh..." : "Xác minh OTP"}
                </Button>

                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary text-center"
                >
                  ← Thay đổi email
                </button>
              </form>
            )}

            {/* ── BƯỚC 3: ĐĂNG KÝ TÀI KHOẢN ── */}
            {step === "register" && (
              <form
                onSubmit={registerForm.handleSubmit(onSubmitRegister)}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center gap-1 text-sm font-medium text-primary mb-1">
                  <UserPlus className="h-4 w-4" />
                  <span>Thông tin tài khoản</span>
                </div>

                {/* Họ & Tên */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="lastname" className="text-sm">Họ</Label>
                    <Input type="text" id="lastname" placeholder="Nguyễn" {...registerForm.register("lastname")} />
                    {registerForm.formState.errors.lastname && (
                      <p className="error-message text-destructive text-xs">
                        {registerForm.formState.errors.lastname.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firstname" className="text-sm">Tên</Label>
                    <Input type="text" id="firstname" placeholder="Văn A" {...registerForm.register("firstname")} />
                    {registerForm.formState.errors.firstname && (
                      <p className="error-message text-destructive text-xs">
                        {registerForm.formState.errors.firstname.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Username */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="username" className="text-sm">Tên đăng nhập</Label>
                  <Input
                    type="text"
                    id="username"
                    placeholder="connection"
                    {...registerForm.register("username")}
                  />
                  {registerForm.formState.errors.username && (
                    <p className="error-message text-destructive text-xs">
                      {registerForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                {/* Mật khẩu */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password" className="text-sm">Mật khẩu</Label>
                  <Input
                    type="password"
                    id="password"
                    placeholder="Ít nhất 6 ký tự"
                    {...registerForm.register("password")}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="error-message text-destructive text-xs">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {/* Xác nhận mật khẩu */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmPassword" className="text-sm">Xác nhận mật khẩu</Label>
                  <Input
                    type="password"
                    id="confirmPassword"
                    placeholder="Nhập lại mật khẩu"
                    {...registerForm.register("confirmPassword")}
                  />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="error-message text-destructive text-xs">
                      {registerForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerForm.formState.isSubmitting}
                >
                  {registerForm.formState.isSubmitting ? "Đang đăng ký..." : "Xác nhận & Đăng ký"}
                </Button>

                <div className="text-center text-sm">
                  Đã có tài khoản?{" "}
                  <a href="/signin" className="underline underline-offset-4 hover:text-primary">
                    Đăng nhập
                  </a>
                </div>
              </form>
            )}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="bg-muted relative hidden md:block">
            <img
              src="/placeholderSignUp.png"
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
