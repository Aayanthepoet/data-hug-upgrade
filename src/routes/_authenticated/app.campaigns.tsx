import { createFileRoute } from "@tanstack/react-router";
import { EmptyModule } from "@/components/app/EmptyModule";

export const Route = createFileRoute("/_authenticated/app/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — PropAI" }] }),
  component: () => (
    <EmptyModule
      eyebrow="Campaigns"
      title={<>Outreach <span className="h-italic">campaigns</span></>}
      description="SMS, email, and voice sequences driven by the AI Outreach Engine (Phase 3)."
    />
  ),
});
