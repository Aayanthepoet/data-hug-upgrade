import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePromptInputController } from "@/components/ai-elements/prompt-input";

type State = "idle" | "recording" | "transcribing";

export function VoiceInputButton() {
  const controller = usePromptInputController();
  const [state, setState] = useState<State>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!mimeType) {
        toast.error("This browser can't record a supported audio format");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        cleanup();
        if (blob.size < 1024) {
          toast.error("Recording was empty — try again");
          setState("idle");
          return;
        }
        setState("transcribing");
        try {
          const fd = new FormData();
          const ext = recorder.mimeType.includes("mp4") ? "mp4" : "webm";
          fd.append("file", blob, `recording.${ext}`);
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (!res.ok) {
            const msg = await res.text().catch(() => "");
            throw new Error(msg || `Transcription failed: ${res.status}`);
          }
          const data = (await res.json()) as { text?: string };
          const text = (data.text ?? "").trim();
          if (text) {
            const existing = controller.textInput.value;
            controller.textInput.setInput(
              existing ? `${existing} ${text}` : text,
            );
          } else {
            toast.message("No speech detected");
          }
        } catch (e) {
          toast.error((e as Error).message ?? "Transcription failed");
        } finally {
          setState("idle");
        }
      };
      recorder.start();
      setState("recording");
    } catch {
      toast.error("Microphone access denied");
      cleanup();
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  const label =
    state === "recording"
      ? "Stop recording"
      : state === "transcribing"
        ? "Transcribing…"
        : "Voice input";

  return (
    <button
      type="button"
      onClick={state === "recording" ? stop : start}
      disabled={state === "transcribing"}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition ${
        state === "recording"
          ? "border-red-500 bg-red-500/10 text-red-400 animate-pulse"
          : "border-border text-[var(--w55)] hover:text-foreground"
      } ${state === "transcribing" ? "opacity-60" : ""}`}
    >
      {state === "transcribing" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "recording" ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Mic className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {state === "recording" ? "Stop" : state === "transcribing" ? "…" : "Voice"}
      </span>
    </button>
  );
}
