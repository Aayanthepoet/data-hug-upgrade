import { X, FileText, ImageIcon } from "lucide-react";
import { useProviderAttachments } from "@/components/ai-elements/prompt-input";

export function AttachmentChips() {
  const { files, remove } = useProviderAttachments();
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-2">
      {files.map((f) => {
        const isImage = f.mediaType?.startsWith("image/");
        return (
          <div
            key={f.id}
            className="group flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2 py-1 text-xs max-w-[220px]"
          >
            {isImage && f.url ? (
              <img
                src={f.url}
                alt={f.filename ?? "attachment"}
                className="h-6 w-6 rounded object-cover"
              />
            ) : isImage ? (
              <ImageIcon className="h-3.5 w-3.5 text-[var(--w55)]" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-[var(--w55)]" />
            )}
            <span className="truncate" title={f.filename ?? ""}>
              {f.filename ?? "file"}
            </span>
            <button
              type="button"
              onClick={() => remove(f.id)}
              className="p-0.5 rounded hover:bg-background text-[var(--w55)] hover:text-red-400 transition"
              aria-label={`Remove ${f.filename ?? "attachment"}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
