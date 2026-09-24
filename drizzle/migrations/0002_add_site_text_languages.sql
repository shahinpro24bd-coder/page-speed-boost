ALTER TABLE public.site_texts DROP CONSTRAINT site_texts_lang_check;
ALTER TABLE public.site_texts ADD CONSTRAINT site_texts_lang_check CHECK (lang IN ('tr','en','ar','fr','de'));
COMMENT ON CONSTRAINT site_texts_lang_check ON public.site_texts IS 'Supported site languages: tr, en, ar, fr, de';