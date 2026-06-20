import { createFileRoute } from "@tanstack/react-router";
import { EmptyModule } from "@/components/app/EmptyModule";

export const Route = createFileRoute("/_authenticated/app/contacts")({
  head: () => ({ meta: [{ title: "Contacts — PropAI" }] }),
  component: () => (
    <EmptyModule
      eyebrow="Contacts"
      title={<>Skip-traced <span className="h-italic">contacts</span></>}
      description="Phones, emails, and socials resolved from owner records. Skip-trace integration ships in Phase 4."
    />
  ),
});
