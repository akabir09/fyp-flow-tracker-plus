
-- Drop the existing document policies to recreate them with proper review logic
DROP POLICY IF EXISTS "Users can view related documents" ON public.documents;
DROP POLICY IF EXISTS "Students can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Advisors can update document status" ON public.documents;

-- Create new policies with proper review request logic
-- Students can always view their own documents
CREATE POLICY "Students can view their own documents" ON public.documents FOR SELECT TO authenticated 
USING (submitted_by = auth.uid());

-- Advisors can only view documents that have been submitted for review (status = 'pending' or already reviewed)
CREATE POLICY "Advisors can view submitted documents" ON public.documents FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.fyp_projects p 
    WHERE p.id = project_id AND p.advisor_id = auth.uid()
  ) AND status IN ('pending', 'approved', 'rejected')
);

-- Project officers can view all documents
CREATE POLICY "Project officers can view all documents" ON public.documents FOR SELECT TO authenticated 
USING (public.check_project_officer());

-- Students can insert documents (but they start as draft until submitted for review)
CREATE POLICY "Students can insert documents" ON public.documents FOR INSERT TO authenticated 
WITH CHECK (
  submitted_by = auth.uid() AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
);

-- Only advisors and project officers can update document status (approve/reject)
CREATE POLICY "Advisors can update document status" ON public.documents FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.fyp_projects p 
    WHERE p.id = project_id AND p.advisor_id = auth.uid()
  ) OR
  public.check_project_officer()
);

-- Students can update their own documents only if not yet submitted for review
CREATE POLICY "Students can update draft documents" ON public.documents FOR UPDATE TO authenticated 
USING (
  submitted_by = auth.uid() AND 
  status = 'pending'
);
