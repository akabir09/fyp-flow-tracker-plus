import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, FileText, MessageSquare, Download, Calendar, User, AlertCircle, Edit, Save, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface ProjectDetailsViewProps {
  projectId: string;
  onBack: () => void;
}

interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  student: {
    full_name: string;
    email: string;
  } | null;
  advisor: {
    full_name: string;
    email: string;
  } | null;
}

interface Document {
  id: string;
  title: string;
  phase: string;
  status: string;
  file_url: string;
  submitted_at: string;
  reviewed_at: string;
  advisor_feedback: string;
  submitted_by: string;
  reviewer: {
    full_name: string;
    email: string;
  } | null;
}

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user: {
    full_name: string;
    email: string;
    role: string;
  };
  document: {
    title: string;
    phase: string;
  };
}

interface PhaseStats {
  phase: string;
  totalSubmissions: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  commentsCount: number;
}

interface PhaseDeadline {
  id: string;
  phase: string;
  deadline_date: string;
  project_id: string;
}

const ProjectDetailsView = ({ projectId, onBack }: ProjectDetailsViewProps) => {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [phaseStats, setPhaseStats] = useState<PhaseStats[]>([]);
  const [phaseDeadlines, setPhaseDeadlines] = useState<PhaseDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    phase1Deadline: '',
    phase2Deadline: '',
    phase3Deadline: '',
    phase4Deadline: ''
  });
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      // Fetch project details
      const { data: projectData } = await supabase
        .from('fyp_projects')
        .select(`
          *,
          student:profiles!student_id(full_name, email),
          advisor:profiles!advisor_id(full_name, email)
        `)
        .eq('id', projectId)
        .single();

      setProject(projectData);

      // Fetch phase deadlines
      const { data: deadlinesData } = await supabase
        .from('phase_deadlines')
        .select('*')
        .eq('project_id', projectId)
        .order('phase');

      setPhaseDeadlines(deadlinesData || []);

      // Set edit form with current project data
      if (projectData) {
        const deadlineMap = (deadlinesData || []).reduce((acc, deadline) => {
          acc[deadline.phase] = deadline.deadline_date;
          return acc;
        }, {} as Record<string, string>);

        setEditForm({
          title: projectData.title || '',
          description: projectData.description || '',
          phase1Deadline: deadlineMap.phase1 || '',
          phase2Deadline: deadlineMap.phase2 || '',
          phase3Deadline: deadlineMap.phase3 || '',
          phase4Deadline: deadlineMap.phase4 || ''
        });
      }

      // Fetch documents
      const { data: documentsData } = await supabase
        .from('documents')
        .select(`
          *,
          reviewer:profiles!reviewed_by(full_name, email)
        `)
        .eq('project_id', projectId)
        .order('submitted_at', { ascending: false });

      setDocuments(documentsData || []);

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('document_comments')
        .select(`
          *,
          user:profiles!user_id(full_name, email, role),
          document:documents!document_id(title, phase)
        `)
        .eq('documents.project_id', projectId)
        .order('created_at', { ascending: false });

      setComments(commentsData || []);

      // Calculate phase statistics
      calculatePhaseStats(documentsData || [], commentsData || []);
    } catch (error) {
      console.error('Error fetching project details:', error);
      toast.error('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const calculatePhaseStats = (docs: Document[], comments: Comment[]) => {
    const phases = ['phase1', 'phase2', 'phase3', 'phase4'];
    const stats = phases.map(phase => {
      const phaseDocs = docs.filter(doc => doc.phase === phase);
      const phaseComments = comments.filter(comment => comment.document?.phase === phase);
      
      return {
        phase,
        totalSubmissions: phaseDocs.length,
        approvedCount: phaseDocs.filter(doc => doc.status === 'approved').length,
        rejectedCount: phaseDocs.filter(doc => doc.status === 'rejected').length,
        pendingCount: phaseDocs.filter(doc => doc.status === 'pending').length,
        commentsCount: phaseComments.length
      };
    });
    
    setPhaseStats(stats);
  };

  const handleDownloadDocument = async (doc: Document) => {
    if (!doc.file_url) {
      toast.error('No file available for download');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = doc.file_url;
      link.download = `${doc.title}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSaveProject = async () => {
    try {
      // Update project details
      const { error: projectError } = await supabase
        .from('fyp_projects')
        .update({
          title: editForm.title,
          description: editForm.description
        })
        .eq('id', projectId);

      if (projectError) throw projectError;

      // Update phase deadlines
      const phases: ('phase1' | 'phase2' | 'phase3' | 'phase4')[] = ['phase1', 'phase2', 'phase3', 'phase4'];
      const deadlines = [
        editForm.phase1Deadline,
        editForm.phase2Deadline,
        editForm.phase3Deadline,
        editForm.phase4Deadline
      ];

      for (let i = 0; i < phases.length; i++) {
        const existingDeadline = phaseDeadlines.find(d => d.phase === phases[i]);
        
        if (existingDeadline) {
          // Update existing deadline
          await supabase
            .from('phase_deadlines')
            .update({ deadline_date: deadlines[i] })
            .eq('id', existingDeadline.id);
        } else {
          // Insert new deadline
          await supabase
            .from('phase_deadlines')
            .insert({
              project_id: projectId,
              phase: phases[i],
              deadline_date: deadlines[i]
            });
        }
      }

      toast.success('Project updated successfully');
      setIsEditing(false);
      fetchProjectDetails();
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !profile) {
      toast.error('Please enter a comment');
      return;
    }

    setIsSubmittingComment(true);
    try {
      // For project-level comments, we'll need to create a general comment
      // Since we don't have a project_comments table, we'll use document_comments with a null document_id
      const { error } = await supabase
        .from('document_comments')
        .insert({
          comment: newComment.trim(),
          user_id: profile.id,
          document_id: null // This indicates it's a project-level comment
        });

      if (error) throw error;

      setNewComment('');
      toast.success('Comment added successfully');
      fetchProjectDetails(); // Refresh to show new comment
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast.error('Failed to submit comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const getUserInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'student':
        return 'bg-blue-500';
      case 'advisor':
        return 'bg-green-500';
      case 'project_officer':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getMessageAlignment = (userId: string) => {
    return userId === profile?.id ? 'flex-row-reverse' : 'flex-row';
  };

  const getMessageBgColor = (userId: string, role: string) => {
    if (userId === profile?.id) {
      return 'bg-blue-500 text-white';
    }
    
    switch (role) {
      case 'advisor':
        return 'bg-green-100 text-green-800';
      case 'project_officer':
        return 'bg-purple-100 text-purple-800';
      case 'student':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">Loading project details...</div>;
  }

  if (!project) {
    return <div className="text-center py-8">Project not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
            <p className="text-gray-600">Project Details & Analytics</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Project
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button onClick={handleSaveProject}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Project Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Project Title</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="Enter project title"
                  />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Status</h4>
                  <Badge className={getStatusBadgeColor(project.status)}>
                    {project.status}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description">Project Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Enter project description"
                  rows={4}
                />
              </div>

              {/* Phase Deadlines Editing */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Phase Deadlines</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-phase1">Phase 1 Deadline</Label>
                    <Input
                      id="edit-phase1"
                      type="date"
                      value={editForm.phase1Deadline}
                      onChange={(e) => setEditForm({ ...editForm, phase1Deadline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phase2">Phase 2 Deadline</Label>
                    <Input
                      id="edit-phase2"
                      type="date"
                      value={editForm.phase2Deadline}
                      onChange={(e) => setEditForm({ ...editForm, phase2Deadline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phase3">Phase 3 Deadline</Label>
                    <Input
                      id="edit-phase3"
                      type="date"
                      value={editForm.phase3Deadline}
                      onChange={(e) => setEditForm({ ...editForm, phase3Deadline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phase4">Phase 4 Deadline</Label>
                    <Input
                      id="edit-phase4"
                      type="date"
                      value={editForm.phase4Deadline}
                      onChange={(e) => setEditForm({ ...editForm, phase4Deadline: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Student</h4>
                  <p className="text-sm text-gray-600">
                    {project.student ? `${project.student.full_name} (${project.student.email})` : 'Not assigned'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Advisor</h4>
                  <p className="text-sm text-gray-600">
                    {project.advisor ? `${project.advisor.full_name} (${project.advisor.email})` : 'Not assigned'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Status</h4>
                  <Badge className={getStatusBadgeColor(project.status)}>
                    {project.status}
                  </Badge>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-sm text-gray-600">{project.description || 'No description provided'}</p>
              </div>
              
              {/* Phase Deadlines Display */}
              {phaseDeadlines.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Phase Deadlines</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {phaseDeadlines.map((deadline) => (
                      <div key={deadline.id} className="border rounded-lg p-3">
                        <h5 className="font-medium text-sm text-gray-900 mb-1 capitalize">
                          {deadline.phase.replace('phase', 'Phase ')}
                        </h5>
                        <p className="text-sm text-gray-600">
                          {format(new Date(deadline.deadline_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Phase Overview</CardTitle>
          <CardDescription>Summary of submissions and feedback across all phases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {phaseStats.map((stat) => (
              <div key={stat.phase} className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2 capitalize">
                  {stat.phase.replace('phase', 'Phase ')}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Submissions:</span>
                    <span className="font-medium">{stat.totalSubmissions}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Approved:</span>
                    <span className="font-medium">{stat.approvedCount}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Rejected:</span>
                    <span className="font-medium">{stat.rejectedCount}</span>
                  </div>
                  <div className="flex justify-between text-yellow-600">
                    <span>Pending:</span>
                    <span className="font-medium">{stat.pendingCount}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>Comments:</span>
                    <span className="font-medium">{stat.commentsCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Documents</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>All Document Submissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Reviewed</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell className="capitalize">
                        {doc.phase.replace('phase', 'Phase ')}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(doc.status)}>
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(doc.submitted_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {doc.reviewed_at ? format(new Date(doc.reviewed_at), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {doc.advisor_feedback || '-'}
                      </TableCell>
                      <TableCell>
                        {doc.file_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>Project Discussion</span>
              </CardTitle>
              <CardDescription>
                General discussion and comments about this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Comments Display */}
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {comments
                  .filter(comment => !comment.document) // Only show project-level comments
                  .map((comment) => (
                    <div
                      key={comment.id}
                      className={`flex items-start space-x-3 ${getMessageAlignment(comment.user.id)}`}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className={`text-white text-xs ${getRoleColor(comment.user.role)}`}>
                          {getUserInitials(comment.user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={`max-w-xs lg:max-w-md ${comment.user.id === profile?.id ? 'ml-auto' : 'mr-auto'}`}>
                        <div className={`rounded-lg px-4 py-2 ${getMessageBgColor(comment.user.id, comment.user.role)}`}>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-sm">
                              {comment.user.full_name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {comment.user.role}
                            </Badge>
                          </div>
                          <p className="text-sm break-words">{comment.comment}</p>
                          <div className="flex items-center space-x-1 mt-2 text-xs opacity-70">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(comment.created_at), 'MMM dd, HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                
                {comments.filter(comment => !comment.document).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No comments yet. Start the discussion!</p>
                  </div>
                )}
              </div>

              {/* Comment Input */}
              <div className="border-t pt-4">
                <div className="flex items-start space-x-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className={`text-white text-xs ${getRoleColor(profile?.role || 'student')}`}>
                      {profile ? getUserInitials(profile.full_name || 'User') : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-3">
                    <Textarea
                      placeholder="Add a comment to the project discussion..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[80px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          submitComment();
                        }
                      }}
                    />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        Press Ctrl+Enter to send
                      </span>
                      <Button
                        onClick={submitComment}
                        disabled={isSubmittingComment || !newComment.trim()}
                        size="sm"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {isSubmittingComment ? 'Sending...' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Combine documents and comments in chronological order */}
                {[...documents.map(doc => ({
                  type: 'document',
                  date: doc.submitted_at,
                  title: `Document Submitted: ${doc.title}`,
                  description: `Phase ${doc.phase.replace('phase', '')}, Status: ${doc.status}`,
                  data: doc
                })), ...comments.map(comment => ({
                  type: 'comment',
                  date: comment.created_at,
                  title: `Comment by ${comment.user.full_name}`,
                  description: comment.comment,
                  data: comment
                }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item, index) => (
                  <div key={index} className="flex items-start space-x-4 border-l-2 border-gray-200 pl-4 pb-4">
                    <div className="flex-shrink-0 mt-1">
                      {item.type === 'document' ? (
                        <FileText className="h-5 w-5 text-blue-600" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{item.title}</h4>
                        <span className="text-sm text-gray-500">
                          {format(new Date(item.date), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectDetailsView;
