import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Image as ImageIcon, RotateCcw, Trash2, Crop, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { listSourcePhotos, deleteSourcePhoto } from "@/lib/vision/vision.functions";

export const Route = createFileRoute("/_authenticated/app/vision/library")({
  head: () => ({ meta: [{ title: "Source photo library — PropAI" }] }),
  component: VisionLibraryPage,
});

function formatMB(bytes: number | null | undefined) {
  if (!bytes) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function VisionLibraryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listSourcePhotos);
  const deleteFn = useServerFn(deleteSourcePhoto);

  const [photoIdToDelete, setPhotoIdToDelete] = useState<string | null>(null);
  // Soft-hidden ids during the undo window; matches the pattern used on the
  // main vision page so the library list reacts instantly to a delete.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["vision-source-photos"],
    queryFn: () => listFn({ data: {} }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vision-source-photos"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  function softDeletePhoto(id: string) {
    setHiddenIds((prev) => {
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
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      });
    }, UNDO_MS);

    toast.success("Photo deleted", {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          toast.success("Restore complete");
        },
      },
    });
  }

  function reusePhoto(id: string) {
    // Navigate to the vision page with a search param the page can pick up
    // to pre-load the photo as the "before" image without re-uploading.
    navigate({
      to: "/app/vision",
      search: { sourcePhotoId: id },
    });
  }

  const visible = photos.filter((p) => !hiddenIds.has(p.id));

  return (
    <>
      <div className="space-y-6">
        <div>
          <Link
            to="/app/vision"
            className="inline-flex items-center gap-1 text-xs text-[var(--w55)] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Vision Studio
          </Link>
          <div className="eyebrow inline-flex mt-3">
            <span className="eyebrow-dot" />
            Vision Studio · library · source photos
          </div>
          <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-4">
            Source photo <span className="h-italic">library</span>
          </h1>
          <p className="text-[var(--w55)] mt-3 max-w-xl">
            Every "before" photo you've uploaded. Reuse one to start a new
            redesign without re-uploading, or delete photos you no longer need.
          </p>
        </div>

        {isLoading ? (
          <div className="surface p-12 flex items-center justify-center text-sm text-[var(--w55)]">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading your library…
          </div>
        ) : visible.length === 0 ? (
          <div className="surface p-12 text-center space-y-3">
            <ImageIcon className="h-8 w-8 text-[var(--w55)] mx-auto" />
            <p className="text-sm text-[var(--w55)]">
              No source photos yet. Upload one from Vision Studio to get
              started.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/vision">Go to Vision Studio</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="text-xs text-[var(--w55)]">
              {visible.length} photo{visible.length === 1 ? "" : "s"}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((p) => (
                <div key={p.id} className="surface p-3 space-y-3">
                  <div className="aspect-video bg-black/30 rounded overflow-hidden border border-white/5">
                    {p.signed_url ? (
                      <img
                        src={p.signed_url}
                        alt={p.filename}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-[var(--w55)]" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium truncate" title={p.filename}>
                      {p.filename}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--w55)]">
                      <span>{formatMB(p.byte_size)}</span>
                      <span>·</span>
                      <span>{formatDate(p.created_at)}</span>
                      {p.was_cropped && (
                        <span className="inline-flex items-center gap-1 text-cyan-400">
                          <Crop className="h-2.5 w-2.5" />
                          Cropped
                          {p.crop_aspect ? ` · ${p.crop_aspect}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs"
                      onClick={() => reusePhoto(p.id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reuse
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                      onClick={() => setPhotoIdToDelete(p.id)}
                      aria-label="Delete photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <AlertDialog
        open={photoIdToDelete !== null}
        onOpenChange={(open) => !open && setPhotoIdToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete source photo?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this photo from your library?
              You'll have a few seconds to undo before the file is permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (photoIdToDelete) {
                  softDeletePhoto(photoIdToDelete);
                  setPhotoIdToDelete(null);
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
