import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Plus, Trash2, ListTodo } from "lucide-react";
import { useState } from "react";
import type { PollRequest } from "@/types/chat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

interface PollCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (poll: PollRequest) => void;
}

const PollCreator = ({ isOpen, onClose, onSave }: PollCreatorProps) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiChoice, setMultiChoice] = useState(false);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    if (!question.trim()) return;
    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) return;

    onSave({
      question: question.trim(),
      options: validOptions.map((text) => ({ text: text.trim() })),
      multiChoice,
      allowAddOptions: false,
      isAnonymous: false,
    });
    
    // Reset form
    setQuestion("");
    setOptions(["", ""]);
    setMultiChoice(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="size-5 text-primary" />
            Tạo cuộc bầu chọn
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Đặt câu hỏi</label>
            <Input
              placeholder="Ví dụ: Hôm nay ăn gì?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="focus-visible:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Các lựa chọn</label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2 group">
                  <Input
                    placeholder={`Lựa chọn ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[i] = e.target.value;
                      setOptions(newOpts);
                    }}
                    className="focus-visible:ring-primary"
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(i)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-primary hover:text-primary hover:bg-primary/5 border-dashed border-2 mt-2"
                onClick={addOption}
              >
                <Plus className="size-4 mr-2" /> Thêm lựa chọn
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2 pt-2">
             <input 
               type="checkbox" 
               id="multiChoice" 
               checked={multiChoice}
               onChange={(e) => setMultiChoice(e.target.checked)}
               className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
             />
             <label htmlFor="multiChoice" className="text-sm cursor-pointer select-none">
               Cho phép chọn nhiều phương án
             </label>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Hủy
          </Button>
          <Button
            onClick={handleSave}
            disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
            className="flex-1 bg-gradient-chat"
          >
            Tạo bầu chọn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PollCreator;
