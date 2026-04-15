import { useUserStore } from "@/stores/useUserStore";
import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { Camera, Loader2 } from "lucide-react";

const AvatarUploader = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateAvatarUrl } = useUserStore();
  // const user = useUserStore((state) => state.user ?? null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      await updateAvatarUrl(formData);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <Button
        size="icon"
        variant="secondary"
        onClick={handleClick}
        disabled={isUploading}
        className="absolute -bottom-2 -right-2 size-9 rounded-full shadow-md hover:scale-115 transition duration-300 hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Camera className="size-4" />
        )}
      </Button>

      <input
        type="file"
        accept="image/*"
        hidden
        ref={fileInputRef}
        onChange={handleUpload}
        disabled={isUploading}
      />
    </>
  );
};

export default AvatarUploader;
