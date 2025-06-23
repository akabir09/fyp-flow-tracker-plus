
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Users, Calendar, BarChart3 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-purple">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  // If user is not authenticated, show landing page
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-purple">
        {/* Header */}
        <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-white" />
                <h1 className="text-xl font-bold text-white">Proactive</h1>
              </div>
              <Button onClick={() => navigate('/auth')} className="bg-white text-purple-600 hover:bg-white/90">
                Sign In
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-white mb-4">
              Streamline Your Final Year Project Management
            </h1>
            <p className="text-xl text-purple-100 mb-8 max-w-3xl mx-auto">
              A comprehensive platform for students, advisors, and project officers to collaborate, 
              track progress, and manage document approvals in an organized workflow.
            </p>
            <div className="space-x-4">
              <Button size="lg" onClick={() => navigate('/auth')} className="bg-white text-purple-600 hover:bg-white/90">
                Get Started
              </Button>
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                Learn More
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
              <CardHeader>
                <Users className="h-12 w-12 text-purple-200 mb-4" />
                <CardTitle className="text-white">Role-Based Access</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-purple-100">
                  Tailored dashboards for students, advisors, and project officers with appropriate permissions.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
              <CardHeader>
                <FileText className="h-12 w-12 text-purple-200 mb-4" />
                <CardTitle className="text-white">Document Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-purple-100">
                  Structured document submission and approval workflow across all project phases.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
              <CardHeader>
                <Calendar className="h-12 w-12 text-purple-200 mb-4" />
                <CardTitle className="text-white">Deadline Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-purple-100">
                  Never miss important deadlines with automated notifications and progress tracking.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
              <CardHeader>
                <BarChart3 className="h-12 w-12 text-purple-200 mb-4" />
                <CardTitle className="text-white">Progress Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-purple-100">
                  Real-time visibility into project status and student progress across all phases.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action */}
          <div className="text-center">
            <Card className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Ready to Get Started?</CardTitle>
                <CardDescription className="text-purple-100">
                  Join the FYP Management System and experience streamlined project supervision.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="lg" onClick={() => navigate('/auth')} className="w-full bg-white text-purple-600 hover:bg-white/90">
                  Sign Up Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // If user is authenticated, this will be handled by the redirect above
  return null;
};

export default Index;
