
-- Create enum types for the system
CREATE TYPE public.user_role AS ENUM ('student', 'advisor', 'project_officer');
CREATE TYPE public.fyp_phase AS ENUM ('phase1', 'phase2', 'phase3', 'phase4');
CREATE TYPE public.document_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.project_status AS ENUM ('active', 'completed', 'suspended');

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create FYP projects table
CREATE TABLE public.fyp_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  advisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status project_status DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create phase deadlines table
CREATE TABLE public.phase_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.fyp_projects(id) ON DELETE CASCADE,
  phase fyp_phase NOT NULL,
  deadline_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, phase)
);

-- Create documents table for submissions
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.fyp_projects(id) ON DELETE CASCADE,
  phase fyp_phase NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status document_status DEFAULT 'pending',
  advisor_feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fyp_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Create RLS policies for FYP projects
CREATE POLICY "Users can view related projects" ON public.fyp_projects FOR SELECT TO authenticated 
USING (
  student_id = auth.uid() OR 
  advisor_id = auth.uid() OR 
  project_officer_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer')
);

CREATE POLICY "Project officers can insert projects" ON public.fyp_projects FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer'));

CREATE POLICY "Project officers can update projects" ON public.fyp_projects FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer'));

-- Create RLS policies for phase deadlines
CREATE POLICY "Users can view related deadlines" ON public.phase_deadlines FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.fyp_projects p 
    WHERE p.id = project_id AND (
      p.student_id = auth.uid() OR 
      p.advisor_id = auth.uid() OR 
      p.project_officer_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer')
    )
  )
);

CREATE POLICY "Project officers can manage deadlines" ON public.phase_deadlines FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer'));

-- Create RLS policies for documents
CREATE POLICY "Users can view related documents" ON public.documents FOR SELECT TO authenticated 
USING (
  submitted_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.fyp_projects p 
    WHERE p.id = project_id AND (
      p.advisor_id = auth.uid() OR 
      p.project_officer_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer')
    )
  )
);

CREATE POLICY "Students can insert documents" ON public.documents FOR INSERT TO authenticated 
WITH CHECK (
  submitted_by = auth.uid() AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
);

CREATE POLICY "Advisors can update document status" ON public.documents FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.fyp_projects p 
    WHERE p.id = project_id AND p.advisor_id = auth.uid()
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'project_officer')
);

-- Create RLS policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to automatically create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  user_id UUID,
  title TEXT,
  message TEXT
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message)
  VALUES (user_id, title, message)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
