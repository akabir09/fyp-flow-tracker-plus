
-- Create a table to track uploaded resources
CREATE TABLE public.project_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.project_resources 
ADD CONSTRAINT fk_project_resources_project 
FOREIGN KEY (project_id) REFERENCES public.fyp_projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_resources 
ADD CONSTRAINT fk_project_resources_uploader 
FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Project officers can insert resources for any project
CREATE POLICY "Project officers can upload resources" ON public.project_resources 
FOR INSERT TO authenticated 
WITH CHECK (public.check_project_officer());

-- Project officers can view all resources
CREATE POLICY "Project officers can view all resources" ON public.project_resources 
FOR SELECT TO authenticated 
USING (public.check_project_officer());

-- Advisors can view resources for their supervised projects
CREATE POLICY "Advisors can view project resources" ON public.project_resources 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.fyp_projects p 
    WHERE p.id = project_id AND p.advisor_id = auth.uid()
  )
);

-- Students can view resources for their projects
CREATE POLICY "Students can view project resources" ON public.project_resources 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.project_students ps 
    WHERE ps.project_id = project_id AND ps.student_id = auth.uid()
  )
);

-- Project officers can update/delete resources
CREATE POLICY "Project officers can manage resources" ON public.project_resources 
FOR ALL TO authenticated 
USING (public.check_project_officer());

-- Create the storage bucket for project resources (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-resources', 'project-resources', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Project officers can upload resources" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-resources' 
  AND public.check_project_officer()
);

CREATE POLICY "Authenticated users can view project resources" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'project-resources');

CREATE POLICY "Project officers can manage resource files" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'project-resources' 
  AND public.check_project_officer()
);
