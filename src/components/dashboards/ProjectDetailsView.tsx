
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, FileText, MessageSquare, Download, Calendar, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

const ProjectDetailsView = ({ projectId, onBack }: ProjectDetailsViewProps) => {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [phaseStats, setPhaseStats] = useState<PhaseStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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

  if (loading) {
    return <div className="animate-pulse space-y-4">Loading project details...</div>;
  }

  if (!project) {
    return <div className="text-center py-8">Project not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Project Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent>
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
                <span>All Comments & Feedback</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{comment.user.full_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {comment.user.role}
                        </Badge>
                        {comment.document && (
                          <span className="text-sm text-gray-500">
                            on {comment.document.title} ({comment.document.phase.replace('phase', 'Phase ')})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                    <p className="text-gray-700">{comment.comment}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No comments found for this project
                  </div>
                )}
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
