import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Data Deletion — PropAI" },
      {
        name: "description",
        content:
          "How to request deletion of your PropAI account data, including data collected through Facebook and Instagram Login.",
      },
      { property: "og:title", content: "Data Deletion — PropAI" },
      {
        property: "og:description",
        content: "Request deletion of your PropAI account data.",
      },
      { property: "og:url", content: "/data-deletion" },
    ],
    links: [{ rel: "canonical", href: "/data-deletion" }],
  }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <SiteHeader />
      <main className="container-x py-16 max-w-3xl">
        <h1 className="text-4xl font-bold mb-2">Data Deletion Instructions</h1>
        <p className="text-[var(--w55)] text-sm mb-10">
          Last updated: June 24, 2026
        </p>

        <div className="space-y-8 text-[var(--w75)] leading-relaxed">
          <section>
            <p>
              PropAI ("PropAI", "we", "us"), operated by AI Network Agency,
              respects your right to control your data. This page explains how
              to request deletion of personal data we store about you,
              including any data obtained when you connect Facebook or
              Instagram accounts to PropAI via Facebook Login.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">
              What we store
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your PropAI account profile (name, email, phone, company).</li>
              <li>
                Connected social account references (Facebook Page IDs,
                Instagram Business Account IDs, access tokens) — only when you
                explicitly connect them.
              </li>
              <li>Content you create in PropAI (posts, leads, outreach history).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">
              How to request deletion
            </h2>
            <p className="mb-3">
              To delete your PropAI account and all associated data — including
              Facebook and Instagram data obtained via Facebook Login — choose
              one of the options below:
            </p>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                <strong>In-app:</strong> Sign in to PropAI, go to{" "}
                <strong>Settings → Account → Delete account</strong>. This
                removes your profile, connected social accounts, posts, and
                outreach data within 30 days.
              </li>
              <li>
                <strong>Disconnect only:</strong> To remove only your Facebook
                or Instagram connection (and the access tokens we stored), go
                to <strong>Social → Connected accounts</strong> and click{" "}
                <strong>Disconnect</strong> next to the account.
              </li>
              <li>
                <strong>By email:</strong> Send a deletion request to{" "}
                <a
                  href="mailto:privacy@propai.app"
                  className="text-cyan-400 underline"
                >
                  privacy@propai.app
                </a>{" "}
                from the email address on your account. Include the subject
                line <em>"Data deletion request"</em>. We will confirm
                completion within 30 days.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">
              Removing PropAI from your Facebook account
            </h2>
            <p>
              You can also revoke PropAI's access from your Facebook account
              directly:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>Go to your Facebook <strong>Settings & Privacy → Settings</strong>.</li>
              <li>Open <strong>Apps and Websites</strong>.</li>
              <li>Locate <strong>PropAI</strong> in the active list and click <strong>Remove</strong>.</li>
            </ol>
            <p className="mt-3">
              Revoking access at Facebook invalidates the access tokens we
              hold. Send an email request as above if you also want the stored
              references deleted from PropAI.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">
              Retention exceptions
            </h2>
            <p>
              We may retain limited information required to comply with legal
              obligations (e.g. SMS opt-out suppression records under TCPA,
              billing records, fraud-prevention logs). Retention periods are
              described in our{" "}
              <a href="/privacy" className="text-cyan-400 underline">
                Privacy Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions about this process? Email{" "}
              <a
                href="mailto:privacy@propai.app"
                className="text-cyan-400 underline"
              >
                privacy@propai.app
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
