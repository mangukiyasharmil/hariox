-- Create public-assets storage bucket for blog images
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view public assets
CREATE POLICY "Public assets are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'public-assets');

-- Policy: Authenticated users can upload
CREATE POLICY "Authenticated users can upload public assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'public-assets' AND auth.role() = 'authenticated');

-- Policy: Authenticated users can update their uploads  
CREATE POLICY "Authenticated users can update public assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'public-assets' AND auth.role() = 'authenticated');

-- Policy: Authenticated users can delete
CREATE POLICY "Authenticated users can delete public assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'public-assets' AND auth.role() = 'authenticated');