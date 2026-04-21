import { SigninForm } from '@/components/auth/signin-form'
const SignInPage = () => {
  return (
    <div className="relative min-h-svh flex items-center justify-center p-6 md:p-10 overflow-hidden bg-background">
      {/* Mesh Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animaite-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm md:max-w-4xl transition-all duration-700 ease-out animate-in fade-in zoom-in-95">
        <SigninForm />
      </div>
    </div>
  );
};

export default SignInPage
