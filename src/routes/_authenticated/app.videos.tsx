import { createFileRoute } from "@tanstack/react-router";
import { EmptyModule } from "@/components/app/EmptyModule";

export const Route = createFileRoute("/_authenticated/app/videos")({
  head: () => ({ meta: [{ title: "Videos — PropAI" }] }),
  component: () => (
    <EmptyModule
      eyebrow="Videos"
      title={<>AI tour <span className="h-italic">videos</span></>}
      description="Auto-generated scripts, voiceovers, and renders. Video Studio ships in Phase 3."
    />
  ),
});
