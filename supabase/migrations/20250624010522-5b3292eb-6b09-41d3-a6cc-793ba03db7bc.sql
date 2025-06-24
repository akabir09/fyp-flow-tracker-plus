
-- Enable RLS on document_comments table if not already enabled
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;

-- Allow users to view all general comments (where document_id is null)
CREATE POLICY "Users can view general comments" 
  ON public.document_comments 
  FOR SELECT 
  USING (document_id IS NULL);

-- Allow authenticated users to create general comments
CREATE POLICY "Authenticated users can create general comments" 
  ON public.document_comments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id AND document_id IS NULL);

-- Allow users to update their own general comments
CREATE POLICY "Users can update their own general comments" 
  ON public.document_comments 
  FOR UPDATE 
  USING (auth.uid() = user_id AND document_id IS NULL);

-- Allow users to delete their own general comments
CREATE POLICY "Users can delete their own general comments" 
  ON public.document_comments 
  FOR DELETE 
  USING (auth.uid() = user_id AND document_id IS NULL);
