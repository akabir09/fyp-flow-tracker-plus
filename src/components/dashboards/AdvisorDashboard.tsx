
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Users, FileText, CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { NotificationService } from '@/services/notificationService';

const AdvisorDashboard = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [reviewingDocument, setReviewingDocument] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');

  // Fetch projects where I'm the advisor
  const { data: advisedProjects = [] } = useQuery({
    queryKey: ['advised_projects', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fyp_projects')
        .select(`
          *,
          student:profiles!fyp_projects_student_id_fkey(id, full_name, email),
          project_officer:profiles!fyp_projects_project_officer_id_fkey(id, full_name)
        `)
        .eq('advisor_id', profile?.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  // Fetch documents that need review from my projects
  const { data: documentsToReview = [] } = useQuery({
    queryKey: ['documents_to_review', profile?.id],
    queryFn: async () => {
      const projectIds = advisedProjects.map(p => p.id);
      if (projectIds.length === 0) return [];

      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          project:fyp_projects(title),
          submitted_by_profile:profiles!documents_submitted_by_fkey(full_name)
        `)
        .in('project_id', projectIds)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: advisedProjects.length > 0,
  });

  const reviewDocumentMutation = useMutation({
    mutationFn: async ({ documentId, status, feedback }: { documentId: string; status: 'approved' | 'rejected'; feedback: string }) => {
      const { data: document, error } = await supabase
        .from('documents')
        .update({
          status,
          advisor_feedback: feedback,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .select(`
          *,
          project:fyp_projects(title, student_id)
        `)
        .single();

      if (error) throw error;

      // Send notifications
      if (document.project?.student_id) {
        await NotificationService.notifyDocumentReview(
          document.project.title,
          document.title,
          status,
          document.project.student_id,
          profile?.id!
        );
      }

      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents_to_review'] });
      setReviewingDocument(null);
      setFeedback('');
      toast.success('Document reviewed successfully with notifications sent');
    },
    onError: (error: any) => {
      toast.error('Failed to review document');
    },
  });

  const handleReviewSubmit = (documentId: string) => {
    if (!feedback.trim()) {
      toast.error('Please provide feedback');
      return;
    }
    reviewDocumentMutation.mutate({
      documentId,
      status: reviewStatus,
      feedback
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold">Advisor Dashboard</h1>
          <p className="mt-2 text-purple-100">
            Manage your advised projects and review student submissions
          </p>
        </div>
        <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-white/10"></div>
        <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Advised Projects</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{advisedProjects.length}</div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <FileText className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">
              {documentsToReview.filter(d => d.status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{documentsToReview.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Documents to Review */}
      <Card className="border-0 bg-white/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Documents Awaiting Review</CardTitle>
          <CardDescription>
            Review and provide feedback on student submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {documentsToReview.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No documents to review</p>
            ) : (
              documentsToReview.map((document: any) => (
                <div key={document.id} className="rounded-lg border border-purple-100 bg-white/80 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-purple-900">{document.title}</h3>
                      <p className="text-sm text-gray-600">
                        Project: {document.project?.title}
                      </p>
                      <p className="text-sm text-gray-600">
                        Submitted by: {document.submitted_by_profile?.full_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        Phase: {document.phase} • {format(new Date(document.submitted_at), 'MMM dd, yyyy')}
                      </p>
                      {document.advisor_feedback && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          <strong>Feedback:</strong> {document.advisor_feedback}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={`${getStatusColor(document.status)} flex items-center space-x-1`}>
                        {getStatusIcon(document.status)}
                        <span className="capitalize">{document.status}</span>
                      </Badge>
                      {document.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => setReviewingDocument(document.id)}
                          className="bg-purple-600 text-white hover:bg-purple-700"
                        >
                          Review
                        </Button>
                      )}
                    </div>
                  </div>

                  {reviewingDocument === document.id && (
                    <div className="mt-4 space-y-4 border-t border-purple-100 pt-4">
                      <div>
                        <Label htmlFor="status">Review Status</Label>
                        <Select value={reviewStatus} onValueChange={(value: 'approved' | 'rejected') => setReviewStatus(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="approved">Approve</SelectItem>
                            <SelectItem value="rejected">Reject</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="feedback">Feedback</Label>
                        <Textarea
                          id="feedback"
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Provide detailed feedback..."
                          rows={3}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleReviewSubmit(document.id)}
                          disabled={reviewDocumentMutation.isPending}
                          className="bg-purple-600 text-white hover:bg-purple-700"
                        >
                          {reviewDocumentMutation.isPending ? 'Submitting...' : 'Submit Review'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setReviewingDocument(null);
                            setFeedback('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advised Projects */}
      <Card className="border-0 bg-white/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Your Advised Projects</CardTitle>
          <CardDescription>
            Overview of projects you are supervising
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {advisedProjects.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No projects assigned yet</p>
            ) : (
              advisedProjects.map((project: any) => (
                <div key={project.id} className="rounded-lg border border-purple-100 bg-white/80 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-purple-900">{project.title}</h3>
                      <p className="text-sm text-gray-600">{project.description}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Student: {project.student?.full_name || 'Not assigned'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Project Officer: {project.project_officer?.full_name}
                      </p>
                    </div>
                    <Badge className={project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {project.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvisorDashboard;
