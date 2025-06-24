
-- First, let's create the junction table without dropping the student_id column yet
CREATE TABLE IF NOT EXISTS public.project_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.fyp_projects(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, student_id)
);

-- Enable RLS on the new table
ALTER TABLE public.project_students ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for project_students
CREATE POLICY "Users can view related project students" ON public.project_students FOR SELECT TO authenticated 
USING (
  student_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.fyp_projects p 
    WHERE p.id = project_id AND (
      p.advisor_id = auth.uid() OR 
      p.project_officer_id = auth.uid()
    )
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer')
);

CREATE POLICY "Project officers can manage project students" ON public.project_students FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer'));

-- Create a helper function to check if user has access to a project
CREATE OR REPLACE FUNCTION public.user_has_project_access(project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fyp_projects p
    WHERE p.id = project_id AND (
      p.advisor_id = auth.uid() OR 
      p.project_officer_id = auth.uid()
    )
  ) OR EXISTS (
    SELECT 1 FROM public.project_students ps
    WHERE ps.project_id = project_id AND ps.student_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer'
  );
$$;

-- Update RLS policies that depend on student_id to use the new structure
DROP POLICY IF EXISTS "Users can view related projects" ON public.fyp_projects;
CREATE POLICY "Users can view related projects" ON public.fyp_projects FOR SELECT TO authenticated 
USING (
  advisor_id = auth.uid() OR 
  project_officer_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.project_students WHERE project_id = fyp_projects.id AND student_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer')
);

DROP POLICY IF EXISTS "Users can view related deadlines" ON public.phase_deadlines;
CREATE POLICY "Users can view related deadlines" ON public.phase_deadlines FOR SELECT TO authenticated 
USING (public.user_has_project_access(project_id));

DROP POLICY IF EXISTS "Users can view comments on documents they have access to" ON public.document_comments;
CREATE POLICY "Users can view comments on documents they have access to" ON public.document_comments FOR SELECT TO authenticated 
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.documents d 
    JOIN public.fyp_projects p ON d.project_id = p.id
    WHERE d.id = document_id AND (
      p.advisor_id = auth.uid() OR 
      p.project_officer_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_students WHERE project_id = p.id AND student_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Users can create comments on documents they have access to" ON public.document_comments;
CREATE POLICY "Users can create comments on documents they have access to" ON public.document_comments FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents d 
    JOIN public.fyp_projects p ON d.project_id = p.id
    WHERE d.id = document_id AND (
      p.advisor_id = auth.uid() OR 
      p.project_officer_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_students WHERE project_id = p.id AND student_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Users can view chat messages for projects they have access to" ON public.phase_chat_messages;
CREATE POLICY "Users can view chat messages for projects they have access to" ON public.phase_chat_messages FOR SELECT TO authenticated 
USING (public.user_has_project_access(project_id));

DROP POLICY IF EXISTS "Users can create chat messages for projects they have access to" ON public.phase_chat_messages;
CREATE POLICY "Users can create chat messages for projects they have access to" ON public.phase_chat_messages FOR INSERT TO authenticated 
WITH CHECK (public.user_has_project_access(project_id));

-- Migrate existing data from fyp_projects.student_id to project_students table
INSERT INTO public.project_students (project_id, student_id)
SELECT id, student_id 
FROM public.fyp_projects 
WHERE student_id IS NOT NULL
ON CONFLICT (project_id, student_id) DO NOTHING;

-- Now we can safely drop the student_id column
ALTER TABLE public.fyp_projects DROP COLUMN student_id;
