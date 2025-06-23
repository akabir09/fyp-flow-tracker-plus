import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Users, FileText, Calendar, BarChart3, X } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  student: {
    full_name: string;
    email: string;
  } | null;
  advisor: {
    full_name: string;
    email: string;
  } | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

const ProjectOfficerDashboard = () => {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [advisors, setAdvisors] = useState<Profile[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    studentId: '',
    advisorIds: [] as string[]
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch all projects
      const { data: projectsData } = await supabase
        .from('fyp_projects')
        .select(`
          *,
          student:profiles!student_id(full_name, email),
          advisor:profiles!advisor_id(full_name, email)
        `)
        .order('created_at', { ascending: false });

      setProjects(projectsData || []);

      // Fetch students
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      setStudents(studentsData || []);

      // Fetch advisors
      const { data: advisorsData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'advisor');

      setAdvisors(advisorsData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for multiselect
    if (formData.advisorIds.length < 2) {
      toast.error('Please select at least 2 advisors');
      return;
    }
    
    if (formData.advisorIds.length > 4) {
      toast.error('Please select no more than 4 advisors');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('fyp_projects')
        .insert({
          title: formData.title,
          description: formData.description,
          student_id: formData.studentId,
          advisor_id: formData.advisorIds[0], // Primary advisor
          project_officer_id: profile?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Create default phase deadlines
      const phases: ('phase1' | 'phase2' | 'phase3' | 'phase4')[] = ['phase1', 'phase2', 'phase3', 'phase4'];
      const baseDate = new Date();
      
      for (let i = 0; i < phases.length; i++) {
        const deadlineDate = new Date(baseDate);
        deadlineDate.setMonth(deadlineDate.getMonth() + (i + 1) * 3);
        
        await supabase
          .from('phase_deadlines')
          .insert({
            project_id: data.id,
            phase: phases[i],
            deadline_date: deadlineDate.toISOString().split('T')[0]
          });
      }

      // Create notifications for student and all selected advisors
      if (formData.studentId) {
        await supabase.rpc('create_notification', {
          user_id: formData.studentId,
          title: 'New Project Assigned',
          message: `You have been assigned to project: ${formData.title}`
        });
      }

      // Notify all selected advisors
      for (const advisorId of formData.advisorIds) {
        await supabase.rpc('create_notification', {
          user_id: advisorId,
          title: 'New Project Assignment',
          message: `You have been assigned as advisor for project: ${formData.title}`
        });
      }

      toast.success('Project created successfully');
      setShowCreateForm(false);
      setFormData({ title: '', description: '', studentId: '', advisorIds: [] });
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    }
  };

  const handleAdvisorToggle = (advisorId: string) => {
    setFormData(prev => {
      const newAdvisorIds = prev.advisorIds.includes(advisorId)
        ? prev.advisorIds.filter(id => id !== advisorId)
        : [...prev.advisorIds, advisorId];
      
      if (newAdvisorIds.length > 4) {
        toast.error('Maximum 4 advisors allowed');
        return prev;
      }
      
      return { ...prev, advisorIds: newAdvisorIds };
    });
  };

  const removeAdvisor = (advisorId: string) => {
    setFormData(prev => ({
      ...prev,
      advisorIds: prev.advisorIds.filter(id => id !== advisorId)
    }));
  };

  const getProjectStats = () => {
    const active = projects.filter(p => p.status === 'active').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const suspended = projects.filter(p => p.status === 'suspended').length;
    
    return { active, completed, suspended, total: projects.length };
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">Loading...</div>;
  }

  const stats = getProjectStats();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg text-white p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold mb-2">Project Officer Dashboard</h1>
            <p className="text-purple-100">Manage FYP projects, assignments, and track overall progress</p>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-white text-purple-600 hover:bg-purple-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                <p className="text-sm text-gray-600">Active Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                <p className="text-sm text-gray-600">Students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{advisors.length}</p>
                <p className="text-sm text-gray-600">Advisors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Project Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New FYP Project</CardTitle>
            <CardDescription>Assign a new Final Year Project to a student and advisors (2-4 required)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Project Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="Enter project title"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="student">Assign Student</Label>
                  <Select value={formData.studentId} onValueChange={(value) => setFormData({ ...formData, studentId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.full_name} ({student.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign Advisors (2-4 required)</Label>
                <div className="border rounded-md p-3 min-h-[100px]">
                  <div className="space-y-2">
                    {/* Selected advisors display */}
                    {formData.advisorIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {formData.advisorIds.map((advisorId) => {
                          const advisor = advisors.find(a => a.id === advisorId);
                          return advisor ? (
                            <Badge key={advisorId} variant="secondary" className="flex items-center gap-1">
                              {advisor.full_name}
                              <X 
                                className="h-3 w-3 cursor-pointer hover:text-red-500" 
                                onClick={() => removeAdvisor(advisorId)}
                              />
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                    
                    {/* Available advisors to select */}
                    <div className="space-y-1">
                      {advisors
                        .filter(advisor => !formData.advisorIds.includes(advisor.id))
                        .map((advisor) => (
                          <div 
                            key={advisor.id}
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={() => handleAdvisorToggle(advisor.id)}
                          >
                            <div className="flex-1">
                              <span className="text-sm">{advisor.full_name} ({advisor.email})</span>
                            </div>
                            <Button type="button" size="sm" variant="outline">
                              Add
                            </Button>
                          </div>
                        ))}
                    </div>
                    
                    {formData.advisorIds.length === 0 && (
                      <p className="text-sm text-gray-500">Select 2-4 advisors from the list above</p>
                    )}
                    
                    <div className="text-xs text-gray-500 mt-2">
                      Selected: {formData.advisorIds.length}/4 (minimum 2 required)
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Project Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the project objectives and scope"
                  rows={4}
                />
              </div>

              <div className="flex space-x-3">
                <Button 
                  type="submit" 
                  disabled={!formData.title || !formData.studentId || formData.advisorIds.length < 2}
                >
                  Create Project
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Projects List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>All Projects</span>
          </CardTitle>
          <CardDescription>Manage and monitor all FYP projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{project.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                  </div>
                  <Badge className={
                    project.status === 'active' ? 'bg-green-100 text-green-800' :
                    project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }>
                    {project.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-700">Student:</span>
                    <span className="text-gray-600">
                      {project.student ? `${project.student.full_name} (${project.student.email})` : 'Not assigned'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-700">Advisor:</span>
                    <span className="text-gray-600">
                      {project.advisor ? `${project.advisor.full_name} (${project.advisor.email})` : 'Not assigned'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {projects.length === 0 && (
              <div className="text-center py-8">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Yet</h3>
                <p className="text-gray-600">Create your first FYP project to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectOfficerDashboard;
