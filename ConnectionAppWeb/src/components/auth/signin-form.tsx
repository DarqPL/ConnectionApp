import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "../ui/label";
import { useAuthStore } from "@/stores/useAuthStore";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { consumePostLoginRedirect } from "@/lib/authRedirect";

const LOCK_NOTICE_KEY = "auth_lock_notice";

const signInSchema = z.object({
  username: z.string().min(3, "Tên đăng nhập hoặc email phải có ít nhất 3 ký tự"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export function SigninForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { signIn } = useAuthStore();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
  });

  useEffect(() => {
    const lockNotice = sessionStorage.getItem(LOCK_NOTICE_KEY);
    if (!lockNotice) return;

    setError("root", { message: lockNotice });
    sessionStorage.removeItem(LOCK_NOTICE_KEY);
  }, [setError]);

  const onSubmit = async (data: SignInFormValues) => {
    const { username, password } = data;
    try {
      await signIn(username, password);
      navigate(consumePostLoginRedirect() || "/");
    } catch (error: any) {
      const code = error.response?.data?.code;
      const remainingMinutes = error.response?.data?.remainingMinutes;

      if (code === "ACCOUNT_MANUAL_LOCKED") {
        navigate("/unlock-account", { state: { usernameOrEmail: username } });
        return;
      }

      let message =
        error.response?.data?.message ||
        "Tên đăng nhập hoặc mật khẩu không chính xác";

      if (code === "ACCOUNT_TEMP_LOCKED" && Number(remainingMinutes) > 0) {
        message = `${message}. Còn ${remainingMinutes} phút để mở khóa.`;
      }

      setError("root", { message });
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 border-border/40 shadow-2xl bg-background/60 backdrop-blur-xl rounded-3xl">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-8 md:p-12" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <div className="mb-4">
                  <img src="/logo.svg" alt="logo" className="size-10" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Chào mừng trở lại
                </h1>
              </div>

              <div className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">
                    Tên đăng nhập hoặc Email
                  </Label>
                  <Input
                    type="text"
                    id="username"
                    placeholder="name@example.com"
                    className="h-12 bg-background/50 border-border/50 focus:ring-primary/20 transition-all rounded-xl placeholder:text-muted-foreground/50"
                    {...register("username")}
                  />
                  {errors.username && (
                    <p className="text-destructive text-xs ml-1 font-medium italic">{errors.username.message}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">
                      Mật khẩu
                    </Label>
                    <a href="/forgot-password" className="text-xs font-medium text-primary hover:underline underline-offset-4">
                      Quên mật khẩu?
                    </a>
                  </div>
                  <Input
                    type="password"
                    id="password"
                    placeholder="********"
                    className="h-12 bg-background/50 border-border/50 focus:ring-primary/20 transition-all rounded-xl placeholder:text-muted-foreground/50"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-destructive text-xs ml-1 font-medium italic">{errors.password.message}</p>
                  )}
                </div>

                {errors.root && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl text-center font-medium animate-in fade-in slide-in-from-top-1">
                    {errors.root.message}
                  </div>
                )}

                <Button
                  type="submit"
                  className="h-12 w-full font-bold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all rounded-xl mt-2 cursor-pointer bg-primary dark:text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang xử lý..." : "Đăng nhập ngay"}
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Chưa có tài khoản?{" "}
                <a href="/signup" className="font-bold text-primary hover:underline underline-offset-4">
                  Đăng ký miễn phí
                </a>
              </div>
            </div>
          </form>

          <div className="relative hidden md:flex items-center justify-center p-8 bg-muted/30 overflow-hidden">
            <div className="absolute inset-0 z-0">
              <img src="placeholder.png" alt="Illustration" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
