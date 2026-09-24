import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import fallbackSnapshot from "./fallback.generated.json";

/** Publishable-key client for public, read-only content. */
export function createPublicClient(): SupabaseClient<Database> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Every language the site is published in, in switcher order. */
export const SITE_LANGS = ["ar", "en", "fr", "de", "tr"] as const;
export type SiteLang = (typeof SITE_LANGS)[number];

export function isSiteLang(value: string): value is SiteLang {
  return (SITE_LANGS as readonly string[]).includes(value);
}

export type ContentSnapshot = {
  version: number;
  langs: Record<SiteLang, Record<string, string>>;
  images: Record<string, string>;
  pages: Record<
    string,
    { titleKey: string; descriptionKey: string; keywordsKey: string | null; path: string }
  >;
};

// Public content changes rarely. A longer warm cache removes repeated database
// round-trips while admin previews still bypass it and publish invalidates it.
const TTL_MS = 5 * 60 * 1000;

function withBundledFallback(data: ContentSnapshot): ContentSnapshot {
  const bundled = fallbackSnapshot as ContentSnapshot;
  const portableImages = { ...data.images };
  for (const [slot, fallbackUrl] of Object.entries(bundled.images)) {
    const storedUrl = portableImages[slot];
    if (!storedUrl || storedUrl.startsWith("/__l5e/assets-v1/")) {
      portableImages[slot] = fallbackUrl;
    }
  }
  return {
    version: data.version,
    langs: {
      tr: { ...bundled.langs.tr, ...data.langs.tr },
      en: { ...bundled.langs.en, ...data.langs.en },
      ar: { ...bundled.langs.ar, ...data.langs.ar },
      fr: { ...bundled.langs.fr, ...data.langs.fr },
      de: { ...bundled.langs.de, ...data.langs.de },
    },
    images: { ...bundled.images, ...portableImages },
    pages: { ...bundled.pages, ...data.pages },
  };
}
// Start with the bundled snapshot so the first visitor never waits for a
// network round-trip before the HTML can be returned.
let cached: { at: number; data: ContentSnapshot } | null = {
  at: Date.now(),
  data: fallbackSnapshot as ContentSnapshot,
};
let inflight: Promise<ContentSnapshot> | null = null;

type SiteTable = "site_texts" | "site_images" | "site_pages";

async function fetchAll<T>(
  db: SupabaseClient<Database>,
  table: SiteTable,
  select: string,
): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 999;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

async function fetchSnapshot(): Promise<ContentSnapshot> {
  const db = createPublicClient();
  const [textsRes, imagesRes, pagesRes, versionRes] = await Promise.all([
    fetchAll<{ key: string; lang: string; value: string }>(db, "site_texts", "key, lang, value"),
    fetchAll<{ slot: string; url: string }>(db, "site_images", "slot, url"),
    fetchAll<{
      slug: string;
      path: string;
      title_key: string;
      description_key: string;
      keywords_key: string | null;
    }>(db, "site_pages", "slug, path, title_key, description_key, keywords_key"),
    db.from("site_content_version").select("version").eq("id", 1).maybeSingle(),
  ]);

  const langs: ContentSnapshot["langs"] = {
    ar: {}, en: {}, fr: {}, de: {}, tr: {},
  } as ContentSnapshot["langs"];
  for (const row of textsRes) {
    if (isSiteLang(row.lang)) langs[row.lang as SiteLang][row.key] = row.value;
  }
  const images: Record<string, string> = {};
  for (const row of imagesRes) images[row.slot] = row.url;

  const pages: ContentSnapshot["pages"] = {};
  for (const row of pagesRes) {
    pages[row.slug] = {
      titleKey: row.title_key,
      descriptionKey: row.description_key,
      keywordsKey: row.keywords_key,
      path: row.path,
    };
  }

  return { version: Number(versionRes.data?.version ?? 0), langs, images, pages };
}

/** Short-lived in-process cache so repeat visitors never wait on the database. */
export async function getContentSnapshot(force = false): Promise<ContentSnapshot> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.data;
  if (!force && inflight) return inflight;
  inflight = fetchSnapshot()
    .then((data) => {
      const completeData = withBundledFallback(data);
      cached = { at: Date.now(), data: completeData };
      return completeData;
    })
    .catch((error) => {
      console.error("Content store unavailable; using bundled site content.", error);
      const data = fallbackSnapshot as ContentSnapshot;
      cached = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateContentCache() {
  cached = { at: Date.now(), data: fallbackSnapshot as ContentSnapshot };
}
