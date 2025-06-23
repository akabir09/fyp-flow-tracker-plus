
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Calendar, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  advisor: {
    full_name: string;
    email: string;
  } | null;
}

interface Document {
  id: string;
  phase: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  advisor_feedback: string | null;
  submitted_at: string;
}

interface Deadline {
  phase: string;
  deadline_date: string;
}

const StudentDashboard = () => {
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchStudentData();
    }
  }, [profile]);

  const fetchStudentData = async () => {
    try {
      // Fetch student's project
      const { data: projectData, error: projectError } = await supabase
        .from('fyp_projects')
        .select(`
          *,
          advisor:profiles!advisor_id(full_name, email)
        `)
        .eq('student_id', profile?.id)
        .single();

      if (projectData) {
        setProject(projectData);

        // Fetch documents for this project
        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectData.id)
          .order('submitted_at', { ascending: false });

        setDocuments(docsData || []);

        // Fetch deadlines for this project
        const { data: deadlinesData } = await supabase
          .from('phase_deadlines')
          .select('*')
          .eq('project_id', projectData.id)
          .order('phase');

        setDeadlines(deadlinesData || []);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
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
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const calculateProgress = () => {
    const approvedDocs = documents.filter(doc => doc.status === 'approved').length;
    return (approvedDocs / 4) * 100; // 4 phases total
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

  if (!project) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Assigned</h3>
        <p className="text-gray-600">You haven't been assigned to any FYP project yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white p-6">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {profile?.full_name}!</h1>
        <p className="text-blue-100">Track your FYP progress and manage document submissions</p>
      </div>

      {/* Project Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Project Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
              <p className="text-gray-600 mt-1">{project.description}</p>
            </div>
            
            {project.advisor && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="font-medium">Advisor:</span>
                <span>{project.advisor.full_name}</span>
                <span>({project.advisor.email})</span>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className="text-sm text-gray-600">{Math.round(calculateProgress())}%</span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documents Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Document Status</span>
            </CardTitle>
            <CardDescription>Track your submissions across all phases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['phase1', 'phase2', 'phase3', 'phase4'].map((phase) => {
                const doc = documents.find(d => d.phase === phase);
                return (
                  <div key={phase} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(doc?.status || 'pending')}
                      <div>
                        <div className="font-medium text-sm">{getPhaseTitle(phase)}</div>
                        {doc?.advisor_feedback && doc.status === 'rejected' && (
                          <div className="text-xs text-red-600 mt-1">{doc.advisor_feedback}</div>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(doc?.status || 'pending')}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Upcoming Deadlines</span>
            </CardTitle>
            <CardDescription>Stay on track with important dates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deadlines.map((deadline) => {
                const isOverdue = new Date(deadline.deadline_date) < new Date();
                const daysUntil = Math.ceil((new Date(deadline.deadline_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={deadline.phase} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{getPhaseTitle(deadline.phase)}</div>
                      <div className="text-xs text-gray-600">
                        {new Date(deadline.deadline_date).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge className={isOverdue ? 'bg-red-100 text-red-800' : daysUntil <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}>
                      {isOverdue ? 'Overdue' : daysUntil <= 0 ? 'Due Today' : `${daysUntil} days`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;
