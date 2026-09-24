import { createFileRoute } from "@tanstack/react-router";

/** Every other public page: /about.html, /service.html, /contact.html … */
export const Route = createFileRoute("/$page")({
  head: ({ params }) => {
    const labels: Record<string, string> = {
      "about.html": "Hakkımda",
      "service.html": "Tedaviler",
      "treatment.html": "Tedavi Bilgileri",
      "appoinment.html": "Randevu",
      "contact.html": "İletişim",
    };
    const label = labels[params.page] ?? "Sayfa";
    const title = `${label} | Dr. Taha Demir`;
    const description = `Dr. Taha Demir ${label.toLocaleLowerCase("tr-TR")} sayfası.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { renderSitePage } = await import("@/lib/site-content/render.server");
        const slug = String(params.page).replace(/\.html$/i, "");
        return renderSitePage(request, slug);
      },
    },
  },
});
