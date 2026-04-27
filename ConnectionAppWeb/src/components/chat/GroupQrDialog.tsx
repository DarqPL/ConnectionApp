import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent } from "../ui/dialog";
import { Download, X, ZoomIn, ZoomOut } from "lucide-react";

interface GroupQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string | null | undefined;
  qrValue: string | null;
}

const clampZoom = (value: number): number => Math.max(1, Math.min(4, value));

const sanitizeFileName = (value: string | null | undefined): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "group-qr";

const GroupQrDialog = ({
  open,
  onOpenChange,
  groupName,
  qrValue,
}: GroupQrDialogProps) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const normalizedGroupName = groupName?.trim() || "Nhom";

  useEffect(() => {
    if (!open || !qrValue) {
      setQrDataUrl(null);
      setZoom(1);
      return;
    }

    let cancelled = false;

    const generateQr = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(qrValue, {
          width: 1400,
          margin: 2,
        });

        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (error) {
        console.error("Failed to generate group QR", error);
        if (!cancelled) {
          setQrDataUrl(null);
        }
      }
    };

    void generateQr();

    return () => {
      cancelled = true;
    };
  }, [open, qrValue]);

  const fileName = useMemo(
    () => `${sanitizeFileName(normalizedGroupName)}-qr.png`,
    [normalizedGroupName],
  );

  const handleDownload = () => {
    if (!qrDataUrl) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-3xl border-none bg-transparent p-0 shadow-none"
      >
        <div className="relative pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute -right-4 -top-4 z-20 rounded-full border border-zinc-700 bg-black p-2 text-white hover:bg-zinc-900"
            title="Close"
          >
            <X className="size-4" />
          </button>

          <div className="relative overflow-hidden rounded-lg border-4 border-black bg-black">
            <div className="flex h-[72vh] flex-col items-center justify-center gap-3 overflow-hidden bg-zinc-900 px-6 py-6 text-white">
              <p className="text-lg font-semibold">{normalizedGroupName}</p>
              <p className="max-w-xl text-center text-xs text-zinc-400 break-all">
                {qrValue}
              </p>

              <div className="flex flex-1 items-center justify-center overflow-hidden">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR ${normalizedGroupName}`}
                    className="max-h-[55vh] max-w-[55vh] rounded-2xl bg-white p-3"
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "center center",
                      transition: "transform 140ms ease-out",
                    }}
                  />
                ) : (
                  <p className="text-sm text-zinc-300">Khong tao duoc ma QR</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 border-t border-zinc-700 bg-black/90 px-3 pb-3 pt-2 text-white">
              <button
                type="button"
                onClick={() => setZoom((prev) => clampZoom(prev - 0.25))}
                className="rounded-full bg-zinc-900 p-2 hover:bg-zinc-800"
                title="Zoom out"
              >
                <ZoomOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((prev) => clampZoom(prev + 0.25))}
                className="rounded-full bg-zinc-900 p-2 hover:bg-zinc-800"
                title="Zoom in"
              >
                <ZoomIn className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!qrDataUrl}
                className="rounded-full bg-zinc-900 p-2 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                title="Download"
              >
                <Download className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupQrDialog;
