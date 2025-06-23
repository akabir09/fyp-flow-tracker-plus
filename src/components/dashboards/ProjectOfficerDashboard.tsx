
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Users, BookOpen, Calendar, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { NotificationService } from '@/services/notificationService';

const ProjectOfficerDashboard = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    selectedStudents: [] as string[],
    advisorId: ''
  });

  // Fetch all projects
  const { data: projects = [] } = useQuery({
    queryKey: ['fyp_projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fyp_projects')
        .select(`
          *,
          student:profiles!fyp_projects_student_id_fkey(id, full_name, email),
          advisor:profiles!fyp_projects_advisor_id_fkey(id, full_name),
          project_officer:profiles!fyp_projects_project_officer_id_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all students (those without projects)
  const { data: availableStudents = [] } = useQuery({
    queryKey: ['available_students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all advisors
  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'advisor');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all documents for overview
  const { data: allDocuments = [] } = useQuery({
    queryKey: ['all_documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          project:fyp_projects(title),
          submitted_by_profile:profiles!documents_submitted_by_fkey(full_name)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: typeof newProject) => {
      if (projectData.selectedStudents.length < 2 || projectData.selectedStudents.length > 4) {
        throw new Error('Please select between 2 and 4 students');
      }

      const advisorId = projectData.advisorId === 'no-advisor' ? null : projectData.advisorId || null;

      const { data: project, error } = await supabase
        .from('fyp_projects')
        .insert({
          title: projectData.title,
          description: projectData.description,
          project_officer_id: profile?.id,
          advisor_id: advisorId
        })
        .select()
        .single();

      if (error) throw error;

      // Update students with project assignment
      const studentUpdates = projectData.selectedStudents.map(studentId => 
        supabase
          .from('fyp_projects')
          .update({ student_id: studentId })
          .eq('id', project.id)
      );

      await Promise.all(studentUpdates);

      // Send notifications using the notification service
      await NotificationService.notifyProjectAssignment(
        projectData.title,
        projectData.selectedStudents,
        advisorId
      );

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fyp_projects'] });
      setIsCreatingProject(false);
      setNewProject({ title: '', description: '', selectedStudents: [], advisorId: '' });
      toast.success('Project created successfully with notifications sent to all assigned users');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ projectId, updates }: { projectId: string; updates: any }) => {
      const { error } = await supabase
        .from('fyp_projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      // Send update notification
      await NotificationService.notifyProjectUpdate(
        'Project Updated',
        `Project details have been updated`,
        projectId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fyp_projects'] });
      toast.success('Project updated with notifications sent');
    },
    onError: (error: any) => {
      toast.error('Failed to update project');
    },
  });

  const setDeadlineMutation = useMutation({
    mutationFn: async ({ projectId, phase, deadline }: { projectId: string; phase: string; deadline: string }) => {
      const { error } = await supabase
        .from('phase_deadlines')
        .upsert({
          project_id: projectId,
          phase: phase as any,
          deadline_date: deadline
        });

      if (error) throw error;

      // Get project details for notifications
      const { data: project } = await supabase
        .from('fyp_projects')
        .select('title, student_id, advisor_id')
        .eq('id', projectId)
        .single();

      if (project) {
        const studentIds = project.student_id ? [project.student_id] : [];
        await NotificationService.notifyDeadlineUpdate(
          project.title,
          phase,
          deadline,
          studentIds,
          project.advisor_id
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phase_deadlines'] });
      toast.success('Deadline set with notifications sent to all involved parties');
    },
    onError: (error: any) => {
      toast.error('Failed to set deadline');
    },
  });

  const handleStudentSelection = (studentId: string) => {
    setNewProject(prev => {
      const isSelected = prev.selectedStudents.includes(studentId);
      if (isSelected) {
        return {
          ...prev,
          selectedStudents: prev.selectedStudents.filter(id => id !== studentId)
        };
      } else {
        if (prev.selectedStudents.length >= 4) {
          toast.error('Maximum 4 students can be selected');
          return prev;
        }
        return {
          ...prev,
          selectedStudents: [...prev.selectedStudents, studentId]
        };
      }
    });
  };

  const handleCreateProject = () => {
    if (!newProject.title.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    if (newProject.selectedStudents.length < 2) {
      toast.error('Please select at least 2 students');
      return;
    }
    if (newProject.selectedStudents.length > 4) {
      toast.error('Please select maximum 4 students');
      return;
    }
    createProjectMutation.mutate(newProject);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'suspended':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDocumentStatusColor = (status: string) => {
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

  const pendingDocuments = allDocuments.filter(doc => doc.status === 'pending');
  const approvedDocuments = allDocuments.filter(doc => doc.status === 'approved');
  const rejectedDocuments = allDocuments.filter(doc => doc.status === 'rejected');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold">Project Officer Dashboard</h1>
          <p className="mt-2 text-purple-100">
            Manage FYP projects, assign students and advisors, and oversee progress
          </p>
        </div>
        <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-white/10"></div>
        <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <BookOpen className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{projects.length}</div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              {projects.filter(p => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{pendingDocuments.length}</div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Students</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{availableStudents.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Create Project Section */}
      <Card className="border-0 bg-white/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Create New Project</CardTitle>
              <CardDescription>
                Set up a new FYP project and assign students and advisors
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsCreatingProject(!isCreatingProject)}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
        </CardHeader>
        {isCreatingProject && (
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  value={newProject.title}
                  onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter project title"
                />
              </div>
              <div>
                <Label htmlFor="advisor">Advisor (Optional)</Label>
                <Select
                  value={newProject.advisorId}
                  onValueChange={(value) => setNewProject(prev => ({ ...prev, advisorId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an advisor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No advisor assigned</SelectItem>
                    {advisors.map((advisor) => (
                      <SelectItem key={advisor.id} value={advisor.id}>
                        {advisor.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newProject.description}
                onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter project description"
                rows={3}
              />
            </div>

            <div>
              <Label>Select Students (2-4 required)</Label>
              <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {availableStudents.map((student) => (
                  <div
                    key={student.id}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      newProject.selectedStudents.includes(student.id)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                    onClick={() => handleStudentSelection(student.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{student.full_name}</p>
                        <p className="text-sm text-gray-500">{student.email}</p>
                      </div>
                      {newProject.selectedStudents.includes(student.id) && (
                        <CheckCircle className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Selected: {newProject.selectedStudents.length}/4 students
              </p>
            </div>

            <div className="flex space-x-4">
              <Button
                onClick={handleCreateProject}
                disabled={createProjectMutation.isPending}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingProject(false);
                  setNewProject({ title: '', description: '', selectedStudents: [], advisorId: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Projects Overview */}
      <Card className="border-0 bg-white/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>
            Overview of all FYP projects in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projects.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No projects created yet</p>
            ) : (
              projects.map((project: any) => (
                <div key={project.id} className="rounded-lg border border-purple-100 bg-white/80 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-purple-900">{project.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-500">
                          Student: {project.student?.full_name || 'Not assigned'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Advisor: {project.advisor?.full_name || 'Not assigned'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Project Officer: {project.project_officer?.full_name}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document Overview */}
      <Card className="border-0 bg-white/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Document Overview</CardTitle>
          <CardDescription>
            Recent document submissions across all projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allDocuments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No documents submitted yet</p>
            ) : (
              allDocuments.slice(0, 10).map((document: any) => (
                <div key={document.id} className="rounded-lg border border-purple-100 bg-white/80 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-purple-900">{document.title}</h4>
                      <p className="text-sm text-gray-600">
                        Project: {document.project?.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        Submitted by: {document.submitted_by_profile?.full_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        Phase: {document.phase}
                      </p>
                    </div>
                    <Badge className={getDocumentStatusColor(document.status)}>
                      {document.status}
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

export default ProjectOfficerDashboard;
