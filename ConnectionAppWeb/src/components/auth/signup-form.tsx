import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "../ui/label";
// import { useAuthStore } from "@/stores/useAuthStore";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";

const signUpSchema = z.object({
  firstname: z.string().min(1, "Tên bắt buộc phải có"),
  lastname: z.string().min(1, "Họ bắt buộc phải có"),
  username: z.string().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  otp: z.string().length(6, "Mã OTP phải có 6 ký tự"),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignupForm({ className, ...props }: React.ComponentProps<"div">) {
  const { signUp, sendSignupOtp } = useAuthStore();
  const navigate = useNavigate();
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
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

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    shouldUnregister: false,
    defaultValues: {
      firstname: "",
      lastname: "",
      username: "",
      email: "",
      password: "",
      otp: "",
    }
  });

  const emailValue = watch("email");
  const usernameValue = watch("username");

  const handleSendOtp = async () => {
    // Validate Step 1 fields first
    const isValid = await trigger(["firstname", "lastname", "username", "email", "password"]);
    if (!isValid) {
      toast.error("Vui lòng điền đầy đủ và đúng định dạng các thông tin");
      return;
    }

    setOtpLoading(true);
    try {
      await sendSignupOtp(emailValue, usernameValue);
      setOtpSent(true);
      setCountdown(60);
      toast.success("Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư!");
    } catch (error: any) {
      const message = error.response?.data?.message || "Không thể gửi mã OTP. Vui lòng thử lại.";
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const onSubmit = async (data: SignUpFormValues) => {
    const { firstname, lastname, username, email, password, otp } = data;

    try {
      // gọi backend để signup
      await signUp(username, password, email, firstname, lastname, otp);
      toast.success("Đăng ký tài khoản thành công!");
      navigate("/signin");
    } catch (error: any) {
      const message = error.response?.data?.message || "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.";
      toast.error(message);
      if (message.includes("OTP")) {
        setError("otp", { message });
      }
    }
  };

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <Card className="overflow-hidden p-0 border-border">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            className="p-6 md:p-8"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-6">
              {/* header - logo */}
              <div className="flex flex-col items-center text-center gap-2">
                <a
                  href="/"
                  className="mx-auto block w-fit text-center"
                >
                  <img
                    src="/logo.svg"
                    alt="logo"
                  />
                </a>

                <h1 className="text-2xl font-bold">Tạo tài khoản Connection</h1>
                <p className="text-muted-foreground text-balance">
                  Chào mừng bạn! Hãy đăng ký để bắt đầu!
                </p>
              </div>

              {!otpSent ? (
                <>
                  {/* họ & tên */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="lastname" className="block text-sm">Họ</Label>
                      <Input type="text" id="lastname" {...register("lastname")} />
                      {errors.lastname && <p className="error-message">{errors.lastname.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="firstname" className="block text-sm">Tên</Label>
                      <Input type="text" id="firstname" {...register("firstname")} />
                      {errors.firstname && <p className="error-message">{errors.firstname.message}</p>}
                    </div>
                  </div>

                  {/* username */}
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="username" className="block text-sm">Tên đăng nhập</Label>
                    <Input type="text" id="username" placeholder="connection" {...register("username")} />
                    {errors.username && <p className="error-message">{errors.username.message}</p>}
                  </div>

                  {/* email */}
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="email" className="block text-sm">Email</Label>
                    <Input type="email" id="email" placeholder="m@gmail.com" {...register("email")} />
                    {errors.email && <p className="error-message">{errors.email.message}</p>}
                  </div>

                  {/* password */}
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="password" className="block text-sm">Mật khẩu</Label>
                    <Input type="password" id="password" {...register("password")} />
                    {errors.password && <p className="error-message">{errors.password.message}</p>}
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleSendOtp}
                    disabled={otpLoading}
                  >
                    {otpLoading ? "Đang xử lý..." : "Tiếp theo"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-2 text-center mb-4">
                    <div className="text-sm font-medium text-primary">Bước 2: Xác thực Email</div>
                    <p className="text-xs text-muted-foreground">
                      Mã OTP đã được gửi đến <b>{emailValue}</b>. Vui lòng nhập mã để hoàn tất.
                    </p>
                  </div>

                  {/* OTP */}
                  <div className="flex flex-col gap-3">
                    <Label htmlFor="otp" className="block text-sm">Mã xác nhận (OTP)</Label>
                    <Input type="text" id="otp" placeholder="123456" {...register("otp")} />
                    {errors.otp && <p className="error-message">{errors.otp.message}</p>}

                    <div className="text-xs text-center text-muted-foreground mt-2">
                      {countdown > 0 ? (
                        <span>Gửi lại mã sau <b>{countdown}s</b></span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="text-primary hover:underline font-medium"
                        >
                          Gửi lại mã
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-4">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Đang đăng ký..." : "Xác nhận & Đăng ký"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-xs"
                      onClick={() => setOtpSent(false)}
                      disabled={isSubmitting}
                    >
                      Quay lại thay đổi thông tin
                    </Button>
                  </div>
                </>
              )}

              <div className="text-center text-sm">
                Đã có tài khoản?{" "}
                <a
                  href="/signin"
                  className="underline underline-offset-4"
                >
                  Đăng nhập
                </a>
              </div>
            </div>
          </form>
          <div className="bg-muted relative hidden md:block">
            <img
              src="/placeholderSignUp.png"
              alt="Image"
              className="absolute top-1/2 -translate-y-1/2 object-cover"
            />
          </div>
        </CardContent>
      </Card>
      <div className=" text-xs text-balance px-6 text-center *:[a]:hover:text-primary text-muted-foreground *:[a]:underline *:[a]:underline-offetset-4">
        Bằng cách tiếp tục, bạn đồng ý với <a href="#">Điều khoản dịch vụ</a> và{" "}
        <a href="#">Chính sách bảo mật</a> của chúng tôi.
      </div>
    </div>
  );
}
