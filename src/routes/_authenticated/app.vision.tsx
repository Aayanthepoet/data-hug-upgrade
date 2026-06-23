import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Trash2, Link2, Upload, X, Loader2, AlertCircle, RefreshCw, Images, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BeforeAfterSlider } from "@/components/app/BeforeAfterSlider";
import { SourcePhotoCropper } from "@/components/app/SourcePhotoCropper";
import {
  generateRedesign,
  listRenders,
  deleteRender,
  linkRenderToProperty,
  listPropertiesForRender,
  getVisionCapabilities,
  uploadSourcePhoto,
  deleteSourcePhoto,
  getSourcePhoto,
} from "@/lib/vision/vision.functions";

const visionSearchSchema = z.object({
  property: fallback(z.string().uuid().optional(), undefined),
  sourcePhotoId: fallback(z.string().uuid().optional(), undefined),
});


export const Route = createFileRoute("/_authenticated/app/vision")({
  validateSearch: zodValidator(visionSearchSchema),
  head: () => ({ meta: [{ title: "Vision Studio — PropAI" }] }),
  component: VisionPage,
});

function VisionPage() {
  const qc = useQueryClient();
  const generateFn = useServerFn(generateRedesign);
  const listFn = useServerFn(listRenders);
  const deleteFn = useServerFn(deleteRender);
  const linkFn = useServerFn(linkRenderToProperty);
  const propsFn = useServerFn(listPropertiesForRender);
  const capsFn = useServerFn(getVisionCapabilities);
  const uploadFn = useServerFn(uploadSourcePhoto);
  const deleteSourceFn = useServerFn(deleteSourcePhoto);

  // Source photo (the "before"): uploaded to the private vision-renders
  // bucket; we keep the storage path for the render row and a signed URL
  // for the local preview while composing.
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [sourcePhotoId, setSourcePhotoId] = useState<string | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [removingSource, setRemovingSource] = useState(false);
  const [isDeleteSourceDialogOpen, setIsDeleteSourceDialogOpen] = useState(false);
  const [renderIdToDelete, setRenderIdToDelete] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // The server fn is a single request, so we can't observe true upload
  // bytes-sent. Instead we drive a two-phase bar: real progress during
  // base64 encoding (we own the loop), then a creeping estimate during the
  // network round-trip that snaps to 100 on success.
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "encoding" | "sending" | "done">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // HEIC can't be decoded in <img> in most browsers, so we skip the crop step
  // for those formats and upload directly. Everything else opens the cropper.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  // Validation contract for the source photo. Keep these constants in sync
  // with the server validator in `uploadSourcePhoto`; the server is the
  // source of truth but we pre-check on the client so users get an instant
  // explanation instead of waiting for a round-trip rejection.
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
  const ALLOWED_LABEL = "JPG, PNG, WebP, or HEIC";
  const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
  const MIN_BYTES = 1024; // 1 KB — reject empty / 0-byte uploads
  const ACCEPT_ATTR = ALLOWED_TYPES.join(",");

  function formatMB(bytes: number) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function validateFile(file: File): { ok: true } | { ok: false } {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const looksLikeAllowed =
      (file.type && ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) ||
      ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext);
    if (!looksLikeAllowed) {
      toast.error("Unsupported file type", {
        description: `Please upload a ${ALLOWED_LABEL} image. Got "${file.type || ext || "unknown"}".`,
      });
      return { ok: false };
    }
    if (file.size < MIN_BYTES) {
      toast.error("File looks empty", {
        description: "The selected image is under 1 KB. Try another file.",
      });
      return { ok: false };
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large", {
        description: `Max ${formatMB(MAX_BYTES)} — your file is ${formatMB(file.size)}.`,
      });
      return { ok: false };
    }
    return { ok: true };
  }

  /**
   * Entry point for picked/dropped files. Validates, then opens the optional
   * crop dialog. HEIC/HEIF can't render in a browser <img>, so we skip the
   * cropper and upload directly. Retry from the error banner also lands here.
   */
  function onSourceFile(file: File) {
    if (!validateFile(file).ok) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isHeic =
      file.type === "image/heic" || file.type === "image/heif" || ext === "heic" || ext === "heif";
    if (isHeic) {
      void uploadFile(file);
      return;
    }
    setPendingFile(file);
  }

  type UploadMeta = {
    originalFilename?: string;
    originalByteSize?: number;
    wasCropped?: boolean;
    cropAspect?: string;
    cropMaxEdge?: number;
  };

  async function uploadFile(file: File, meta: UploadMeta = {}) {
    // Re-validate (cropped file size may differ from the original).
    if (!validateFile(file).ok) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (sourcePreview && sourcePreview.startsWith("blob:")) {
      URL.revokeObjectURL(sourcePreview);
    }
    const localPreviewUrl = URL.createObjectURL(file);
    setSourcePreview(localPreviewUrl);

    setUploadingFile(file);
    setUploading(true);
    setUploadPhase("encoding");
    setUploadProgress(0);
    setUploadError(null);
    setFailedFile(null);
    let creepTimer: ReturnType<typeof setInterval> | null = null;
    try {
      const buf = await file.arrayBuffer();
      // Chunked btoa avoids "Maximum call stack" on large images. We also
      // yield to the event loop every chunk so the progress bar paints.
      let bin = "";
      const bytes = new Uint8Array(buf);
      const total = bytes.length;
      for (let i = 0; i < total; i += 0x8000) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
        // Encoding owns 0 → 60% of the bar.
        setUploadProgress(Math.min(60, Math.round(((i + 0x8000) / total) * 60)));
        await new Promise((r) => setTimeout(r, 0));
      }
      const base64 = btoa(bin);

      // Network phase: creep from 60 → 90 while the RPC is in flight.
      setUploadPhase("sending");
      setUploadProgress(60);
      creepTimer = setInterval(() => {
        setUploadProgress((p) => (p < 90 ? p + 2 : p));
      }, 150);

      const res = await uploadFn({
        data: {
          filename: file.name,
          contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
          base64,
          originalFilename: meta.originalFilename ?? null,
          originalByteSize: meta.originalByteSize ?? null,
          wasCropped: meta.wasCropped ?? false,
          cropAspect: meta.cropAspect ?? null,
          cropMaxEdge: meta.cropMaxEdge ?? null,
        },
      });
      if (creepTimer) clearInterval(creepTimer);
      setUploadProgress(100);
      setUploadPhase("done");
      setSourcePath(res.path);
      setSourcePhotoId(res.id);
      setSourcePreview(res.signed_url);
      setUploadError(null);
      setFailedFile(null);
      toast.success("Source photo uploaded", { description: file.name });
    } catch (e) {
      if (creepTimer) clearInterval(creepTimer);
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error("Couldn't upload that photo", { description: msg });
      setUploadProgress(0);
      setUploadPhase("idle");
      setUploadError(msg);
      setFailedFile(file);
    } finally {
      setUploading(false);
      // Let the "done" 100% frame paint briefly, then reset.
      setTimeout(() => {
        setUploadProgress(0);
        setUploadPhase("idle");
        setUploadingFile(null);
      }, 600);
    }
  }

  /**
   * Remove the current source photo with an undo window. We hide the photo
   * from the UI immediately and snapshot the state; the actual server delete
   * is deferred ~6s so the toast's "Undo" button can restore it. If the user
   * undoes, we cancel the pending server call and put the snapshot back.
   */
  function removeSourcePhoto() {
    const snapshot = {
      id: sourcePhotoId,
      path: sourcePath,
      preview: sourcePreview,
    };

    // Locally hide the photo right away so the UI reflects the intent.
    setSourcePath(null);
    setSourcePhotoId(null);
    setSourcePreview(null);

    // If there was never a server-side row, nothing to defer or undo.
    if (!snapshot.id) {
      if (snapshot.preview && snapshot.preview.startsWith("blob:")) {
        URL.revokeObjectURL(snapshot.preview);
      }
      return;
    }

    let undone = false;
    const UNDO_MS = 6000;
    const timer = setTimeout(async () => {
      if (undone) return;
      setRemovingSource(true);
      try {
        await deleteSourceFn({ data: { id: snapshot.id! } });
      } catch (e) {
        // The undo window already closed, so restoring the UI now would be
        // misleading. Surface the error and keep the photo hidden.
        toast.error("Couldn't remove photo", {
          description: e instanceof Error ? e.message : "Delete failed",
        });
      } finally {
        setRemovingSource(false);
      }
    }, UNDO_MS);

    toast.success("Source photo removed", {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          setSourcePath(snapshot.path);
          setSourcePhotoId(snapshot.id);
          setSourcePreview(snapshot.preview);
          toast.success("Restore complete");
        },
      },
    });
  }

  /**
   * Replace the current source photo: deletes the existing one (best-effort)
   * and then runs the standard upload flow (which may open the cropper).
   */
  async function replaceSourcePhoto(file: File) {
    const id = sourcePhotoId;
    if (id) {
      try {
        await deleteSourceFn({ data: { id } });
      } catch (e) {
        // Don't block the replace — surface the issue but keep going.
        toast.error("Couldn't delete the previous photo", {
          description: e instanceof Error ? e.message : "Delete failed",
        });
      }
      setSourcePhotoId(null);
      setSourcePath(null);
    }
    onSourceFile(file);
  }

  const [prompt, setPrompt] = useState(
    "Living room with hardwood floors, large windows, neutral walls — propose a redesign that maximizes resale appeal",
  );
  const [style, setStyle] = useState<"modern" | "scandinavian" | "industrial" | "farmhouse" | "mid-century" | "coastal">("modern");
  const [resolution, setResolution] = useState<"hd" | "2k" | "4k">("hd");
  // Auto-link: when navigated from a property page (?property=<uuid>) we
  // prefill the selector so the next render is attached without extra clicks.
  const { property: prefillProperty, sourcePhotoId: prefillSourcePhotoId } = Route.useSearch();
  const [propertyId, setPropertyId] = useState<string>(prefillProperty ?? "none");
  useEffect(() => {
    if (prefillProperty) setPropertyId(prefillProperty);
  }, [prefillProperty]);

  // Reuse from library: when ?sourcePhotoId=<uuid> is present we fetch the
  // existing photo's signed URL and storage path, then set it as the active
  // "before" image without re-uploading or re-running the cropper. Effect
  // guards against re-triggering once the photo is already loaded.
  const getSourcePhotoFn = useServerFn(getSourcePhoto);
  useEffect(() => {
    if (!prefillSourcePhotoId) return;
    if (sourcePhotoId === prefillSourcePhotoId) return;
    let cancelled = false;
    (async () => {
      try {
        const photo = await getSourcePhotoFn({ data: { id: prefillSourcePhotoId } });
        if (cancelled) return;
        if (sourcePreview && sourcePreview.startsWith("blob:")) {
          URL.revokeObjectURL(sourcePreview);
        }
        setSourcePhotoId(photo.id);
        setSourcePath(photo.storage_path);
        setSourcePreview(photo.signed_url);
        toast.success("Loaded from library", { description: photo.filename });
      } catch (e) {
        if (cancelled) return;
        toast.error("Couldn't load that photo", {
          description: e instanceof Error ? e.message : "Load failed",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillSourcePhotoId]);


  const { data: renders = [] } = useQuery({
    queryKey: ["vision-renders"],
    queryFn: () => listFn({ data: {} }),
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["vision-properties"],
    queryFn: () => propsFn(),
  });
  const { data: caps } = useQuery({
    queryKey: ["vision-capabilities"],
    queryFn: () => capsFn(),
  });
  const supported = caps?.supportedResolutions ?? ["hd", "2k", "4k"];
  const resolutionSupported = supported.includes(resolution);

  const generate = useMutation({
    mutationFn: () =>
      generateFn({
        data: {
          prompt,
          style,
          resolution,
          property_id: propertyId === "none" ? null : propertyId,
          source_image_url: sourcePath,
        },
      }),
    onSuccess: () => {
      toast.success("Redesign rendered");
      if (sourcePreview && sourcePreview.startsWith("blob:")) {
        URL.revokeObjectURL(sourcePreview);
      }
      setSourcePath(null);
      setSourcePhotoId(null);
      setSourcePreview(null);
      qc.invalidateQueries({ queryKey: ["vision-renders"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Render failed"),
  });

  // Soft-hidden renders during the undo window. We optimistically filter
  // these from the list and only call the server delete after the timeout
  // fires without an undo click.
  const [hiddenRenderIds, setHiddenRenderIds] = useState<Set<string>>(new Set());

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vision-renders"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  function softDeleteRender(id: string) {
    setHiddenRenderIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    let undone = false;
    const UNDO_MS = 6000;
    const timer = setTimeout(() => {
      if (undone) return;
      remove.mutate(id, {
        onSettled: () => {
          setHiddenRenderIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      });
    }, UNDO_MS);

    toast.success("Render deleted", {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          setHiddenRenderIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          toast.success("Restore complete");
        },
      },
    });
  }

  const link = useMutation({
    mutationFn: ({ id, property_id }: { id: string; property_id: string | null }) =>
      linkFn({ data: { id, property_id } }),
    onSuccess: () => {
      toast.success("Linked");
      qc.invalidateQueries({ queryKey: ["vision-renders"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Link failed"),
  });

  // Re-run a previous render with the same prompt, style, and source photo.
  // Resolution isn't persisted on the row, so we use the current selector
  // value (the only resolution the user has actively chosen for this session).
  const regenerate = useMutation({
    mutationFn: (r: { prompt: string; style: string | null; source_image_url: string | null; property_id: string | null }) =>
      generateFn({
        data: {
          prompt: r.prompt,
          style: (r.style ?? "modern") as typeof style,
          resolution,
          property_id: r.property_id,
          source_image_url: r.source_image_url,
        },
      }),
    onSuccess: () => {
      toast.success("Regenerated");
      qc.invalidateQueries({ queryKey: ["vision-renders"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Regenerate failed"),
  });


  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow inline-flex"><span className="eyebrow-dot" />Vision Studio · redesign · history</div>
          <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-4">
            Property <span className="h-italic">redesign</span>
          </h1>
          <p className="text-[var(--w55)] mt-3 max-w-xl">
            Generate redesign concepts for distressed rooms to show sellers the after-state.
            Renders are saved to your library with status, prompt, and property linkage.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/app/vision/library">
            <Images className="h-3.5 w-3.5 mr-1.5" />
            Source photo library
          </Link>
        </Button>
      </div>


      <div className="surface p-6 space-y-3">
        <div>
          <label className="text-xs text-[var(--w55)]">Describe the room</label>
          <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading && !sourcePreview) {
              setIsDragging(true);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (!uploading && !sourcePreview) {
              const file = e.dataTransfer.files?.[0];
              if (file) {
                onSourceFile(file);
              }
            }
          }}
          className={`space-y-1.5 p-3 rounded-lg border transition-all duration-200 ${
            isDragging
              ? "border-primary bg-primary/5 shadow-[0_0_12px_rgba(59,130,246,0.1)]"
              : "border-transparent bg-transparent"
          }`}
        >
          <label className="text-xs text-[var(--w55)]">Source photo (optional — becomes the "before")</label>
          <div className="flex flex-wrap items-center gap-3">
            {sourcePreview && !uploadError ? (
              <div className="flex items-center gap-3">
                <div className="relative h-20 w-28 rounded overflow-hidden border border-white/10 shrink-0">
                  <img src={sourcePreview} alt="source" className={`h-full w-full object-cover transition-opacity duration-200 ${uploading || removingSource ? "opacity-40" : ""}`} />
                  {uploading || removingSource ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsDeleteSourceDialogOpen(true)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors"
                      aria-label="Remove source photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {!uploading && !removingSource && (
                  <div className="flex flex-col gap-1.5">
                    <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded border border-white/15 text-[11px] text-[var(--w55)] hover:bg-white/5 transition-colors">
                      <RefreshCw className="h-3 w-3" />
                      Replace
                      <input
                        type="file"
                        accept={ACCEPT_ATTR}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void replaceSourcePhoto(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsDeleteSourceDialogOpen(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-500/20 text-[11px] text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ) : uploadError && failedFile ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded border border-red-500/30 bg-red-500/5 text-xs text-red-200 w-full max-w-xl">
                {sourcePreview && (
                  <div className="relative h-14 w-20 rounded overflow-hidden border border-red-500/20 shrink-0">
                    <img src={sourcePreview} alt="failed upload preview" className="h-full w-full object-cover opacity-70" />
                  </div>
                )}
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-semibold text-red-300 truncate">Upload failed</p>
                    <p className="text-[var(--w55)] truncate text-[11px]">{failedFile.name}</p>
                    <p className="text-red-400/90 text-[11px] line-clamp-2">{uploadError}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-red-500/30 hover:bg-red-500/10 text-red-200 hover:text-red-100 flex items-center gap-1"
                    onClick={() => void uploadFile(failedFile)}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[var(--w55)] hover:text-white flex items-center gap-1"
                    onClick={() => {
                      if (sourcePreview && sourcePreview.startsWith("blob:")) {
                        URL.revokeObjectURL(sourcePreview);
                      }
                      setUploadError(null);
                      setFailedFile(null);
                      setSourcePreview(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <label
                className={`cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded border border-dashed text-xs transition-colors duration-150 ${
                  isDragging
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-white/15 text-[var(--w55)] hover:bg-white/5"
                } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {uploading ? "Uploading…" : isDragging ? "Drop your photo here" : "Upload room photo"}
                <input
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onSourceFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {!uploadError && !sourcePreview && (
              <p className={`text-xs transition-colors duration-150 ${isDragging ? "text-primary/90 font-medium animate-pulse" : "text-[var(--w55)]"}`}>
                {isDragging ? "Release to upload!" : `${ALLOWED_LABEL} · up to ${formatMB(MAX_BYTES)}. Used as the "before" frame in the compare slider and exports.`}
              </p>
            )}
          </div>
          {uploading || uploadPhase === "done" ? (
            <div
              className={`mt-3 p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                uploadPhase === "done"
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-primary/30 bg-primary/5"
              }`}
              aria-live="polite"
              role="status"
            >
              <Loader2
                className={`h-4 w-4 shrink-0 ${
                  uploadPhase === "done" ? "text-green-400" : "text-primary animate-spin"
                }`}
              />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className={uploadPhase === "done" ? "text-green-300" : "text-primary/90"}>
                    {uploadPhase === "encoding" && "Preparing image…"}
                    {uploadPhase === "sending" && "Uploading to library…"}
                    {uploadPhase === "done" && "Upload complete"}
                  </span>
                  <span className="text-[var(--w55)] tabular-nums">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
                {uploadingFile && (
                  <p className="text-[10px] text-[var(--w55)] truncate">
                    {uploadingFile.name} · {formatMB(uploadingFile.size)}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs text-[var(--w55)]">Style</label>
            <Select value={style} onValueChange={(v) => setStyle(v as typeof style)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="scandinavian">Scandinavian</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
                <SelectItem value="farmhouse">Farmhouse</SelectItem>
                <SelectItem value="mid-century">Mid-century</SelectItem>
                <SelectItem value="coastal">Coastal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-[var(--w55)]">Resolution</label>
            <Select value={resolution} onValueChange={(v) => setResolution(v as typeof resolution)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hd" disabled={!supported.includes("hd")}>
                  HD · 1024 × 1024{!supported.includes("hd") && " — unavailable"}
                </SelectItem>
                <SelectItem value="2k" disabled={!supported.includes("2k")}>
                  2K · 2048 × 2048{!supported.includes("2k") && " — unavailable"}
                </SelectItem>
                <SelectItem value="4k" disabled={!supported.includes("4k")}>
                  4K · 4096 × 4096{!supported.includes("4k") && " — unavailable"}
                </SelectItem>
              </SelectContent>
            </Select>
            {!resolutionSupported && (
              <p className="text-xs text-red-400 mt-1">
                {resolution.toUpperCase()} isn't available on the current renderer
                {caps?.provider ? ` (${caps.provider})` : ""}. Pick a supported tier.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-[var(--w55)]">Link to property (optional)</label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}{p.city ? `, ${p.city}` : ""}{p.state ? ` ${p.state}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending || !resolutionSupported || uploading}
            title={uploading ? "Wait for the source photo to finish uploading" : undefined}
          >
            {generate.isPending ? "Rendering…" : uploading ? "Waiting for upload…" : "Generate redesign"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Render history</h2>
          <span className="text-xs text-[var(--w55)]">
            {renders.filter((r) => !hiddenRenderIds.has(r.id)).length} total
          </span>
        </div>
        {renders.filter((r) => !hiddenRenderIds.has(r.id)).length === 0 ? (
          <div className="surface p-8 text-center text-sm text-[var(--w55)]">
            No renders yet. Generate one above.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renders.filter((r) => !hiddenRenderIds.has(r.id)).map((r) => (
              <RenderCard
                key={r.id}
                r={r}
                properties={properties}
                onLink={(property_id) => link.mutate({ id: r.id, property_id })}
                onDelete={() => setRenderIdToDelete(r.id)}
                deleteDisabled={remove.isPending}
                onRegenerate={(edited) =>
                  regenerate.mutate({
                    prompt: edited.prompt,
                    style: edited.style,
                    source_image_url: r.source_image_url,
                    property_id: r.property_id,
                  })
                }
                regenerating={regenerate.isPending}
              />
            ))}

          </div>
        )}
      </div>
    </div>
      <SourcePhotoCropper
        file={pendingFile}
        onCancel={() => setPendingFile(null)}
        onUseOriginal={(f) => {
          setPendingFile(null);
          void uploadFile(f, {
            originalFilename: f.name,
            originalByteSize: f.size,
            wasCropped: false,
          });
        }}
        onConfirmCrop={(f, meta) => {
          const original = pendingFile;
          setPendingFile(null);
          void uploadFile(f, {
            originalFilename: original?.name,
            originalByteSize: original?.size,
            wasCropped: true,
            cropAspect: meta.aspect,
            cropMaxEdge: meta.maxEdge,
          });
        }}
      />

      <AlertDialog open={isDeleteSourceDialogOpen} onOpenChange={setIsDeleteSourceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove source photo?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this source photo? You'll have a few seconds to undo before the file is permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                setIsDeleteSourceDialogOpen(false);
                removeSourcePhoto();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={renderIdToDelete !== null} onOpenChange={(open) => !open && setRenderIdToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete render history?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this render? You'll have a few seconds to undo before it's permanently removed from your library history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (renderIdToDelete) {
                  softDeleteRender(renderIdToDelete);
                  setRenderIdToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "bg-green-500/15 text-green-400 border-green-500/30",
    rendering: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    queued: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs ${map[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

const RENDER_STYLES = ["modern", "scandinavian", "industrial", "farmhouse", "mid-century", "coastal"] as const;

type RenderRow = {
  id: string;
  prompt: string | null;
  style: string | null;
  status: string;
  error: string | null;
  property_id: string | null;
  source_image_url: string | null;
  source_signed_url: string | null;
  signed_url: string | null;
  properties: { address: string } | null;
};

type PropertyOption = { id: string; address: string };

function RenderCard({
  r,
  properties,
  onLink,
  onDelete,
  deleteDisabled,
  onRegenerate,
  regenerating,
}: {
  r: RenderRow;
  properties: PropertyOption[];
  onLink: (property_id: string | null) => void;
  onDelete: () => void;
  deleteDisabled: boolean;
  onRegenerate: (edited: { prompt: string; style: string }) => void;
  regenerating: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState(r.prompt ?? "");
  const [editStyle, setEditStyle] = useState<string>(r.style ?? "modern");

  function startEdit() {
    setEditPrompt(r.prompt ?? "");
    setEditStyle(r.style ?? "modern");
    setEditing(true);
  }

  return (
    <div className="surface p-3 space-y-2">
      {r.status === "ready" && r.signed_url ? (
        <BeforeAfterSlider
          before={r.source_signed_url}
          after={r.signed_url}
          filename={`render-${r.id}.png`}
        />
      ) : (
        <div className="aspect-video bg-black/20 rounded overflow-hidden flex items-center justify-center">
          <span className="text-xs text-[var(--w55)]">
            {r.status === "failed" ? "Failed" : "Rendering…"}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={r.status} />
        {r.style && <Badge variant="outline" className="text-xs">{r.style}</Badge>}
        {r.properties && (
          <Badge variant="outline" className="text-xs">
            <Link2 className="h-3 w-3 mr-1" />
            {r.properties.address}
          </Badge>
        )}
      </div>

      {editing ? (
        <div className="space-y-2 pt-1">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-[var(--w55)]">Prompt</label>
            <Textarea
              rows={3}
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-[var(--w55)]">Style</label>
            <Select value={editStyle} onValueChange={setEditStyle}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RENDER_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={regenerating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onRegenerate({ prompt: editPrompt.trim(), style: editStyle });
                setEditing(false);
              }}
              disabled={regenerating || editPrompt.trim().length < 4}
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--w55)] line-clamp-2">{r.prompt}</p>
          {r.status === "failed" && r.error && (
            <p className="text-xs text-red-400 line-clamp-2">{r.error}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <Select
              value={r.property_id ?? "none"}
              onValueChange={(v) => onLink(v === "none" ? null : v)}
            >
              <SelectTrigger className="h-8 text-xs flex-1 mr-2">
                <SelectValue placeholder="Link to…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unlinked</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="ghost"
              onClick={startEdit}
              title="Edit prompt or style, then regenerate"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                onRegenerate({ prompt: r.prompt ?? "", style: r.style ?? "modern" })
              }
              disabled={regenerating || !r.prompt}
              title="Regenerate with the same prompt and style"
            >
              <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              disabled={deleteDisabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

