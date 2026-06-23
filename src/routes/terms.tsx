import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — PropAI" },
      { name: "description", content: "PropAI terms of service and SMS messaging program terms." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <SiteHeader />
      <main className="container-x py-16 max-w-3xl">
        <h1 className="text-4xl font-bold mb-2">Terms &amp; Conditions</h1>
        <p className="text-[var(--w55)] text-sm mb-10">Last updated: June 23, 2026</p>

        <div className="space-y-8 text-[var(--w75)] leading-relaxed">
          <section>
            <p>
              These Terms govern your use of the PropAI platform ("Service") operated by AI Network Agency, including
              our SMS outreach program ("PropAI Outreach").
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">SMS Program Terms — PropAI Outreach</h2>
            <p>
              <strong>Program name:</strong> PropAI Outreach.
            </p>
            <p>
              <strong>Description:</strong> PropAI Outreach is a conversational SMS program used to contact property
              owners identified through publicly available government records (tax liens, foreclosure auctions, code
              violations, lis pendens, probate). Messages introduce PropAI's home-buying service and ask whether the
              recipient is interested in selling.
            </p>
            <p>
              <strong>Message frequency:</strong> Low — typically 1 initial message and up to 2 follow-ups per property
              over a 30-day period.
            </p>
            <p>
              <strong>Cost:</strong> <strong>Message and data rates may apply.</strong> Your mobile carrier's standard
              rates apply to all messages sent or received.
            </p>
            <p>
              <strong>Opt-out:</strong> Reply <strong>STOP</strong> (or STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) to any
              message to unsubscribe. You will receive one confirmation message and no further messages will be sent.
            </p>
            <p>
              <strong>Help:</strong> Reply <strong>HELP</strong> for support, or email{" "}
              <a className="text-cyan hover:underline" href="mailto:support@propai.io">support@propai.io</a>.
            </p>
            <p>
              <strong>Carriers:</strong> Carriers are not liable for delayed or undelivered messages. Supported
              carriers include AT&amp;T, T-Mobile, Verizon Wireless, Sprint, U.S. Cellular, and most other US carriers.
            </p>
            <p>
              <strong>Privacy:</strong> See our{" "}
              <a className="text-cyan hover:underline" href="/privacy">Privacy Policy</a>. No mobile information will
              be shared with third parties or affiliates for marketing or promotional purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Use of the Service</h2>
            <p>
              You agree to use the Service only for lawful purposes and in compliance with the TCPA, CAN-SPAM, state
              telemarketing laws, and carrier guidelines. You may not use the Service to send spam, harass recipients,
              or contact numbers on federal or state Do-Not-Call lists for prohibited purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activity
              under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Disclaimer &amp; Limitation of Liability</h2>
            <p>
              The Service is provided "as is" without warranties of any kind. To the maximum extent permitted by law,
              PropAI and AI Network Agency are not liable for indirect, incidental, or consequential damages arising
              from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes are posted
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Contact</h2>
            <p>
              Questions? Email <a className="text-cyan hover:underline" href="mailto:support@propai.io">support@propai.io</a>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
