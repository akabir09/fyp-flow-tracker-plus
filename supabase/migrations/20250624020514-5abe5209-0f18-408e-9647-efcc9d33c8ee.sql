
-- Drop the existing project_resources table and recreate without project_id requirement
DROP TABLE IF EXISTS public.project_resources CASCADE;

-- Create a generic resources table
CREATE TABLE public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraint
ALTER TABLE public.resources 
ADD CONSTRAINT fk_resources_uploader 
FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for generic resources
-- Project officers can insert resources
CREATE POLICY "Project officers can upload resources" ON public.resources 
FOR INSERT TO authenticated 
WITH CHECK (public.check_project_officer());

-- All authenticated users can view resources
CREATE POLICY "All users can view resources" ON public.resources 
FOR SELECT TO authenticated 
USING (true);

-- Project officers can update/delete resources
CREATE POLICY "Project officers can manage resources" ON public.resources 
FOR ALL TO authenticated 
USING (public.check_project_officer());

-- Update storage bucket name to be more generic
INSERT INTO storage.buckets (id, name, public)
VALUES ('general-resources', 'general-resources', true)
ON CONFLICT (id) DO NOTHING;

-- Update storage policies for generic resources
DROP POLICY IF EXISTS "Project officers can upload resources" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view project resources" ON storage.objects;
DROP POLICY IF EXISTS "Project officers can manage resource files" ON storage.objects;

CREATE POLICY "Project officers can upload general resources" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'general-resources' 
  AND public.check_project_officer()
);

CREATE POLICY "Authenticated users can view general resources" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'general-resources');

CREATE POLICY "Project officers can manage general resource files" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'general-resources' 
  AND public.check_project_officer()
);
