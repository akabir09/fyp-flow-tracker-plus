
-- Drop all dependent policies and functions with CASCADE to avoid dependency issues
DROP FUNCTION IF EXISTS public.user_has_project_access(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_project_officer() CASCADE;

-- Create simple, non-recursive security definer functions
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.check_project_officer()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN false 
              ELSE EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer') 
         END;
$$;

-- Recreate the user_has_project_access function with proper logic
CREATE OR REPLACE FUNCTION public.user_has_project_access(project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    public.check_project_officer() OR
    EXISTS (
      SELECT 1 FROM public.fyp_projects p
      WHERE p.id = project_id AND (
        p.advisor_id = auth.uid() OR 
        p.project_officer_id = auth.uid()
      )
    ) OR EXISTS (
      SELECT 1 FROM public.project_students ps
      WHERE ps.project_id = project_id AND ps.student_id = auth.uid()
    );
$$;

-- Create simple policies without circular dependencies
CREATE POLICY "Enable read for project participants" ON public.fyp_projects FOR SELECT TO authenticated 
USING (
  advisor_id = auth.uid() OR 
  project_officer_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.project_students WHERE project_id = fyp_projects.id AND student_id = auth.uid()) OR
  public.check_project_officer()
);

CREATE POLICY "Enable insert for project officers" ON public.fyp_projects FOR INSERT TO authenticated 
WITH CHECK (public.check_project_officer());

CREATE POLICY "Enable update for authorized users" ON public.fyp_projects FOR UPDATE TO authenticated 
USING (
  public.check_project_officer() OR 
  advisor_id = auth.uid() OR 
  project_officer_id = auth.uid()
);

-- Update project_students policies
CREATE POLICY "Enable read for related users" ON public.project_students FOR SELECT TO authenticated 
USING (
  student_id = auth.uid() OR
  public.check_project_officer() OR
  EXISTS (
    SELECT 1 FROM public.fyp_projects p 
    WHERE p.id = project_id AND (
      p.advisor_id = auth.uid() OR 
      p.project_officer_id = auth.uid()
    )
  )
);

CREATE POLICY "Enable insert for project officers" ON public.project_students FOR INSERT TO authenticated 
WITH CHECK (public.check_project_officer());

CREATE POLICY "Enable update for project officers" ON public.project_students FOR UPDATE TO authenticated 
USING (public.check_project_officer());

CREATE POLICY "Enable delete for project officers" ON public.project_students FOR DELETE TO authenticated 
USING (public.check_project_officer());

-- Recreate policies for phase_deadlines and phase_chat_messages
CREATE POLICY "Users can view related deadlines" ON public.phase_deadlines FOR SELECT TO authenticated 
USING (public.user_has_project_access(project_id));

CREATE POLICY "Users can view chat messages for projects they have access to" ON public.phase_chat_messages FOR SELECT TO authenticated 
USING (public.user_has_project_access(project_id));

CREATE POLICY "Users can create chat messages for projects they have access to" ON public.phase_chat_messages FOR INSERT TO authenticated 
WITH CHECK (public.user_has_project_access(project_id));
