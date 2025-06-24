import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, CheckCircle, XCircle, Clock, MessageSquare, Download, User, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import PhaseDetailView from './PhaseDetailView';

type Document = Database['public']['Tables']['documents']['Row'];

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  student: {
    full_name: string;
    email: string;
  } | null;
}

interface Comment {
  id: string;
  document_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    role: Database['public']['Enums']['user_role'] | null;
  } | null;
}

const AdvisorDashboard = () => {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [showPhaseDetail, setShowPhaseDetail] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [phaseSelectionDialogOpen, setPhaseSelectionDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  const phases = [
    { id: 'phase1', title: 'Phase 1: Project Proposal' },
    { id: 'phase2', title: 'Phase 2: Literature Review' },
    { id: 'phase3', title: 'Phase 3: Implementation' },
    { id: 'phase4', title: 'Phase 4: Final Report' }
  ];

  useEffect(() => {
    if (profile) {
      fetchAdvisorData();
    }
  }, [profile]);

  const fetchAdvisorData = async () => {
    try {
      // Fetch projects where user is advisor
      const { data: projectData, error: projectError } = await supabase
        .from('fyp_projects')
        .select(`
          *,
          student:profiles!student_id(full_name, email)
        `)
        .eq('advisor_id', profile?.id);

      if (projectError) throw projectError;
      setProjects(projectData || []);

      if (projectData && projectData.length > 0) {
        const projectIds = projectData.map(p => p.id);
        
        // Fetch all documents for these projects
        const { data: docsData, error: docsError } = await supabase
          .from('documents')
          .select('*')
          .in('project_id', projectIds)
          .order('submitted_at', { ascending: false });

        if (docsError) throw docsError;
        setDocuments(docsData || []);
      }
    } catch (error) {
      console.error('Error fetching advisor data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (documentId: string) => {
    try {
      const { data, error } = await supabase
        .from('document_comments')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    if (!doc.file_url) {
      toast.error('No file available for download');
      return;
    }

    try {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = doc.file_url;
      link.download = `${doc.title}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Document download started');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download document');
    }
  };

  const handleReviewDocument = async (documentId: string, status: 'approved' | 'rejected') => {
    try {
      const updateData: any = {
        status,
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString()
      };

      if (status === 'rejected' && feedback.trim()) {
        updateData.advisor_feedback = feedback;
      }

      const { error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId);

      if (error) throw error;

      toast.success(`Document ${status} successfully`);
      setReviewDialogOpen(false);
      setSelectedDocument(null);
      setFeedback('');
      fetchAdvisorData();
    } catch (error) {
      console.error('Error reviewing document:', error);
      toast.error('Failed to update document status');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedDocument) return;

    try {
      const { error } = await supabase
        .from('document_comments')
        .insert({
          document_id: selectedDocument.id,
          user_id: profile?.id,
          comment: newComment
        });

      if (error) throw error;

      setNewComment('');
      fetchComments(selectedDocument.id);
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const openReviewDialog = (document: Document) => {
    setSelectedDocument(document);
    setReviewDialogOpen(true);
  };

  const openCommentsDialog = (document: Document) => {
    setSelectedDocument(document);
    setCommentsDialogOpen(true);
    fetchComments(document.id);
  };

  const handleViewProject = (project: Project) => {
    setSelectedProject(project);
    setPhaseSelectionDialogOpen(true);
  };

  const handlePhaseSelect = (phaseId: string) => {
    setSelectedPhase(phaseId);
    setPhaseSelectionDialogOpen(false);
    setShowPhaseDetail(true);
  };

  const handleBackToDashboard = () => {
    setShowPhaseDetail(false);
    setSelectedProject(null);
    setSelectedPhase('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
    }
  };

  const getPhaseTitle = (phase: string) => {
    const phases = {
      phase1: 'Phase 1: Project Proposal',
      phase2: 'Phase 2: Literature Review',
      phase3: 'Phase 3: Implementation',
      phase4: 'Phase 4: Final Report'
    };
    return phases[phase as keyof typeof phases] || phase;
  };

  const pendingDocuments = documents.filter(doc => doc.status === 'pending');
  const reviewedDocuments = documents.filter(doc => doc.status !== 'pending');

  if (loading) {
    return <div className="animate-pulse space-y-4">Loading...</div>;
  }

  if (showPhaseDetail && selectedProject) {
    return (
      <PhaseDetailView
        phase={selectedPhase}
        projectId={selectedProject.id}
        onBack={handleBackToDashboard}
        isLocked={false}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-white p-6">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {profile?.full_name}!</h1>
        <p className="text-green-100">Review student submissions and provide feedback</p>
      </div>

      {/* Projects Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Supervised Projects</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h3 className="font-medium">{project.title}</h3>
                  <p className="text-sm text-gray-600">
                    Student: {project.student?.full_name} ({project.student?.email})
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-blue-100 text-blue-800">
                    {project.status}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewProject(project)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Reviews */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <span>Pending Reviews ({pendingDocuments.length})</span>
            </CardTitle>
            <CardDescription>Documents awaiting your review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingDocuments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No pending reviews</p>
              ) : (
                pendingDocuments.map((document) => {
                  const project = projects.find(p => p.id === document.project_id);
                  return (
                    <div key={document.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-sm">{document.title}</h4>
                          <p className="text-xs text-gray-600">
                            {getPhaseTitle(document.phase)} • {project?.student?.full_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Submitted: {document.submitted_at && new Date(document.submitted_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex space-x-1">
                          {document.file_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadDocument(document)}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCommentsDialog(document)}
                          >
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openReviewDialog(document)}
                          >
                            Review
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Reviews */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Recent Reviews</span>
            </CardTitle>
            <CardDescription>Recently reviewed documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reviewedDocuments.slice(0, 5).map((document) => {
                const project = projects.find(p => p.id === document.project_id);
                return (
                  <div key={document.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{document.title}</h4>
                        <p className="text-xs text-gray-600">
                          {getPhaseTitle(document.phase)} • {project?.student?.full_name}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {document.status === 'approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <Badge className={document.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {document.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      {document.file_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadDocument(document)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCommentsDialog(document)}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Comments
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phase Selection Dialog */}
      <Dialog open={phaseSelectionDialogOpen} onOpenChange={setPhaseSelectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Phase</DialogTitle>
            <DialogDescription>
              Choose a phase to view documents and chat for {selectedProject?.title}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            {phases.map((phase) => (
              <Button
                key={phase.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handlePhaseSelect(phase.id)}
              >
                {phase.title}
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseSelectionDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
            <DialogDescription>
              {selectedDocument?.title} - {selectedDocument && getPhaseTitle(selectedDocument.phase)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedDocument?.file_url && (
              <div>
                <Button
                  variant="outline"
                  onClick={() => selectedDocument && handleDownloadDocument(selectedDocument)}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Document for Review
                </Button>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium">Feedback (optional for approval, required for rejection)</label>
              <Textarea
                placeholder="Provide feedback to the student..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="space-x-2">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedDocument && handleReviewDocument(selectedDocument.id, 'rejected')}
              disabled={!feedback.trim()}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() => selectedDocument && handleReviewDocument(selectedDocument.id, 'approved')}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title}</DialogTitle>
            <DialogDescription>
              Document comments and communication thread
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedDocument?.file_url && (
              <div className="bg-gray-50 rounded-lg p-4">
                <Button
                  variant="outline"
                  onClick={() => selectedDocument && handleDownloadDocument(selectedDocument)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Document
                </Button>
              </div>
            )}

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-white border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">
                      {comment.profiles?.full_name || 'Unknown User'}
                      <Badge variant="outline" className="ml-2 text-xs">
                        {comment.profiles?.role || 'unknown'}
                      </Badge>
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{comment.comment}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Textarea
                placeholder="Reply to student or add comments..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                Add Comment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdvisorDashboard;
