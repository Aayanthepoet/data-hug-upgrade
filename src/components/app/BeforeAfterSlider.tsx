// Before/after compare slider with combined-image export.
// `before` is the original room photo (source_image_url). When absent, the
// slider degrades to a plain "after" preview and the export becomes a
// single-image download so the control surface stays consistent.
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface Props {
  before?: string | null;
  after: string;
  filename?: string;
}

export function BeforeAfterSlider({ before, after, filename = "vision-compare.png" }: Props) {
  const [pos, setPos] = useState(50);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const onDrag = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  };

  async function loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function exportCombined() {
    setExporting(true);
    try {
      const afterImg = await loadImg(after);
      const beforeImg = before ? await loadImg(before) : null;
      const h = afterImg.naturalHeight;
      const w = afterImg.naturalWidth;
      const canvas = document.createElement("canvas");
      canvas.width = beforeImg ? w * 2 + 16 : w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (beforeImg) {
        // Letterbox before-image into the after dimensions so the panels line up.
        const scale = Math.min(w / beforeImg.naturalWidth, h / beforeImg.naturalHeight);
        const bw = beforeImg.naturalWidth * scale;
        const bh = beforeImg.naturalHeight * scale;
        ctx.drawImage(beforeImg, (w - bw) / 2, (h - bh) / 2, bw, bh);
        ctx.drawImage(afterImg, w + 16, 0, w, h);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(16, h - 48, 120, 32);
        ctx.fillRect(w + 32, h - 48, 120, 32);
        ctx.fillStyle = "#fff";
        ctx.font = "20px sans-serif";
        ctx.fillText("BEFORE", 30, h - 26);
        ctx.fillText("AFTER", w + 46, h - 26);
      } else {
        ctx.drawImage(afterImg, 0, 0, w, h);
      }
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div
        ref={wrapRef}
        className="relative aspect-video bg-black/20 rounded overflow-hidden select-none touch-none"
        onMouseMove={(e) => e.buttons === 1 && onDrag(e.clientX)}
        onMouseDown={(e) => onDrag(e.clientX)}
        onTouchMove={(e) => onDrag(e.touches[0].clientX)}
      >
        <img src={after} alt="after" className="absolute inset-0 w-full h-full object-cover" />
        {before && (
          <>
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${pos}%` }}
            >
              <img
                src={before}
                alt="before"
                className="absolute inset-0 h-full object-cover"
                style={{ width: `${(100 / pos) * 100}%`, maxWidth: "none" }}
              />
            </div>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
              style={{ left: `${pos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-white shadow flex items-center justify-center text-[10px] text-black font-bold">
                ⇆
              </div>
            </div>
            <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-black/60 text-white px-1.5 py-0.5 rounded">
              Before
            </span>
            <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide bg-black/60 text-white px-1.5 py-0.5 rounded">
              After
            </span>
          </>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={exportCombined}
        disabled={exporting}
      >
        <Download className="h-3 w-3 mr-1" />
        {exporting ? "Exporting…" : before ? "Export before/after" : "Export image"}
      </Button>
    </div>
  );
}
