import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAdmin, getAdminSetupState } from "@/lib/site-content/admin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Yönetici Girişi | Dr. Taha Demir" },
      { name: "description", content: "Dr. Taha Demir web sitesi içerik yönetimi girişi." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Yönetici Girişi | Dr. Taha Demir" },
      { property: "og:description", content: "Site içeriğini düzenlemek için giriş yapın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAdminSetupState()
      .then((s) => active && setNeedsSetup(!s.hasAdmin))
      .catch(() => active && setNeedsSetup(false));
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const u = username.trim().toLowerCase();
    const email = u.includes("@") ? u : `${u}@app.local`;
    try {
      if (needsSetup) {
        await bootstrapAdmin({ data: { email, password } });
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      setError(err instanceof Error && /invalid/i.test(err.message) ? "Kullanıcı adı veya şifre hatalı." : err instanceof Error ? err.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg"
      >
        <h1 className="text-xl font-semibold text-card-foreground">
          {needsSetup ? "Yönetici hesabı oluştur" : "Yönetici girişi"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {needsSetup
            ? "İlk yönetici hesabını burada oluşturun. Bu adım yalnızca bir kez yapılır."
            : "Site içeriğini düzenlemek için giriş yapın."}
        </p>

        <label className="mt-6 block text-sm font-medium text-card-foreground" htmlFor="username">
          Kullanıcı adı
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          required
          maxLength={255}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mt-4 block text-sm font-medium text-card-foreground" htmlFor="password">
          Şifre
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          maxLength={200}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={busy || needsSetup === null}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Lütfen bekleyin…" : needsSetup ? "Hesabı oluştur" : "Giriş yap"}
        </button>
      </form>
    </main>
  );
}
