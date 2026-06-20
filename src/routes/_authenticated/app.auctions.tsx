import { createFileRoute } from "@tanstack/react-router";
import { EmptyModule } from "@/components/app/EmptyModule";

export const Route = createFileRoute("/_authenticated/app/auctions")({
  head: () => ({ meta: [{ title: "Auctions — PropAI" }] }),
  component: () => (
    <EmptyModule
      eyebrow="Auctions"
      title={<>Live <span className="h-italic">auctions</span></>}
      description="Real-time bidding with fraud detection. Bidding engine lands in Phase 4."
    />
  ),
});
