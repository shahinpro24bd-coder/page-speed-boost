/**
 * Reads the six HTML pages plus the existing TR->EN dictionary and emits the
 * SQL that loads the current site content into the database unchanged.
 * Run with: bun scripts/generate-seed.ts > /tmp/seed.sql
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectSiteContent } from "../src/lib/site-content/transform";
import { PAGES, normalizeText, textKey } from "../src/lib/site-content/keys";

const root = process.cwd();
const dictSrc = readFileSync(join(root, "scripts/legacy-i18n-dict.js"), "utf8");
const dict: Record<string, string> = (() => {
  const body = dictSrc.slice(dictSrc.indexOf("{"), dictSrc.lastIndexOf("}") + 1);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${body});`)() as Record<string, string>;
})();
const generated = JSON.parse(
  readFileSync(join(root, "scripts/generated-translations.json"), "utf8"),
) as Record<string, Record<string, string>>;

const q = (s: string) => "'" + s.replace(/'/g, "''") + "'";

type Row = { key: string; tr: string; en: string; page: string; kind: string };
const textRows = new Map<string, Row>();
const imageRows = new Map<string, { slot: string; url: string; page: string }>();
const pageRows: string[] = [];

PAGES.forEach((page, i) => {
  const html = readFileSync(join(root, "src/site", page.file), "utf8");
  const content = collectSiteContent(html);

  for (const t of content.texts) {
    if (textRows.has(t.key)) continue;
    const en = dict[normalizeText(t.value)] ?? t.value;
    textRows.set(t.key, { key: t.key, tr: t.value, en, page: page.slug, kind: t.kind });
  }
  for (const img of content.images) {
    if (!imageRows.has(img.slot)) {
      imageRows.set(img.slot, { slot: img.slot, url: img.url, page: page.slug });
    }
  }
  pageRows.push(
    `(${q(page.slug)}, ${q("/site/" + page.file)}, ${q(content.titleKey)}, ${q(
      content.descriptionKey,
    )}, ${content.keywordsKey ? q(content.keywordsKey) : "NULL"}, ${i})`,
  );
});

const lines: string[] = [];
lines.push("-- Seeded from the original static pages; values are unchanged.");

const textValues: string[] = [];
for (const r of textRows.values()) {
  textValues.push(`(${q(r.key)}, 'tr', ${q(r.tr)}, ${q(r.page)}, ${q(r.kind)})`);
  textValues.push(`(${q(r.key)}, 'en', ${q(r.en)}, ${q(r.page)}, ${q(r.kind)})`);
  for (const lang of ["ar", "fr", "de"]) {
    textValues.push(
      `(${q(r.key)}, ${q(lang)}, ${q(generated[lang]?.[r.key] ?? r.en)}, ${q(r.page)}, ${q(r.kind)})`,
    );
  }
}
for (let i = 0; i < textValues.length; i += 200) {
  lines.push(
    "INSERT INTO public.site_texts (key, lang, value, page, kind) VALUES\n" +
      textValues.slice(i, i + 200).join(",\n") +
      "\nON CONFLICT (key, lang) DO NOTHING;",
  );
}

const imageValues = [...imageRows.values()].map(
  (r) => `(${q(r.slot)}, ${q(r.url.startsWith("/") ? r.url : "/site/" + r.url)}, ${q(r.page)})`,
);
lines.push(
  "INSERT INTO public.site_images (slot, url, page) VALUES\n" +
    imageValues.join(",\n") +
    "\nON CONFLICT (slot) DO NOTHING;",
);

lines.push(
  "INSERT INTO public.site_pages (slug, path, title_key, description_key, keywords_key, sort_order) VALUES\n" +
    pageRows.join(",\n") +
    "\nON CONFLICT (slug) DO NOTHING;",
);

process.stdout.write(lines.join("\n\n") + "\n");
console.error(`texts=${textRows.size} images=${imageRows.size} pages=${pageRows.length}`);
