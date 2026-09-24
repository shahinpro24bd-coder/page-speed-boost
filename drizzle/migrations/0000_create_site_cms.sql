-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Text content
CREATE TABLE public.site_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  lang text NOT NULL CHECK (lang IN ('tr','en')),
  value text NOT NULL DEFAULT '',
  page text NOT NULL DEFAULT 'common',
  kind text NOT NULL DEFAULT 'text',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, lang)
);

CREATE INDEX site_texts_page_idx ON public.site_texts (page);

GRANT SELECT ON public.site_texts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_texts TO authenticated;
GRANT ALL ON public.site_texts TO service_role;
ALTER TABLE public.site_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read texts"
  ON public.site_texts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert texts"
  ON public.site_texts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update texts"
  ON public.site_texts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete texts"
  ON public.site_texts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Image slots
CREATE TABLE public.site_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL UNIQUE,
  url text NOT NULL,
  storage_path text,
  page text NOT NULL DEFAULT 'common',
  label text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_images TO authenticated;
GRANT ALL ON public.site_images TO service_role;
ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read images"
  ON public.site_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert images"
  ON public.site_images FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update images"
  ON public.site_images FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete images"
  ON public.site_images FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Per-page SEO
CREATE TABLE public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  path text NOT NULL,
  title_key text NOT NULL,
  description_key text NOT NULL,
  keywords_key text,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
GRANT ALL ON public.site_pages TO service_role;
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read pages"
  ON public.site_pages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can write pages"
  ON public.site_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Content version stamp for cache busting
CREATE TABLE public.site_content_version (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.site_content_version (id, version) VALUES (1, 1);

GRANT SELECT ON public.site_content_version TO anon;
GRANT SELECT ON public.site_content_version TO authenticated;
GRANT ALL ON public.site_content_version TO service_role;
ALTER TABLE public.site_content_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read version"
  ON public.site_content_version FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.bump_content_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.site_content_version
    SET version = version + 1, updated_at = now() WHERE id = 1;
  RETURN NULL;
END;
$$;

CREATE TRIGGER site_texts_bump AFTER INSERT OR UPDATE OR DELETE ON public.site_texts
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version();
CREATE TRIGGER site_images_bump AFTER INSERT OR UPDATE OR DELETE ON public.site_images
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version();
CREATE TRIGGER site_pages_bump AFTER INSERT OR UPDATE OR DELETE ON public.site_pages
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version();