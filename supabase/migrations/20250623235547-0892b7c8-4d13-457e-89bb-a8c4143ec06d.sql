
-- Create document_comments table for communication between students and advisors
CREATE TABLE public.document_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for document comments
CREATE POLICY "Users can view comments on documents they have access to"
  ON public.document_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.fyp_projects p ON d.project_id = p.id
      WHERE d.id = document_comments.document_id
      AND (p.student_id = auth.uid() OR p.advisor_id = auth.uid() OR p.project_officer_id = auth.uid())
    )
  );

CREATE POLICY "Users can create comments on documents they have access to"
  ON public.document_comments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.fyp_projects p ON d.project_id = p.id
      WHERE d.id = document_comments.document_id
      AND (p.student_id = auth.uid() OR p.advisor_id = auth.uid() OR p.project_officer_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own comments"
  ON public.document_comments
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON public.document_comments
  FOR DELETE
  USING (user_id = auth.uid());

-- Create an index for better performance
CREATE INDEX idx_document_comments_document_id ON public.document_comments(document_id);
CREATE INDEX idx_document_comments_user_id ON public.document_comments(user_id);
