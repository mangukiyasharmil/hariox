-- Create assets storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public access to assets
CREATE POLICY "Public access to assets" ON storage.objects
FOR SELECT USING (bucket_id = 'assets');