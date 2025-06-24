
-- Create a public storage bucket for FYP documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('fyp-documents', 'fyp-documents', true);

-- Create RLS policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'fyp-documents' 
  AND auth.role() = 'authenticated'
);

-- Create RLS policy to allow authenticated users to view documents
CREATE POLICY "Allow authenticated users to view documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'fyp-documents' 
  AND auth.role() = 'authenticated'
);

-- Create RLS policy to allow users to update their own documents
CREATE POLICY "Allow users to update their own documents" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'fyp-documents' 
  AND auth.uid() = owner::uuid
);

-- Create RLS policy to allow users to delete their own documents
CREATE POLICY "Allow users to delete their own documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'fyp-documents' 
  AND auth.uid() = owner::uuid
);
