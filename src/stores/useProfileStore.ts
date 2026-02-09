import type { ProfileState } from "@/types/store";
import { create } from "zustand";

export const useProfileStore = create<ProfileState>()((set) => ({
    isOpen: false,
    setIsOpen: (open: boolean) => set({ isOpen: open }),
}));
