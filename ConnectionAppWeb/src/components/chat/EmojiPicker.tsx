import { useThemeStore } from "@/stores/useThemeStore";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Smile } from "lucide-react";
import EmojiPickerLib from "emoji-picker-react";
import { Theme } from "emoji-picker-react";

interface EmojiPickerProps {
  onChange: (value: string) => void;
}

const EmojiPicker = ({ onChange }: EmojiPickerProps) => {
  const { isDark } = useThemeStore();

  return (
    <Popover>
      <PopoverTrigger className="cursor-pointer">
        <Smile className="size-4" />
      </PopoverTrigger>

      <PopoverContent
        side="right"
        sideOffset={40}
        className="bg-transparent border-none shadow-none drop-shadow-none mb-12 w-auto p-0"
      >
        <EmojiPickerLib
          theme={isDark ? Theme.DARK : Theme.LIGHT}
          onEmojiClick={(emojiData) => onChange(emojiData.emoji)}
          autoFocusSearch={false}
          lazyLoadEmojis
        />
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
