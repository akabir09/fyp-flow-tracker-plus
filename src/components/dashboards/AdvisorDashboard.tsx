
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Users, FileText, CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  title: string;
  description: string;
  student: {
    full_name: string;
    email: string;
  };
}

interface Document {
  id: string;
  project_id: string;
  phase: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  advisor_feedback: string | null;
  submitted_at: string;
  project: {
    title: string;
    student_id: string;
    student: {
      full_name: string;
    };
  };
}

const AdvisorDashboard = () => {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchAdvisorData();
    }
  }, [profile]);

  const fetchAdvisorData = async () => {
    try {
      // Fetch advisor's projects
      const { data: projectsData } = await supabase
        .from('fyp_projects')
        .select(`
          *,
          student:profiles!student_id(full_name, email)
        `)
        .eq('advisor_id', profile?.id);

      setProjects(projectsData || []);

      // Fetch pending documents for review
      const { data: docsData } = await supabase
        .from('documents')
        .select(`
          *,
          project:fyp_projects(
            title,
            student_id,
            student:profiles!student_id(full_name)
          )
        `)
        .in('project_id', (projectsData || []).map(p => p.id))
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });

      setPendingDocuments(docsData || []);
    } catch (error) {
      console.error('Error fetching advisor data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentAction = async (docId: string, action: 'approved' | 'rejected', feedback?: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          status: action,
          advisor_feedback: feedback || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile?.id
        })
        .eq('id', docId);

      if (error) throw error;

      toast.success(`Document ${action} successfully`);
      
      // Create notification for student
      const doc = pendingDocuments.find(d => d.id === docId);
      if (doc?.project?.student_id) {
        await supabase.rpc('create_notification', {
          user_id: doc.project.student_id,
          title: `Document ${action}`,
          message: `Your ${doc.phase} submission has been ${action}${feedback ? `: ${feedback}` : ''}`
        });
      }

      // Refresh data
      fetchAdvisorData();
      setSelectedDoc(null);
      setFeedback('');
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Failed to update document status');
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

  if (loading) {
    return <div className="animate-pulse space-y-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-white p-6">
        <h1 className="text-2xl font-bold mb-2">Advisor Dashboard</h1>
        <p className="text-green-100">Review student submissions and track project progress</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
                <p className="text-sm text-gray-600">Active Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingDocuments.length}</p>
                <p className="text-sm text-gray-600">Pending Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{projects.length * 4}</p>
                <p className="text-sm text-gray-600">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Assigned Projects</span>
            </CardTitle>
            <CardDescription>Students under your supervision</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-gray-900">{project.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className="bg-blue-100 text-blue-800">
                      {project.student.full_name}
                    </Badge>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="text-gray-500 text-center py-4">No projects assigned yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Reviews */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Pending Reviews</span>
            </CardTitle>
            <CardDescription>Documents awaiting your review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingDocuments.map((doc) => (
                <div key={doc.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{getPhaseTitle(doc.phase)}</h4>
                      <p className="text-sm text-gray-600">{doc.project.title}</p>
                      <p className="text-xs text-gray-500">by {doc.project.student.full_name}</p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                  <div className="flex space-x-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => setSelectedDoc(doc)}
                      variant="outline"
                    >
                      Review
                    </Button>
                  </div>
                </div>
              ))}
              {pendingDocuments.length === 0 && (
                <p className="text-gray-500 text-center py-4">No pending reviews</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Modal */}
      {selectedDoc && (
        <Card className="fixed inset-x-4 top-20 z-50 max-w-2xl mx-auto bg-white border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Review Document</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)}>
                ×
              </Button>
            </CardTitle>
            <CardDescription>
              {getPhaseTitle(selectedDoc.phase)} - {selectedDoc.project.title}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback (optional for approval, required for rejection)
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide feedback for the student..."
                rows={4}
              />
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => handleDocumentAction(selectedDoc.id, 'approved', feedback)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={() => handleDocumentAction(selectedDoc.id, 'rejected', feedback)}
                variant="destructive"
                disabled={!feedback.trim()}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button variant="outline" onClick={() => setSelectedDoc(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdvisorDashboard;
