
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type NotificationType = Database['public']['Enums']['notification_type'];
type UserRole = Database['public']['Enums']['user_role'];

export class NotificationService {
  // Send notification to a specific user
  static async sendToUser(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = 'system_announcement',
    targetRole?: UserRole
  ) {
    try {
      const { error } = await supabase.rpc('create_notification', {
        user_id: userId,
        title,
        message,
        notification_type: type,
        target_role: targetRole
      });
      
      if (error) {
        console.error('Error sending notification to user:', error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  // Send notification to all users of a specific role
  static async sendToRole(
    role: UserRole,
    title: string,
    message: string,
    type: NotificationType = 'system_announcement'
  ) {
    try {
      const { error } = await supabase.rpc('notify_role', {
        role_name: role,
        title,
        message,
        notification_type: type
      });
      
      if (error) {
        console.error('Error sending notification to role:', error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to send role notification:', error);
    }
  }

  // Project-specific notifications
  static async notifyProjectAssignment(projectTitle: string, studentIds: string[], advisorId?: string) {
    // Notify students
    for (const studentId of studentIds) {
      await this.sendToUser(
        studentId,
        'New Project Assignment',
        `You have been assigned to the project: ${projectTitle}`,
        'project_assignment',
        'student'
      );
    }

    // Notify advisor if assigned
    if (advisorId) {
      await this.sendToUser(
        advisorId,
        'New Project Assignment',
        `You have been assigned as advisor for the project: ${projectTitle}`,
        'project_assignment',
        'advisor'
      );
    }

    // Notify all project officers about new project creation
    await this.sendToRole(
      'project_officer',
      'New Project Created',
      `A new project "${projectTitle}" has been created and assigned`,
      'project_update'
    );
  }

  static async notifyDocumentSubmission(projectTitle: string, documentTitle: string, submitterId: string, advisorId?: string) {
    // Notify advisor about document submission
    if (advisorId) {
      await this.sendToUser(
        advisorId,
        'New Document Submission',
        `A new document "${documentTitle}" has been submitted for project: ${projectTitle}`,
        'document_submission',
        'advisor'
      );
    }

    // Notify project officers about document submission
    await this.sendToRole(
      'project_officer',
      'Document Submitted',
      `Document "${documentTitle}" has been submitted for project: ${projectTitle}`,
      'document_submission'
    );

    // Confirm submission to student
    await this.sendToUser(
      submitterId,
      'Document Submitted Successfully',
      `Your document "${documentTitle}" has been submitted for review`,
      'document_submission',
      'student'
    );
  }

  static async notifyDocumentReview(projectTitle: string, documentTitle: string, status: string, studentId: string, advisorId: string) {
    const statusText = status === 'approved' ? 'approved' : 'rejected';
    
    // Notify student about review result
    await this.sendToUser(
      studentId,
      `Document ${statusText}`,
      `Your document "${documentTitle}" for project "${projectTitle}" has been ${statusText}`,
      'document_review',
      'student'
    );

    // Notify project officers about review completion
    await this.sendToRole(
      'project_officer',
      'Document Reviewed',
      `Document "${documentTitle}" for project "${projectTitle}" has been ${statusText} by advisor`,
      'document_review'
    );
  }

  static async notifyDeadlineUpdate(projectTitle: string, phase: string, deadlineDate: string, studentIds: string[], advisorId?: string) {
    const message = `Phase ${phase} deadline for project "${projectTitle}" has been set to ${deadlineDate}`;
    
    // Notify students
    for (const studentId of studentIds) {
      await this.sendToUser(
        studentId,
        'Deadline Updated',
        message,
        'deadline_reminder',
        'student'
      );
    }

    // Notify advisor
    if (advisorId) {
      await this.sendToUser(
        advisorId,
        'Deadline Updated',
        message,
        'deadline_reminder',
        'advisor'
      );
    }
  }

  static async notifyProjectUpdate(title: string, message: string, projectId: string) {
    // Get project details to notify relevant users
    const { data: project } = await supabase
      .from('fyp_projects')
      .select('title, student_id, advisor_id')
      .eq('id', projectId)
      .single();

    if (project) {
      // Notify student
      if (project.student_id) {
        await this.sendToUser(
          project.student_id,
          title,
          message,
          'project_update',
          'student'
        );
      }

      // Notify advisor
      if (project.advisor_id) {
        await this.sendToUser(
          project.advisor_id,
          title,
          message,
          'project_update',
          'advisor'
        );
      }

      // Notify all project officers
      await this.sendToRole(
        'project_officer',
        title,
        message,
        'project_update'
      );
    }
  }
}
