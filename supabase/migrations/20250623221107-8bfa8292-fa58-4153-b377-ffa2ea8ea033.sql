
-- Add notification type enum to categorize different types of notifications
CREATE TYPE public.notification_type AS ENUM (
  'project_assignment',
  'document_submission',
  'document_review',
  'deadline_reminder',
  'project_update',
  'system_announcement'
);

-- Add notification_type column to notifications table
ALTER TABLE public.notifications 
ADD COLUMN notification_type notification_type DEFAULT 'system_announcement';

-- Add target_role column to specify which role the notification is intended for
ALTER TABLE public.notifications 
ADD COLUMN target_role user_role;

-- Update the create_notification function to include notification type and target role
CREATE OR REPLACE FUNCTION public.create_notification(
  user_id UUID,
  title TEXT,
  message TEXT,
  notification_type notification_type DEFAULT 'system_announcement',
  target_role user_role DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, notification_type, target_role)
  VALUES (user_id, title, message, notification_type, target_role)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to send notifications to all users of a specific role
CREATE OR REPLACE FUNCTION public.notify_role(
  role_name user_role,
  title TEXT,
  message TEXT,
  notification_type notification_type DEFAULT 'system_announcement'
)
RETURNS INTEGER AS $$
DECLARE
  user_record RECORD;
  notification_count INTEGER := 0;
BEGIN
  FOR user_record IN 
    SELECT id FROM public.profiles WHERE role = role_name
  LOOP
    PERFORM public.create_notification(
      user_record.id, 
      title, 
      message, 
      notification_type, 
      role_name
    );
    notification_count := notification_count + 1;
  END LOOP;
  
  RETURN notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
