
-- Create a table for general chat messages in project phases
CREATE TABLE public.phase_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.fyp_projects(id) ON DELETE CASCADE NOT NULL,
  phase TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.phase_chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for phase chat messages
CREATE POLICY "Users can view chat messages for projects they have access to"
  ON public.phase_chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fyp_projects p
      WHERE p.id = phase_chat_messages.project_id
      AND (p.student_id = auth.uid() OR p.advisor_id = auth.uid() OR p.project_officer_id = auth.uid())
    )
  );

CREATE POLICY "Users can create chat messages for projects they have access to"
  ON public.phase_chat_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.fyp_projects p
      WHERE p.id = phase_chat_messages.project_id
      AND (p.student_id = auth.uid() OR p.advisor_id = auth.uid() OR p.project_officer_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own chat messages"
  ON public.phase_chat_messages
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own chat messages"
  ON public.phase_chat_messages
  FOR DELETE
  USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_phase_chat_messages_project_phase ON public.phase_chat_messages(project_id, phase);
CREATE INDEX idx_phase_chat_messages_created_at ON public.phase_chat_messages(created_at);

-- Enable realtime for the chat messages table
ALTER TABLE public.phase_chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.phase_chat_messages;
