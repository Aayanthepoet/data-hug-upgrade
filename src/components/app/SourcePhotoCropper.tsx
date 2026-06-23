import { useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Crop as CropIcon, Upload as UploadIcon } from "lucide-react";

type AspectKey = "free" | "1:1" | "4:3" | "3:2" | "16:9";
const ASPECTS: Record<AspectKey, number | undefined> = {
  free: undefined,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "16:9": 16 / 9,
};

type Props = {
  /** The file the user picked; the dialog is open while non-null. */
  file: File | null;
  onCancel: () => void;
  /** Upload the original file untouched. */
  onUseOriginal: (file: File) => void;
  /** Upload a new File generated from the chosen crop + scale. */
  onConfirmCrop: (file: File) => void;
};

/**
 * Optional crop / resize step. We render the chosen file in an interactive
 * ReactCrop canvas, let the user pick an aspect (or free-form), choose a
 * max-edge resize, and emit a fresh JPEG/PNG File back to the parent. The
 * parent owns validation and upload — this component only produces a Blob.
 */
export function SourcePhotoCropper({ file, onCancel, onUseOriginal, onConfirmCrop }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [aspect, setAspect] = useState<AspectKey>("free");
  const [maxEdge, setMaxEdge] = useState<number>(2048);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Generate a blob URL for the picked file when the dialog opens, and
  // revoke it on close/swap so we don't leak memory across selections.
  useEffect(() => {
    if (!file) {
      setSrc(null);
      setCrop(undefined);
      setCompletedCrop(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // When aspect changes, reset the visible crop to a centered selection at
  // the new ratio so the box stays valid.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src) return;
    const ratio = ASPECTS[aspect];
    if (!ratio) {
      // Free crop: start with a 90% center box.
      setCrop({ unit: "%", x: 5, y: 5, width: 90, height: 90 });
      return;
    }
    const initial = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, ratio, img.width, img.height),
      img.width,
      img.height,
    );
    setCrop(initial);
  }, [aspect, src]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    imgRef.current = e.currentTarget;
    // Initial crop = full image, free aspect.
    setCrop({ unit: "%", x: 5, y: 5, width: 90, height: 90 });
  }

  async function buildCroppedFile(): Promise<File | null> {
    const img = imgRef.current;
    if (!img || !completedCrop || !file) return null;
    // Map the rendered crop (CSS px) back to natural image pixels.
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const sx = completedCrop.x * scaleX;
    const sy = completedCrop.y * scaleY;
    const sw = completedCrop.width * scaleX;
    const sh = completedCrop.height * scaleY;
    if (sw <= 0 || sh <= 0) return null;

    // Resize so the longest edge matches maxEdge (don't upscale).
    const longest = Math.max(sw, sh);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

    // Preserve PNG/WebP for transparency-friendly formats; otherwise emit
    // JPEG at a high quality to keep the file small.
    const sourceType = file.type.toLowerCase();
    const outType =
      sourceType === "image/png" || sourceType === "image/webp" ? sourceType : "image/jpeg";
    const ext = outType === "image/png" ? "png" : outType === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "");

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), outType, 0.92),
    );
    if (!blob) return null;
    return new File([blob], `${baseName}-cropped.${ext}`, { type: outType });
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      const cropped = await buildCroppedFile();
      if (cropped) {
        onConfirmCrop(cropped);
      } else if (file) {
        // If we couldn't build a crop (no selection drawn), upload original.
        onUseOriginal(file);
      }
    } finally {
      setBusy(false);
    }
  }

  const open = !!file;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-4 w-4" /> Crop &amp; resize source photo
          </DialogTitle>
          <DialogDescription>
            Pick the exact area to use as the "before" frame, or skip to upload the original.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-[var(--w55)]">Aspect ratio</label>
              <Select value={aspect} onValueChange={(v) => setAspect(v as AspectKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="1:1">Square (1:1)</SelectItem>
                  <SelectItem value="4:3">Standard (4:3)</SelectItem>
                  <SelectItem value="3:2">Photo (3:2)</SelectItem>
                  <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--w55)] flex justify-between">
                <span>Max edge</span>
                <span>{maxEdge}px</span>
              </label>
              <Slider
                value={[maxEdge]}
                onValueChange={(v) => setMaxEdge(v[0] ?? 2048)}
                min={512}
                max={4096}
                step={128}
              />
            </div>
          </div>

          <div className="flex items-center justify-center bg-black/30 rounded border border-white/10 p-2 min-h-[260px] max-h-[60vh] overflow-auto">
            {src ? (
              <ReactCrop
                crop={crop}
                onChange={(_, percent) => setCrop(percent)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECTS[aspect]}
                keepSelection
              >
                <img
                  ref={imgRef}
                  src={src}
                  onLoad={onImageLoad}
                  alt="Photo to crop"
                  className="max-h-[55vh] w-auto"
                />
              </ReactCrop>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant="outline"
            onClick={() => file && onUseOriginal(file)}
            disabled={busy || !file}
            className="flex items-center gap-1"
          >
            <UploadIcon className="h-3 w-3" /> Skip — use original
          </Button>
          <Button onClick={handleConfirm} disabled={busy || !completedCrop} className="flex items-center gap-1">
            <CropIcon className="h-3 w-3" /> {busy ? "Preparing…" : "Crop & upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
