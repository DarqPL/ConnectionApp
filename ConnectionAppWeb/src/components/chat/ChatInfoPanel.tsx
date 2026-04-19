import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  X, Download, File, UserPlus, Settings, BellOff, Pin,
  ChevronDown, ChevronRight, Users, Pencil,
  Calendar, StickyNote, Image as ImageIcon, Plus, History, LogOut, Trash2
} from "lucide-react";
import type { Message, Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";
import GroupChatAvatar from "./GroupChatAvatar";
import "yet-another-react-lightbox/styles.css";
import Lightbox from "yet-another-react-lightbox";

interface ChatInfoPanelProps {
  chat: Conversation;
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}

const SectionHeader = ({
  title,
  isOpen,
  onToggle,
  count
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  count?: number;
}) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors border-t border-border/40"
  >
    <div className="flex items-center gap-2">
      <span className="font-semibold text-sm">
        {title} {count !== undefined && <span className="text-muted-foreground font-normal">({count})</span>}
      </span>
    </div>
    {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
  </button>
);

const ChatInfoPanel = ({ chat, messages, isOpen, onClose }: ChatInfoPanelProps) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    members: true,
    board: true,
    media: true,
    files: true,
  });
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [showAllImages, setShowAllImages] = useState(false);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const allMedia = useMemo(() => {
    const media: { src: string; width: number; height: number; type: "image" }[] = [];
    messages.forEach(msg => {
      msg.attachments.forEach(att => {
        if (att.type === "IMAGE") {
          media.push({ src: att.fileUrl, width: 800, height: 600, type: "image" });
        } else if (att.type === "VIDEO") {
          // PhotoAlbum handles images better, videos might just show a placeholder or we use a custom renderer
          media.push({ src: att.fileUrl, width: 800, height: 600, type: "image" });
        }
      });
    });
    return media;
  }, [messages]);

  const allFiles = useMemo(() => {
    const files: Array<typeof messages[0]["attachments"][0] & { createdAt: string }> = [];
    messages.forEach(msg => {
      msg.attachments.forEach(att => {
        if (att.type !== "IMAGE" && att.type !== "VIDEO") {
          files.push({ ...att, createdAt: msg.createdAt });
        }
      });
    });
    return files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages]);

  const handleDownload = (fileUrl: string, fileName?: string) => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName || "file";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={cn(
        "h-full bg-background border-l border-border transition-all duration-300 flex flex-col overflow-hidden",
        isOpen ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none border-none"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background z-10">
        <h2 className="font-bold text-lg">Thông tin hội thoại</h2>
        <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto beautiful-scrollbar">
        {/* Profile Card */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            {chat.type === "PRIVATE" ? (
              <UserAvatar
                type="profile"
                name={chat.name}
                avatarUrl={chat.avatarUrl || undefined}
                className="size-20 text-2xl border-2 border-primary/20"
              />
            ) : (
              <GroupChatAvatar
                participants={chat.participants}
                type="sidebar"
              />
            )}
            <button className="absolute bottom-0 right-0 p-1 bg-background border border-border rounded-full shadow-sm hover:bg-accent transition-colors">
              <Pencil className="size-3" />
            </button>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-xl flex items-center justify-center gap-2">
              {chat.name}
              <Button variant="ghost" size="icon" className="size-5 rounded-full">
                <Pencil className="size-3 text-muted-foreground" />
              </Button>
            </h3>
          </div>

          <div className="grid grid-cols-4 gap-4 w-full pt-2">
            {[
              { icon: BellOff, label: "Tắt thông báo" },
              { icon: Pin, label: "Ghim hội thoại" },
              { icon: UserPlus, label: "Thêm thành viên" },
              { icon: Settings, label: "Quản lý" },
            ].map((action, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 cursor-pointer group">
                <button className="size-10 rounded-full bg-secondary/50 flex items-center justify-center text-secondary-foreground group-hover:bg-secondary transition-colors">
                  <action.icon className="size-5" />
                </button>
                <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">
                  {action.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Members Section */}
        <SectionHeader
          title="Thành viên nhóm"
          count={chat.participants.length}
          isOpen={openSections.members}
          onToggle={() => toggleSection("members")}
        />
        {openSections.members && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Users className="size-4" />
              </div>
              <span className="text-sm font-medium">{chat.participants.length} thành viên</span>
            </div>
            {chat.participants.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group">
                <UserAvatar type="chat" name={p.displayName} avatarUrl={p.avatarUrl || undefined} className="size-8" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.displayName}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{p.role}</p>
                </div>
              </div>
            ))}
            {chat.participants.length > 3 && (
              <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:bg-accent/50">
                Xem tất cả
              </Button>
            )}
          </div>
        )}

        {/* Board Section */}
        <SectionHeader
          title="Bảng tin nhóm"
          isOpen={openSections.board}
          onToggle={() => toggleSection("board")}
        />
        {openSections.board && (
          <div className="px-4 pb-4 space-y-1">
            {[
              { icon: Calendar, label: "Danh sách nhắc hẹn" },
              { icon: StickyNote, label: "Ghi chú, ghim, bình chọn" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group">
                <item.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Media Section */}
        <SectionHeader
          title="Ảnh/Video"
          count={allMedia.length}
          isOpen={openSections.media}
          onToggle={() => toggleSection("media")}
        />
        {openSections.media && (
          <div className="px-4 pb-4 space-y-3">
            {allMedia.length > 0 ? (
              <>
                {/* Image Grid */}
                <div className="rounded-xl overflow-hidden border border-border/40 bg-secondary/20">
                  <div className="grid grid-cols-4 gap-1 p-1">
                    {allMedia.slice(0, showAllImages ? allMedia.length : 8).map((photo, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                        onClick={() => setLightboxIndex(idx)}
                      >
                        <img
                          src={photo.src}
                          alt={`media-${idx}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ImageIcon className="size-5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* View All Button */}
                {allMedia.length > 8 && (
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs font-semibold"
                    onClick={() => setShowAllImages(!showAllImages)}
                  >
                    {showAllImages ? "Thu gọn" : `Xem tất cả (${allMedia.length})`}
                  </Button>
                )}

                {/* Lightbox */}
                <Lightbox
                  index={lightboxIndex}
                  open={lightboxIndex >= 0}
                  close={() => setLightboxIndex(-1)}
                  slides={allMedia}
                />
              </>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <ImageIcon className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs italic">Chưa có ảnh/video nào</p>
              </div>
            )}
          </div>
        )}

        {/* Files Section */}
        <SectionHeader
          title="File"
          count={allFiles.length}
          isOpen={openSections.files}
          onToggle={() => toggleSection("files")}
        />
        {openSections.files && (
          <div className="px-4 pb-4 space-y-2">
            {allFiles.length > 0 ? (
              <>
                {allFiles.slice(0, 3).map((file, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-all group cursor-pointer" onClick={() => handleDownload(file.fileUrl, file.originalFileName || undefined)}>
                    <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <File className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={file.originalFileName || undefined}>
                        {file.originalFileName}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {new Date(file.createdAt).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Download className="size-4" />
                    </Button>
                  </div>
                ))}
                {allFiles.length > 3 && (
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:bg-accent/50 underline-offset-4 hover:underline">
                    Xem tất cả
                  </Button>
                )}
              </>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <p className="text-xs italic">Chưa có file nào</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons - Vertical at Bottom */}
      <div className="px-4 py-4 border-t border-border/40 space-y-2 bg-background">
        <Button
          variant="secondary"
          size="sm"
          className="w-full h-9 text-xs text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4 mr-2" />
          Xóa lịch sử cuộc trò chuyện
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-full h-9 text-xs"
        >
          <LogOut className="size-4 mr-2" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );
};

export default ChatInfoPanel;
