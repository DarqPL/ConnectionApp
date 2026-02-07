import { create } from "zustand";
import { toast } from "sonner";
import type { AuthState } from "@/types/store";
import { authService } from "@/services/authServices";

export const useAuthStore = create<AuthState>((set,get) => ({
  accessToken: null,
  user: null,
  loading: false,
  clearState:()=>{
    set({accessToken:null,user:null,loading:false})
  },

  signUp: async (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string
  ) => {
    try {
      set({ loading: true });

      await authService.signUp(
        username,
        password,
        email,
        firstName,
        lastName,
      );

      toast.success(
        "Đăng ký thành công! Bạn sẽ được chuyển sang trang đăng nhập."
      );
    } catch (error) {
        console.error(error)
      toast.error(
       "Đăng ký không thành công"
      );
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (username, password) => {
        try {
         
          set({ loading: true });

          const { accessToken } = await authService.signIn(username, password);
         

          

          toast.success("Chào mừng bạn quay lại với Connection");
        } catch (error) {
          console.error(error);
          toast.error("Đăng nhập không thành công!");
        } finally {
          set({ loading: false });
        }
      },
   signOut: async () => {
        try {
          get().clearState();
          await authService.signOut();
          toast.success("Logout thành công!");
        } catch (error) {
          console.error(error);
          toast.error("Lỗi xảy ra khi logout. Hãy thử lại!");
        }
      },





}));
