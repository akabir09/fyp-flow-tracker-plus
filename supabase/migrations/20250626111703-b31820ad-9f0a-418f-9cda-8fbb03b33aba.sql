
-- Create function to notify advisor when student uploads document
CREATE OR REPLACE FUNCTION notify_advisor_document_upload()
RETURNS TRIGGER AS $$
DECLARE
  advisor_id UUID;
  project_title TEXT;
BEGIN
  -- Get advisor ID and project title
  SELECT p.advisor_id, p.title INTO advisor_id, project_title
  FROM fyp_projects p
  WHERE p.id = NEW.project_id;
  
  -- Only notify if there's an advisor assigned
  IF advisor_id IS NOT NULL THEN
    PERFORM create_notification(
      advisor_id,
      'New Document Submitted',
      'A student has uploaded "' || NEW.title || '" for project "' || project_title || '" and is awaiting your review.',
      'document_submission'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to notify advisor when student sends chat message
CREATE OR REPLACE FUNCTION notify_advisor_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  advisor_id UUID;
  student_name TEXT;
  project_title TEXT;
BEGIN
  -- Get advisor ID, student name, and project title
  SELECT p.advisor_id, p.title, pr.full_name 
  INTO advisor_id, project_title, student_name
  FROM fyp_projects p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.project_id;
  
  -- Only notify if there's an advisor assigned and message is from student
  IF advisor_id IS NOT NULL AND advisor_id != NEW.user_id THEN
    PERFORM create_notification(
      advisor_id,
      'New Chat Message',
      student_name || ' sent a message in project "' || project_title || '"',
      'project_update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to notify student when document is reviewed
CREATE OR REPLACE FUNCTION notify_student_document_review()
RETURNS TRIGGER AS $$
DECLARE
  student_id UUID;
  project_title TEXT;
  status_text TEXT;
BEGIN
  -- Only trigger when status changes to approved or rejected
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    -- Get student ID and project title
    SELECT ps.student_id, p.title INTO student_id, project_title
    FROM fyp_projects p
    JOIN project_students ps ON ps.project_id = p.id
    WHERE p.id = NEW.project_id;
    
    -- Set status text
    status_text := CASE 
      WHEN NEW.status = 'approved' THEN 'approved'
      WHEN NEW.status = 'rejected' THEN 'rejected'
    END;
    
    -- Notify student
    IF student_id IS NOT NULL THEN
      PERFORM create_notification(
        student_id,
        'Document Review Complete',
        'Your document "' || NEW.title || '" has been ' || status_text || ' for project "' || project_title || '"',
        'document_review'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to notify student when advisor sends chat message
CREATE OR REPLACE FUNCTION notify_student_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  student_id UUID;
  advisor_name TEXT;
  project_title TEXT;
BEGIN
  -- Get student ID, advisor name, and project title
  SELECT ps.student_id, p.title, pr.full_name 
  INTO student_id, project_title, advisor_name
  FROM fyp_projects p
  JOIN project_students ps ON ps.project_id = p.id
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.project_id;
  
  -- Only notify if message is from advisor to student
  IF student_id IS NOT NULL AND student_id != NEW.user_id THEN
    PERFORM create_notification(
      student_id,
      'New Chat Message',
      advisor_name || ' sent a message in project "' || project_title || '"',
      'project_update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to notify students when deadline is updated
CREATE OR REPLACE FUNCTION notify_students_deadline_update()
RETURNS TRIGGER AS $$
DECLARE
  student_record RECORD;
  project_title TEXT;
  phase_name TEXT;
BEGIN
  -- Get project title
  SELECT title INTO project_title FROM fyp_projects WHERE id = NEW.project_id;
  
  -- Format phase name
  phase_name := CASE NEW.phase
    WHEN 'phase1' THEN 'Phase 1'
    WHEN 'phase2' THEN 'Phase 2'
    WHEN 'phase3' THEN 'Phase 3'
    WHEN 'phase4' THEN 'Phase 4'
  END;
  
  -- Notify all students in the project
  FOR student_record IN 
    SELECT ps.student_id
    FROM project_students ps
    WHERE ps.project_id = NEW.project_id
  LOOP
    PERFORM create_notification(
      student_record.student_id,
      'Deadline Updated',
      'The deadline for ' || phase_name || ' of project "' || project_title || '" has been updated to ' || NEW.deadline_date::TEXT,
      'deadline_reminder'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to notify project officer when document is approved
CREATE OR REPLACE FUNCTION notify_project_officer_approval()
RETURNS TRIGGER AS $$
DECLARE
  officer_id UUID;
  project_title TEXT;
BEGIN
  -- Only trigger when status changes to approved
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    -- Get project officer ID and project title
    SELECT p.project_officer_id, p.title INTO officer_id, project_title
    FROM fyp_projects p
    WHERE p.id = NEW.project_id;
    
    -- Notify project officer
    IF officer_id IS NOT NULL THEN
      PERFORM create_notification(
        officer_id,
        'Document Approved',
        'Document "' || NEW.title || '" has been approved by advisor for project "' || project_title || '"',
        'document_review'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for document submissions
CREATE TRIGGER trigger_notify_advisor_document_upload
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION notify_advisor_document_upload();

-- Create triggers for chat messages to advisor
CREATE TRIGGER trigger_notify_advisor_chat
  AFTER INSERT ON phase_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_advisor_chat_message();

-- Create triggers for document reviews
CREATE TRIGGER trigger_notify_student_document_review
  AFTER UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION notify_student_document_review();

-- Create triggers for chat messages to student
CREATE TRIGGER trigger_notify_student_chat
  AFTER INSERT ON phase_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_student_chat_message();

-- Create triggers for deadline updates
CREATE TRIGGER trigger_notify_students_deadline_update
  AFTER INSERT OR UPDATE ON phase_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION notify_students_deadline_update();

-- Create triggers for project officer notifications
CREATE TRIGGER trigger_notify_project_officer_approval
  AFTER UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION notify_project_officer_approval();
