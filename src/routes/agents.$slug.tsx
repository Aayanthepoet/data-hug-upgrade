import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPublicAgent } from "@/lib/social-public.functions";

type AgentResponse = Awaited<ReturnType<typeof getPublicAgent>>;
type AgentData = NonNullable<AgentResponse>;

const agentQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public-agent", slug],
    queryFn: () => getPublicAgent({ data: { slug } }) as Promise<AgentResponse>,
  });

export const Route = createFileRoute("/agents/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(agentQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.agent;
    if (!a) return { meta: [{ title: "Agent — PropAI" }] };
    const name = a.full_name || `Agent ${a.public_slug}`;
    const desc =
      a.public_bio ||
      `${name}${a.public_brokerage ? ` at ${a.public_brokerage}` : ""} — recent property listings, market insights, and contact details.`;
    return {
      meta: [
        { title: `${name} — PropAI Real Estate Agent` },
        { name: "description", content: desc.slice(0, 158) },
        { property: "og:title", content: name },
        { property: "og:description", content: desc.slice(0, 158) },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: `/agents/${params.slug}` },
        ...(a.public_headshot_url
          ? [
              { property: "og:image", content: a.public_headshot_url },
              { name: "twitter:image", content: a.public_headshot_url },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: name },
        { name: "twitter:description", content: desc.slice(0, 158) },
      ],
      links: [{ rel: "canonical", href: `/agents/${params.slug}` }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-center p-8">
      <div>
        <h1 className="h-display text-3xl mb-3">Agent not found</h1>
        <Link to="/" className="text-cyan">← Back to PropAI</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-center">
      <p className="text-red-400">{error.message}</p>
    </div>
  ),
  component: AgentPage,
});

function AgentPage() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(agentQuery(params.slug));
  if (!data) return null;
  const { agent, posts } = data as AgentData;
  const fullName = agent.full_name || `Agent ${agent.public_slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: fullName,
    image: agent.public_headshot_url || undefined,
    description: agent.public_bio || undefined,
    telephone: agent.public_phone || undefined,
    email: agent.public_email || undefined,
    worksFor: agent.public_brokerage ? { "@type": "Organization", name: agent.public_brokerage } : undefined,
    areaServed: agent.public_service_areas?.length
      ? agent.public_service_areas.map((a) => ({ "@type": "Place", name: a }))
      : undefined,
  };

  return (
    <div className="min-h-screen bg-bg text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold">Prop<span className="text-cyan">AI</span></Link>
          <Link to="/auth" className="text-sm text-[var(--w55)] hover:text-foreground">
            Are you an agent? Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <section className="grid md:grid-cols-[200px_1fr] gap-8 items-start mb-12">
          {agent.public_headshot_url ? (
            <img
              src={agent.public_headshot_url}
              alt={fullName}
              className="w-48 h-48 rounded-xl object-cover border border-border"
            />
          ) : (
            <div className="w-48 h-48 rounded-xl bg-[var(--surface-2)] border border-border flex items-center justify-center text-5xl text-[var(--w35)]">
              {fullName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="h-display text-4xl mb-2">{fullName}</h1>
            {agent.public_brokerage && (
              <p className="text-[var(--w55)] mb-3">{agent.public_brokerage}</p>
            )}
            {agent.public_bio && (
              <p className="text-foreground leading-relaxed mb-4">{agent.public_bio}</p>
            )}
            <div className="flex flex-wrap gap-3 text-sm">
              {agent.public_phone && (
                <a href={`tel:${agent.public_phone}`} className="btn-ghost px-4 py-2">
                  {agent.public_phone}
                </a>
              )}
              {agent.public_email && (
                <a href={`mailto:${agent.public_email}`} className="btn-ghost px-4 py-2">
                  {agent.public_email}
                </a>
              )}
            </div>
            {agent.public_service_areas?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {agent.public_service_areas.map((a) => (
                  <span key={a} className="text-xs px-2 py-1 rounded bg-[var(--surface-2)] border border-border">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="h-display text-2xl mb-6">Recent posts &amp; listings</h2>
          {posts.length === 0 ? (
            <p className="text-[var(--w55)]">No posts published yet — check back soon.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  to="/agents/$slug/p/$postSlug"
                  params={{ slug: params.slug, postSlug: p.landing_slug }}
                  className="block border border-border rounded-xl overflow-hidden hover:border-cyan transition-colors"
                >
                  {p.hero_image_url && (
                    <img src={p.hero_image_url} alt={p.headline} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-5">
                    <h3 className="font-semibold mb-2">{p.headline}</h3>
                    {p.subheadline && (
                      <p className="text-sm text-[var(--w55)] line-clamp-2">{p.subheadline}</p>
                    )}
                    {p.published_at && (
                      <p className="text-xs text-[var(--w35)] mt-3">
                        {new Date(p.published_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border mt-16">
        <div className="max-w-5xl mx-auto px-6 py-6 text-xs text-[var(--w35)] flex items-center justify-between">
          <span>© AI Network Agency · Powered by PropAI</span>
          <Link to="/" className="hover:text-foreground">propai.ainetworkagency.com</Link>
        </div>
      </footer>
    </div>
  );
}
