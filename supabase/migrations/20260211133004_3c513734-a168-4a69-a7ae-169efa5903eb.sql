INSERT INTO storage.buckets (id, name, public) VALUES ('public-assets', 'public-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for public-assets" ON storage.objects FOR SELECT USING (bucket_id = 'public-assets');
