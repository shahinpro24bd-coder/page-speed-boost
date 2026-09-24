import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, ImagePlus, LogOut, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveImageSlot, saveTexts } from "@/lib/site-content/admin.functions";
import { Button } from "@/components/ui/button";

const PAGES = [
  { slug: "index", label: "Anasayfa" },
  { slug: "about", label: "Hakkımda" },
  { slug: "service", label: "Tedaviler" },
  { slug: "treatment", label: "Tedavi Bilgileri" },
  { slug: "appoinment", label: "Randevu" },
  { slug: "contact", label: "İletişim" },
] as const;

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "İçerik Yönetimi | Dr. Taha Demir" },
      { name: "description", content: "Site metinlerini ve görsellerini düzenleyin." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "İçerik Yönetimi | Dr. Taha Demir" },
      { property: "og:description", content: "Site metinlerini ve görsellerini düzenleyin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Status = { tone: "idle" | "busy" | "ok" | "error"; message: string };

function AdminPage() {
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [page, setPage] = useState<string>("index");
  const [lang, setLang] = useState<string>("tr");
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ tone: "idle", message: "" });

  const [images, setImages] = useState<{ slot: string; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<string | null>(null);
  const pickImage = (slot: string) => {
    pendingSlot.current = slot;
    fileRef.current?.click();
  };

  const dirtyCount = useMemo(() => Object.keys(dirty).length, [dirty]);
  const frameSrc = `/${page}.html?edit=1&lang=${lang}`;

  const uploadImage = useCallback(async (slot: string, file: File) => {
    setStatus({ tone: "busy", message: "Görsel yükleniyor…" });
    const extension = (file.name.split(".").pop() || "png").toLowerCase().slice(0, 8);
    const path = `${slot}/${Date.now()}.${extension}`;
    const upload = await supabase.storage
      .from("site-media")
      .upload(path, file, { cacheControl: "31536000", upsert: false });
    if (upload.error) {
      setStatus({ tone: "error", message: upload.error.message });
      return;
    }
    try {
      const result = await saveImageSlot({ data: { slot, storagePath: path } });
      frameRef.current?.contentWindow?.postMessage(
        { source: "cms-admin", type: "image-saved", slot, url: result.url },
        "*",
      );
      setStatus({ tone: "ok", message: "Görsel güncellendi." });
    } catch (err) {
      setStatus({
        tone: "error",
        message: err instanceof Error ? err.message : "Görsel kaydedilemedi.",
      });
    }
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.source !== "cms-editor") return;
      if (data.type === "lang-changed" && typeof data.lang === "string") {
        setLang(data.lang);
        return;
      }
      if (data.type === "images" && Array.isArray(data.images)) {
        setImages(data.images);
        return;
      }
      if (data.type === "text") {
        setDirty((prev) => ({ ...prev, [data.key]: data.value }));
      } else if (data.type === "image" && data.file instanceof File) {
        void uploadImage(data.slot, data.file);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [uploadImage]);

  async function handleSave() {
    if (!dirtyCount) return;
    setStatus({ tone: "busy", message: "Kaydediliyor…" });
    try {
      const entries = Object.entries(dirty).map(([key, value]) => ({ key, lang, value }));
      await saveTexts({ data: { entries } });
      setDirty({});
      setStatus({ tone: "ok", message: "Değişiklikler yayında." });
    } catch (err) {
      setStatus({
        tone: "error",
        message: err instanceof Error ? err.message : "Kaydedilemedi.",
      });
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function switchTo(next: { page?: string; lang?: string }) {
    if (dirtyCount && !window.confirm("Kaydedilmemiş değişiklikler var. Devam edilsin mi?")) return;
    setDirty({});
    if (next.page) setPage(next.page);
    if (next.lang) setLang(next.lang);
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-muted">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-3 py-3 sm:px-4 lg:flex lg:flex-wrap">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-sm font-semibold text-card-foreground">İçerik Yönetimi</span>
          <select
            aria-label="Düzenlenecek sayfa"
            value={page}
            onChange={(e) => switchTo({ page: e.target.value })}
            className="min-w-0 max-w-48 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {PAGES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 overflow-hidden rounded-md border border-input">
          {(
            [
              ["ar", "العربية"],
              ["en", "English"],
              ["fr", "Français"],
              ["de", "Deutsch"],
              ["tr", "Türkçe"],
            ] as const
          ).map(([code, label]) => (
            <Button
              key={code}
              type="button"
              variant={lang === code ? "default" : "ghost"}
              size="sm"
              onClick={() => switchTo({ lang: code })}
              className="rounded-none px-2.5"
            >
              {label}
            </Button>
          ))}
        </div>

        <span className="col-span-2 min-w-0 text-xs text-muted-foreground lg:col-auto">
          Metne tıklayıp düzenleyin, görsele tıklayıp değiştirin.
        </span>

        <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-end gap-2 lg:col-auto lg:ml-auto">
          {status.message ? (
            <span
              className={
                "text-xs " +
                (status.tone === "error" ? "text-destructive" : "text-muted-foreground")
              }
            >
              {status.message}
            </span>
          ) : null}
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirtyCount || status.tone === "busy"}
            size="sm"
          >
            <Save aria-hidden="true" />
            Kaydet{dirtyCount ? ` (${dirtyCount})` : ""}
          </Button>
          <a
            href={`/${page}.html`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Siteyi gör
          </a>
          <Button
            type="button"
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            <LogOut aria-hidden="true" />
            Çıkış
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <iframe
          ref={frameRef}
          key={frameSrc}
          src={frameSrc}
          title="Site önizleme"
          className="min-h-0 min-w-0 flex-1 border-0 bg-background"
        />
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-border bg-card p-3 md:block">
          <h2 className="mb-2 text-sm font-semibold text-card-foreground">
            Görseller ({images.length})
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Değiştirmek istediğiniz görselde "Değiştir"e basın.
          </p>
          <ul className="space-y-3">
            {images.map((img) => (
              <li key={img.slot} className="rounded-md border border-border p-2">
                <button
                  type="button"
                  onClick={() =>
                    frameRef.current?.contentWindow?.postMessage(
                      { source: "cms-admin", type: "scroll-to", slot: img.slot },
                      "*",
                    )
                  }
                  className="block w-full"
                  title="Sayfada göster"
                >
                  <img src={img.url} alt={img.slot} className="h-24 w-full rounded object-cover" />
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2 w-full"
                  disabled={status.tone === "busy"}
                  onClick={() => pickImage(img.slot)}
                >
                  <ImagePlus aria-hidden="true" />
                  Değiştir
                </Button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && pendingSlot.current) void uploadImage(pendingSlot.current, file);
        }}
      />
    </div>
  );
}
