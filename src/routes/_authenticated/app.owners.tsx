import { createFileRoute } from "@tanstack/react-router";
import { EmptyModule } from "@/components/app/EmptyModule";

export const Route = createFileRoute("/_authenticated/app/owners")({
  head: () => ({ meta: [{ title: "Owners — PropAI" }] }),
  component: () => (
    <EmptyModule
      eyebrow="Owners"
      title={<>Owner <span className="h-italic">records</span></>}
      description="People and entities tied to your properties. Auto-populated by the Owner Finder module in Phase 4."
    />
  ),
});
