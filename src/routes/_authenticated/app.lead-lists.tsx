import { createFileRoute } from "@tanstack/react-router";
import { EmptyModule } from "@/components/app/EmptyModule";

export const Route = createFileRoute("/_authenticated/app/lead-lists")({
  head: () => ({ meta: [{ title: "Lead Lists — PropAI" }] }),
  component: () => (
    <EmptyModule
      eyebrow="Lead Lists"
      title={<>Saved <span className="h-italic">lists</span></>}
      description="Filter properties into named lists, then power campaigns from them."
    />
  ),
});
