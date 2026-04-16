import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Download, File, Image, Music, Video, Search } from "lucide-react";
import type { Message, Attachment } from "@/types/chat";
import { cn } from "@/lib/utils";

interface FilePanelProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}

interface FileWithMeta extends Attachment {
  messageId: string;
  createdAt: string;
}

const FileItem = ({
  file,
  onDownload,
}: {
  file: FileWithMeta;
  onDownload: (fileUrl: string, fileName?: string) => void;
}) => {
  const getFileIcon = (type: string) => {
    switch (type) {
      case "IMAGE":
        return <Image className="size-4" />;
      case "VIDEO":
        return <Video className="size-4" />;
      case "AUDIO":
        return <Music className="size-4" />;
      case "DOCUMENT":
        return <File className="size-4" />;
      default:
        return <File className="size-4" />;
    }
  };

  const fileName = file.originalFileName || "Tệp không tên";

  return (
    <div className="flex items-center justify-between p-3 hover:bg-accent rounded-lg transition-colors group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="text-muted-foreground shrink-0">
          {getFileIcon(file.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(file.createdAt).toLocaleDateString("vi-VN")}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDownload(file.fileUrl, file.originalFileName || "file")}
      >
        <Download className="size-4" />
      </Button>
    </div>
  );
};

interface FileCategorySectionProps {
  title: string;
  files: FileWithMeta[];
  onDownload: (fileUrl: string, fileName?: string) => void;
}

const FileCategorySection = ({ title, files, onDownload }: FileCategorySectionProps) => {
  if (files.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold px-3 py-2 text-muted-foreground">
        {title} ({files.length})
      </h3>
      <div className="space-y-1">
        {files.map((file, idx) => (
          <FileItem key={`${file.messageId}-${idx}`} file={file} onDownload={onDownload} />
        ))}
      </div>
    </div>
  );
};

const FilePanel = ({ messages, isOpen, onClose }: FilePanelProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Lọc tất cả các file từ các message
  const allFiles = useMemo(() => {
    const files: FileWithMeta[] = [];

    messages.forEach((msg) => {
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach((att) => {
          files.push({
            ...att,
            messageId: msg.id,
            createdAt: msg.createdAt,
          });
        });
      }
    });

    // Sắp xếp theo ngày mới nhất trước
    return files.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [messages]);

  // Lọc theo tìm kiếm
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return allFiles;

    const query = searchQuery.toLowerCase();
    return allFiles.filter(
      (f) =>
        f.originalFileName?.toLowerCase().includes(query) ||
        f.fileUrl.toLowerCase().includes(query)
    );
  }, [allFiles, searchQuery]);

  // Phân loại file
  const filesByType = useMemo(() => {
    const categories = {
      images: filteredFiles.filter((f) => f.type === "IMAGE"),
      videos: filteredFiles.filter((f) => f.type === "VIDEO"),
      audios: filteredFiles.filter((f) => f.type === "AUDIO"),
      documents: filteredFiles.filter((f) => f.type === "DOCUMENT"),
      others: filteredFiles.filter((f) => f.type === "FILE"),
    };
    return categories;
  }, [filteredFiles]);

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
        "fixed right-0 top-0 h-screen w-80 bg-background border-l border-border shadow-lg transition-transform duration-300 z-40 flex flex-col",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background">
        <h2 className="font-semibold">Tập tin</h2>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm tệp..."
            className="pl-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto border-t border-border">
        <div className="p-4">
          {allFiles.length === 0 ? (
            <div className="text-center py-8">
              <File className="size-12 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Chưa có tập tin nào
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Không tìm thấy tập tin
              </p>
            </div>
          ) : (
            <>
              <FileCategorySection
                title="Hình ảnh"
                files={filesByType.images}
                onDownload={handleDownload}
              />
              <FileCategorySection
                title="Video"
                files={filesByType.videos}
                onDownload={handleDownload}
              />
              <FileCategorySection
                title="Âm thanh"
                files={filesByType.audios}
                onDownload={handleDownload}
              />
              <FileCategorySection
                title="Tài liệu"
                files={filesByType.documents}
                onDownload={handleDownload}
              />
              <FileCategorySection
                title="Khác"
                files={filesByType.others}
                onDownload={handleDownload}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePanel;
