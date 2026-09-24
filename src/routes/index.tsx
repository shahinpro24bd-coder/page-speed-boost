import { createFileRoute } from "@tanstack/react-router";

/** Home page — rendered from the database copy of the original markup. */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dr. Taha Demir | Ortopedi ve Travmatoloji Uzmanı" },
      { name: "description", content: "Dr. Taha Demir ile ortopedi ve travmatoloji tedavileri hakkında bilgi alın ve randevu oluşturun." },
      { property: "og:title", content: "Dr. Taha Demir | Ortopedi ve Travmatoloji Uzmanı" },
      { property: "og:description", content: "Modern ortopedik tedaviler ve kişiye özel bakım." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preload",
        as: "image",
        href: "/img/dr-taha-portrait.webp",
        fetchPriority: "high",
      },
    ],
  }),
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { renderSitePage } = await import("@/lib/site-content/render.server");
        return renderSitePage(request, "index");
      },
    },
  },
});
