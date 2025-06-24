import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Calendar, FileText, AlertCircle, CheckCircle, Clock, Lock, Download } from 'lucide-react';
import { toast } from 'sonner';
import PhaseDetailView from './PhaseDetailView';
import GenericResources from '@/components/GenericResources';
import { Database } from '@/integrations/supabase/types';

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

type Document = Database['public']['Tables']['documents']['Row'];

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
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [showResourcesView, setShowResourcesView] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchStudentData();
    }
  }, [profile]);

  const fetchStudentData = async () => {
    try {
      // Fetch student's project through the project_students junction table
      const { data: projectStudentData, error: projectError } = await supabase
        .from('project_students')
        .select(`
          project:fyp_projects(
            *,
            advisor:profiles!advisor_id(full_name, email)
          )
        `)
        .eq('student_id', profile?.id)
        .single();

      if (projectStudentData?.project) {
        setProject(projectStudentData.project);

        // Fetch documents for this project
        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectStudentData.project.id)
          .order('submitted_at', { ascending: false });

        setDocuments(docsData || []);

        // Fetch deadlines for this project
        const { data: deadlinesData } = await supabase
          .from('phase_deadlines')
          .select('*')
          .eq('project_id', projectStudentData.project.id)
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

  const isPhaseUnlocked = (phase: string) => {
    const phaseOrder = ['phase1', 'phase2', 'phase3', 'phase4'];
    const currentPhaseIndex = phaseOrder.indexOf(phase);
    
    if (currentPhaseIndex === 0) return true; // Phase 1 is always unlocked
    
    // Check if all previous phases are approved
    for (let i = 0; i < currentPhaseIndex; i++) {
      const previousPhase = phaseOrder[i];
      const previousPhaseDoc = documents.find(doc => doc.phase === previousPhase);
      if (!previousPhaseDoc || previousPhaseDoc.status !== 'approved') {
        return false;
      }
    }
    return true;
  };

  const getDeadlineInfo = (phase: string) => {
    const deadline = deadlines.find(d => d.phase === phase);
    if (!deadline) return null;

    const deadlineDate = new Date(deadline.deadline_date);
    const now = new Date();
    const timeDiff = deadlineDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    const isOverdue = daysLeft < 0;
    const isUrgent = daysLeft <= 3 && daysLeft >= 0;
    const isWarning = daysLeft <= 7 && daysLeft > 3;

    let badgeColor = 'bg-green-100 text-green-800'; // Default - plenty of time
    let timeText = '';

    if (isOverdue) {
      badgeColor = 'bg-red-100 text-red-800';
      timeText = `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
    } else if (isUrgent) {
      badgeColor = 'bg-red-100 text-red-800';
      timeText = daysLeft === 0 ? 'Due Today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    } else if (isWarning) {
      badgeColor = 'bg-orange-100 text-orange-800';
      timeText = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    } else {
      timeText = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    }

    return {
      badgeColor,
      timeText,
      isOverdue,
      isUrgent,
      isWarning,
      deadlineDate: deadlineDate.toLocaleDateString()
    };
  };

  const handlePhaseClick = (phase: string) => {
    if (isPhaseUnlocked(phase)) {
      setSelectedPhase(phase);
    } else {
      toast.error('Complete previous phases to unlock this phase');
    }
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
        <div className="mt-6">
          <Button
            onClick={() => setShowResourcesView(true)}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            View Available Resources
          </Button>
        </div>
      </div>
    );
  }

  // Show resources view if requested
  if (showResourcesView) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="outline"
              onClick={() => setShowResourcesView(false)}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold">General Resources</h1>
            <p className="text-gray-600">View and download resources available to all users</p>
          </div>
        </div>
        
        <GenericResources canUpload={false} />
      </div>
    );
  }

  // Show phase detail view if a phase is selected
  if (selectedPhase) {
    return (
      <PhaseDetailView
        phase={selectedPhase}
        projectId={project.id}
        onBack={() => setSelectedPhase(null)}
        isLocked={!isPhaseUnlocked(selectedPhase)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white p-6">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {profile?.full_name}!</h1>
        <p className="text-blue-100">Track your FYP progress and manage document submissions</p>
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => setShowResourcesView(true)}
            className="bg-white/20 text-white border-white/30 hover:bg-white/30"
          >
            <Download className="h-4 w-4 mr-2" />
            View Resources
          </Button>
        </div>
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
              <span>Project Phases</span>
            </CardTitle>
            <CardDescription>Click on unlocked phases to manage documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['phase1', 'phase2', 'phase3', 'phase4'].map((phase) => {
                const doc = documents.find(d => d.phase === phase);
                const isUnlocked = isPhaseUnlocked(phase);
                const deadline = deadlines.find(d => d.phase === phase);
                
                return (
                  <div 
                    key={phase} 
                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                      isUnlocked 
                        ? 'cursor-pointer hover:bg-gray-50' 
                        : 'opacity-50 cursor-not-allowed bg-gray-100'
                    }`}
                    onClick={() => handlePhaseClick(phase)}
                  >
                    <div className="flex items-center space-x-3">
                      {!isUnlocked ? (
                        <Lock className="h-4 w-4 text-gray-400" />
                      ) : (
                        getStatusIcon(doc?.status || 'pending')
                      )}
                      <div>
                        <div className="font-medium text-sm flex items-center">
                          {getPhaseTitle(phase)}
                          {!isUnlocked && <Lock className="h-3 w-3 ml-2 text-gray-400" />}
                        </div>
                        {doc?.advisor_feedback && doc.status === 'rejected' && (
                          <div className="text-xs text-red-600 mt-1 truncate max-w-xs">
                            {doc.advisor_feedback}
                          </div>
                        )}
                        {deadline && (
                          <div className="text-xs text-gray-500 mt-1">
                            Due: {new Date(deadline.deadline_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(doc?.status || 'pending')}
                      {isUnlocked && (
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      )}
                    </div>
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
                const deadlineInfo = getDeadlineInfo(deadline.phase);
                
                return (
                  <div key={deadline.phase} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{getPhaseTitle(deadline.phase)}</div>
                      <div className="text-xs text-gray-600">
                        {new Date(deadline.deadline_date).toLocaleDateString()}
                      </div>
                    </div>
                    {deadlineInfo && (
                      <Badge className={deadlineInfo.badgeColor}>
                        {deadlineInfo.timeText}
                      </Badge>
                    )}
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
