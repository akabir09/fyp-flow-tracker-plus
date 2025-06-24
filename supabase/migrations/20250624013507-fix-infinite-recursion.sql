
-- Fix infinite recursion in RLS policies by creating security definer functions

-- Create a security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Create a security definer function to check if user is project officer
CREATE OR REPLACE FUNCTION public.is_project_officer()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer');
$$;

-- Update the fyp_projects RLS policy to avoid recursion
DROP POLICY IF EXISTS "Users can view related projects" ON public.fyp_projects;
CREATE POLICY "Users can view related projects" ON public.fyp_projects FOR SELECT TO authenticated 
USING (
  advisor_id = auth.uid() OR 
  project_officer_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.project_students WHERE project_id = fyp_projects.id AND student_id = auth.uid()) OR
  public.is_project_officer()
);

-- Create policy for project officers to insert projects
DROP POLICY IF EXISTS "Project officers can create projects" ON public.fyp_projects;
CREATE POLICY "Project officers can create projects" ON public.fyp_projects FOR INSERT TO authenticated 
WITH CHECK (public.is_project_officer());

-- Create policy for project officers to update projects
DROP POLICY IF EXISTS "Project officers can update projects" ON public.fyp_projects;
CREATE POLICY "Project officers can update projects" ON public.fyp_projects FOR UPDATE TO authenticated 
USING (public.is_project_officer() OR advisor_id = auth.uid() OR project_officer_id = auth.uid());

-- Update project_students policies to avoid recursion
DROP POLICY IF EXISTS "Users can view related project students" ON public.project_students;
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
  public.is_project_officer()
);

-- Update the user_has_project_access function to use security definer functions
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
  ) OR public.is_project_officer();
$$;
