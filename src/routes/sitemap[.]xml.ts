import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { listPublicAgents, listPublishedPostsForSitemap } from "@/lib/social-public.functions";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticEntries = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/features", changefreq: "monthly", priority: "0.8" },
          { path: "/pricing", changefreq: "monthly", priority: "0.8" },
          { path: "/auth", changefreq: "yearly", priority: "0.4" },
        ];

        const [agents, posts] = await Promise.all([
          listPublicAgents().catch(() => []),
          listPublishedPostsForSitemap().catch(() => []),
        ]);

        const agentEntries = agents
          .filter((a) => a.public_slug)
          .map((a) => ({
            path: `/agents/${a.public_slug}`,
            changefreq: "weekly",
            priority: "0.7",
          }));

        const postEntries = posts.map((p) => ({
          path: `/agents/${p.agentSlug}/p/${p.postSlug}`,
          changefreq: "monthly",
          priority: "0.6",
          lastmod: p.published_at ?? undefined,
        }));

        const all = [...staticEntries, ...agentEntries, ...postEntries];
        const urls = all
          .map((e) =>
            [
              `  <url>`,
              `    <loc>${BASE_URL}${e.path}</loc>`,
              "lastmod" in e && e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
              `    <changefreq>${e.changefreq}</changefreq>`,
              `    <priority>${e.priority}</priority>`,
              `  </url>`,
            ].filter(Boolean).join("\n"),
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
