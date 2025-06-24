
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Users, FileText, Calendar, BarChart3, X, Check, ChevronsUpDown, Eye, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ProjectDetailsView from './ProjectDetailsView';
import GenericResources from '@/components/GenericResources';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  students: Array<{
    full_name: string;
    email: string;
  }>;
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showResourcesView, setShowResourcesView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    studentIds: [] as string[],
    advisorId: '',
    phase1Deadline: '',
    phase2Deadline: '',
    phase3Deadline: '',
    phase4Deadline: ''
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch all projects with their associated students
      const { data: projectsData } = await supabase
        .from('fyp_projects')
        .select(`
          *,
          advisor:profiles!advisor_id(full_name, email),
          project_students(
            student:profiles!student_id(full_name, email)
          )
        `)
        .order('created_at', { ascending: false });

      // Transform the data to match our interface
      const transformedProjects = projectsData?.map(project => ({
        ...project,
        students: project.project_students?.map(ps => ps.student).filter(Boolean) || []
      })) || [];

      setProjects(transformedProjects);

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

  const handleStudentSelection = (studentId: string, checked: boolean) => {
    if (checked) {
      if (formData.studentIds.length < 4) {
        setFormData(prev => ({
          ...prev,
          studentIds: [...prev.studentIds, studentId]
        }));
      } else {
        toast.error('Maximum 4 students can be selected');
      }
    } else {
      setFormData(prev => ({
        ...prev,
        studentIds: prev.studentIds.filter(id => id !== studentId)
      }));
    }
  };

  const removeStudent = (studentId: string) => {
    setFormData(prev => ({
      ...prev,
      studentIds: prev.studentIds.filter(id => id !== studentId)
    }));
  };

  const getSelectedStudents = () => {
    return students.filter(student => formData.studentIds.includes(student.id));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.studentIds.length < 2) {
      toast.error('Please select at least 2 students');
      return;
    }

    if (formData.studentIds.length > 4) {
      toast.error('Please select maximum 4 students');
      return;
    }

    // Validate phase deadlines
    if (!formData.phase1Deadline || !formData.phase2Deadline || !formData.phase3Deadline || !formData.phase4Deadline) {
      toast.error('Please set deadlines for all phases');
      return;
    }
    
    try {
      // Create a single project
      const { data: projectData, error: projectError } = await supabase
        .from('fyp_projects')
        .insert({
          title: formData.title,
          description: formData.description,
          advisor_id: formData.advisorId || null,
          project_officer_id: profile?.id
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Associate all selected students with the project
      const studentAssociations = formData.studentIds.map(studentId => ({
        project_id: projectData.id,
        student_id: studentId
      }));

      const { error: studentsError } = await supabase
        .from('project_students')
        .insert(studentAssociations);

      if (studentsError) throw studentsError;

      // Create phase deadlines for the project
      const phases: ('phase1' | 'phase2' | 'phase3' | 'phase4')[] = ['phase1', 'phase2', 'phase3', 'phase4'];
      const deadlines = [
        formData.phase1Deadline,
        formData.phase2Deadline,
        formData.phase3Deadline,
        formData.phase4Deadline
      ];
      
      for (let i = 0; i < phases.length; i++) {
        await supabase
          .from('phase_deadlines')
          .insert({
            project_id: projectData.id,
            phase: phases[i],
            deadline_date: deadlines[i]
          });
      }

      // Create notifications for all students
      for (const studentId of formData.studentIds) {
        await supabase.rpc('create_notification', {
          user_id: studentId,
          title: 'New Project Assigned',
          message: `You have been assigned to project: ${formData.title}`
        });
      }

      // Create notification for advisor if assigned
      if (formData.advisorId) {
        await supabase.rpc('create_notification', {
          user_id: formData.advisorId,
          title: 'New Project Assignment',
          message: `You have been assigned as advisor for project: ${formData.title} (${formData.studentIds.length} students)`
        });
      }

      toast.success(`Project created successfully with ${formData.studentIds.length} students`);
      setShowCreateForm(false);
      setFormData({ 
        title: '', 
        description: '', 
        studentIds: [], 
        advisorId: '',
        phase1Deadline: '',
        phase2Deadline: '',
        phase3Deadline: '',
        phase4Deadline: ''
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    }
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

  // Show project details view if a project is selected
  if (selectedProjectId && !showResourcesView) {
    return (
      <ProjectDetailsView
        projectId={selectedProjectId}
        onBack={() => setSelectedProjectId(null)}
      />
    );
  }

  // Show resources view if selected
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
            <p className="text-gray-600">Upload and manage resources accessible to all users</p>
          </div>
        </div>
        
        <GenericResources canUpload={true} />
      </div>
    );
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
          <div className="flex space-x-2">
            <Button
              onClick={() => setShowResourcesView(true)}
              className="bg-white text-purple-600 hover:bg-purple-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Resources
            </Button>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-white text-purple-600 hover:bg-purple-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
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
            <CardDescription>Create a new Final Year Project and assign multiple students (2-4 students)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-6">
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
                  <Label htmlFor="advisor">Assign Advisor</Label>
                  <Select value={formData.advisorId} onValueChange={(value) => setFormData({ ...formData, advisorId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an advisor (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {advisors.map((advisor) => (
                        <SelectItem key={advisor.id} value={advisor.id}>
                          {advisor.full_name} ({advisor.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Students (Min: 2, Max: 4)</Label>
                <div className="text-sm text-gray-600 mb-2">
                  Selected: {formData.studentIds.length}/4 students
                </div>
                
                {/* Selected Students Display */}
                {getSelectedStudents().length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {getSelectedStudents().map((student) => (
                      <Badge key={student.id} variant="secondary" className="flex items-center gap-1">
                        {student.full_name}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:text-red-500" 
                          onClick={() => removeStudent(student.id)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Student Search Dropdown */}
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between"
                    >
                      Search and select students...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search students..." />
                      <CommandList>
                        <CommandEmpty>No students found.</CommandEmpty>
                        <CommandGroup>
                          {students.map((student) => {
                            const isSelected = formData.studentIds.includes(student.id);
                            const isDisabled = !isSelected && formData.studentIds.length >= 4;
                            
                            return (
                              <CommandItem
                                key={student.id}
                                value={`${student.full_name} ${student.email}`}
                                onSelect={() => {
                                  if (!isDisabled) {
                                    handleStudentSelection(student.id, !isSelected);
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-2",
                                  isDisabled && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    isSelected ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{student.full_name}</span>
                                  <span className="text-sm text-gray-500">{student.email}</span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {formData.studentIds.length < 2 && (
                  <p className="text-sm text-red-600">Please select at least 2 students</p>
                )}
              </div>

              {/* Phase Deadlines Section */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Phase Deadlines</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phase1">Phase 1 Deadline</Label>
                    <Input
                      id="phase1"
                      type="date"
                      value={formData.phase1Deadline}
                      onChange={(e) => setFormData({ ...formData, phase1Deadline: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phase2">Phase 2 Deadline</Label>
                    <Input
                      id="phase2"
                      type="date"
                      value={formData.phase2Deadline}
                      onChange={(e) => setFormData({ ...formData, phase2Deadline: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phase3">Phase 3 Deadline</Label>
                    <Input
                      id="phase3"
                      type="date"
                      value={formData.phase3Deadline}
                      onChange={(e) => setFormData({ ...formData, phase3Deadline: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phase4">Phase 4 Deadline</Label>
                    <Input
                      id="phase4"
                      type="date"
                      value={formData.phase4Deadline}
                      onChange={(e) => setFormData({ ...formData, phase4Deadline: e.target.value })}
                      required
                    />
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
                  disabled={!formData.title || formData.studentIds.length < 2 || formData.studentIds.length > 4}
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
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{project.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={
                      project.status === 'active' ? 'bg-green-100 text-green-800' :
                      project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }>
                      {project.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col space-y-1">
                    <span className="font-medium text-gray-700">Students ({project.students.length}):</span>
                    <div className="text-gray-600">
                      {project.students.length > 0 ? (
                        project.students.map((student, index) => (
                          <div key={index} className="text-xs">
                            {student.full_name} ({student.email})
                          </div>
                        ))
                      ) : (
                        'No students assigned'
                      )}
                    </div>
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
