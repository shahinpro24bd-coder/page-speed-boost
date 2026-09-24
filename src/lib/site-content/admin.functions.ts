import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const langSchema = z.enum(["tr", "en", "ar", "fr", "de"]);

const saveTextsSchema = z.object({
  entries: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        lang: langSchema,
        value: z.string().max(20000),
      }),
    )
    .min(1)
    .max(500),
});

const saveImageSchema = z.object({
  slot: z.string().min(1).max(120),
  storagePath: z.string().min(1).max(400),
});

const bootstrapSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(200),
});

/** Throws unless the caller is signed in AND holds the admin role. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/** Public: tells the sign-in page whether the very first admin still has to be created. */
export const getAdminSetupState = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { hasAdmin: (count ?? 0) > 0 };
});

/**
 * Creates the first administrator. Refuses to run once one exists, so it cannot
 * be used to grant anyone else access later on.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bootstrapSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An administrator already exists.");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Could not create the account.");
    }

    const granted = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.data.user.id, role: "admin" });
    if (granted.error) throw new Error(granted.error.message);

    return { ok: true };
  });

/** Saves edited copy. Values are stored per language, keyed by content key. */
export const saveTexts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveTextsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { invalidateContentCache } = await import("./server");

    const { error } = await context.supabase.from("site_texts").upsert(
      data.entries.map((e) => ({ key: e.key, lang: e.lang, value: e.value })),
      { onConflict: "key,lang" },
    );
    if (error) throw new Error(error.message);

    invalidateContentCache();
    return { saved: data.entries.length };
  });

/** Points an image slot at a file that was just uploaded to the media bucket. */
export const saveImageSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveImageSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { invalidateContentCache } = await import("./server");

    const url = `/api/public/media/${data.storagePath}`;
    const { error } = await context.supabase
      .from("site_images")
      .upsert(
        { slot: data.slot, url, storage_path: data.storagePath, updated_at: new Date().toISOString() },
        { onConflict: "slot" },
      );
    if (error) throw new Error(error.message);

    invalidateContentCache();
    return { url };
  });
