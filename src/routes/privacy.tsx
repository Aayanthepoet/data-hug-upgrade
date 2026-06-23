import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — PropAI" },
      { name: "description", content: "How PropAI collects, uses, and protects your data, including SMS messaging information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <SiteHeader />
      <main className="container-x py-16 max-w-3xl">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[var(--w55)] text-sm mb-10">Last updated: June 23, 2026</p>

        <div className="prose prose-invert space-y-8 text-[var(--w75)] leading-relaxed">
          <section>
            <p>
              This Privacy Policy describes how PropAI ("PropAI," "we," "us," or "our"), operated by AI Network Agency,
              collects, uses, and discloses information when you use our website, services, and SMS messaging program.
              This page is maintained by PropAI to answer common privacy questions about our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account information</strong> you provide when registering, such as name, email, phone number, and company.</li>
              <li><strong>Property and outreach data</strong> sourced from publicly available government records (tax assessor data, foreclosure auction filings, code violation notices, lis pendens, and probate filings) and from licensed skip-tracing providers.</li>
              <li><strong>SMS data</strong> including phone numbers, message content, delivery status, and opt-in/opt-out keywords sent through our messaging program.</li>
              <li><strong>Usage data</strong> such as IP address, browser type, pages visited, and timestamps.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">How We Use Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, operate, and improve the PropAI platform.</li>
              <li>To send transactional and outreach SMS messages on behalf of authorized users.</li>
              <li>To honor opt-out requests (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) and maintain a permanent suppression list.</li>
              <li>To comply with applicable laws, including TCPA, CTIA guidelines, and carrier requirements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">SMS Messaging Program</h2>
            <p>
              <strong>No mobile information will be shared with third parties or affiliates for marketing or
              promotional purposes.</strong> Information sharing with subprocessors (such as Twilio for message delivery)
              is limited to what is required to send messages and process opt-outs. SMS opt-in data and consent are not
              shared with any third party.
            </p>
            <p>
              Message frequency varies — typically 1 initial message and up to 2 follow-ups per property over a 30-day
              window. Message and data rates may apply. Reply HELP for help, STOP to cancel.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">How We Share Information</h2>
            <p>
              We share information only with: (a) service providers that help us operate the platform (hosting,
              messaging, analytics) under confidentiality obligations; (b) authorities when required by law; and
              (c) successors in a business transfer. We do not sell personal information and we do not share SMS
              consent or phone numbers with third parties for their own marketing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Your Choices</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Opt out of SMS:</strong> reply STOP to any message. You will be removed immediately.</li>
              <li><strong>Access, correct, or delete</strong> your personal data by emailing the address below.</li>
              <li><strong>Do Not Call / Do Not Contact:</strong> email us and we will add you to our suppression list.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Data Retention &amp; Security</h2>
            <p>
              We retain personal data for as long as needed to provide the service and to comply with legal obligations.
              We use industry-standard administrative, technical, and physical safeguards to protect information.
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
