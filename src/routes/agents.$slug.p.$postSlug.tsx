import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { marked } from "marked";
import { getPublicPost } from "@/lib/social-public.functions";

type PostResponse = Awaited<ReturnType<typeof getPublicPost>>;
type PostData = NonNullable<PostResponse>;

const postQuery = (agentSlug: string, postSlug: string) =>
  queryOptions({
    queryKey: ["public-post", agentSlug, postSlug],
    queryFn: () => getPublicPost({ data: { agentSlug, postSlug } }) as Promise<PostResponse>,
  });

export const Route = createFileRoute("/agents/$slug/p/$postSlug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(
      postQuery(params.slug, params.postSlug),
    );
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Post — PropAI" }] };
    const { post, agent } = loaderData;
    const property = (loaderData.property as { city: string | null; state: string | null } | null) ?? null;
    const title = `${post.headline} — ${agent.full_name || agent.public_slug}`;
    const desc = post.subheadline || post.body_md.slice(0, 158).replace(/\s+/g, " ").trim();
    const url = `/agents/${params.slug}/p/${params.postSlug}`;
    const hero = post.hero_image_url || agent.public_headshot_url || undefined;
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 158) },
        { property: "og:title", content: post.headline },
        { property: "og:description", content: desc.slice(0, 158) },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        ...(hero
          ? [
              { property: "og:image", content: hero },
              { name: "twitter:image", content: hero },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: post.headline },
        { name: "twitter:description", content: desc.slice(0, 158) },
        ...(property
          ? [
              { property: "article:tag", content: [property.city, property.state].filter(Boolean).join(", ") },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="h-display text-3xl mb-3">Post not found</h1>
        <Link to="/" className="text-cyan">← Back to PropAI</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 text-center">
      <p className="text-red-400">{error.message}</p>
    </div>
  ),
  component: PostPage,
});

type PropertyView = {
  id: string; address: string | null; city: string | null; state: string | null;
  zip: string | null; beds: number | null; baths: number | null; sqft: number | null;
  price: number | null; photos: string[] | null;
} | null;

function PostPage() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(params.slug, params.postSlug));
  if (!data) return null;
  const { agent, post } = data as PostData;
  const property = (data as PostData).property as PropertyView;
  const fullName = agent.full_name || `Agent ${agent.public_slug}`;
  const bodyHtml = marked.parse(post.body_md || "", { async: false }) as string;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.headline,
    description: post.subheadline || undefined,
    image: post.hero_image_url || undefined,
    datePublished: post.published_at,
    author: {
      "@type": "RealEstateAgent",
      name: fullName,
      url: `/agents/${agent.public_slug}`,
      telephone: agent.public_phone || undefined,
      email: agent.public_email || undefined,
    },
    publisher: {
      "@type": "Organization",
      name: agent.public_brokerage || "PropAI",
    },
  };
  if (property) {
    jsonLd.about = {
      "@type": "SingleFamilyResidence",
      address: {
        "@type": "PostalAddress",
        streetAddress: property.address ?? undefined,
        addressLocality: property.city ?? undefined,
        addressRegion: property.state ?? undefined,
        postalCode: property.zip ?? undefined,
      },
      numberOfBedrooms: property.beds ?? undefined,
      numberOfBathroomsTotal: property.baths ?? undefined,
      floorSize: property.sqft ? { "@type": "QuantitativeValue", value: property.sqft, unitCode: "FTK" } : undefined,
    };
  }

  return (
    <div className="min-h-screen bg-bg text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold">Prop<span className="text-cyan">AI</span></Link>
          <Link
            to="/agents/$slug"
            params={{ slug: agent.public_slug }}
            className="text-sm text-[var(--w55)] hover:text-foreground"
          >
            ← {fullName}
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {post.hero_image_url && (
          <img
            src={post.hero_image_url}
            alt={post.headline}
            className="w-full h-72 md:h-96 object-cover rounded-xl mb-8"
          />
        )}
        <h1 className="h-display text-4xl md:text-5xl mb-4">{post.headline}</h1>
        {post.subheadline && (
          <p className="text-lg text-[var(--w55)] mb-8">{post.subheadline}</p>
        )}

        <div className="flex items-center gap-3 pb-8 mb-8 border-b border-border">
          {agent.public_headshot_url ? (
            <img src={agent.public_headshot_url} alt={fullName} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
              {fullName.charAt(0)}
            </div>
          )}
          <div>
            <Link to="/agents/$slug" params={{ slug: agent.public_slug }} className="font-semibold hover:text-cyan">
              {fullName}
            </Link>
            {agent.public_brokerage && (
              <p className="text-xs text-[var(--w55)]">{agent.public_brokerage}</p>
            )}
          </div>
          {post.published_at && (
            <span className="ml-auto text-xs text-[var(--w35)]">
              {new Date(post.published_at).toLocaleDateString()}
            </span>
          )}
        </div>

        <div
          className="prose prose-invert max-w-none [&_h2]:h-display [&_h2]:text-2xl [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:leading-relaxed [&_p]:my-4 [&_ul]:my-4 [&_li]:my-1"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {property && (
          <aside className="mt-10 p-6 border border-border rounded-xl bg-[var(--surface-2)]">
            <h3 className="font-semibold mb-3">Property details</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              {property.address && (<><dt className="text-[var(--w55)]">Address</dt><dd>{property.address}</dd></>)}
              {property.city && (<><dt className="text-[var(--w55)]">Location</dt><dd>{[property.city, property.state, property.zip].filter(Boolean).join(", ")}</dd></>)}
              {property.beds != null && (<><dt className="text-[var(--w55)]">Beds</dt><dd>{property.beds}</dd></>)}
              {property.baths != null && (<><dt className="text-[var(--w55)]">Baths</dt><dd>{property.baths}</dd></>)}
              {property.sqft != null && (<><dt className="text-[var(--w55)]">Sq ft</dt><dd>{property.sqft.toLocaleString()}</dd></>)}
              {property.price != null && (<><dt className="text-[var(--w55)]">Price</dt><dd>${property.price.toLocaleString()}</dd></>)}
            </dl>
          </aside>
        )}

        <div className="mt-10 p-6 border border-border rounded-xl text-center">
          <h3 className="font-semibold mb-2">{post.cta_label || "Contact agent"}</h3>
          <p className="text-sm text-[var(--w55)] mb-4">
            Interested in this {property ? "property" : "post"}? Reach out to {fullName} directly.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {agent.public_phone && (
              <a href={`tel:${agent.public_phone}`} className="btn-primary px-5 py-2">
                Call {agent.public_phone}
              </a>
            )}
            {agent.public_email && (
              <a href={`mailto:${agent.public_email}`} className="btn-ghost px-5 py-2">
                Email
              </a>
            )}
          </div>
        </div>

        {post.tags?.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((t: string) => (
              <span key={t} className="text-xs px-2 py-1 rounded bg-[var(--surface-2)] border border-border">
                #{t}
              </span>
            ))}
          </div>
        )}
      </article>

      <footer className="border-t border-border mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 text-xs text-[var(--w35)] text-center">
          © AI Network Agency · Powered by <Link to="/" className="hover:text-foreground">PropAI</Link>
        </div>
      </footer>
    </div>
  );
}
