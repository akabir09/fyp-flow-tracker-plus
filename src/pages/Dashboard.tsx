
import { useAuth } from '@/hooks/useAuth';
import StudentDashboard from '@/components/dashboards/StudentDashboard';
import AdvisorDashboard from '@/components/dashboards/AdvisorDashboard';
import ProjectOfficerDashboard from '@/components/dashboards/ProjectOfficerDashboard';

const Dashboard = () => {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Profile not found</h2>
        <p className="text-gray-600 mt-2">Please try signing out and signing in again.</p>
      </div>
    );
  }

  switch (profile.role) {
    case 'student':
      return <StudentDashboard />;
    case 'advisor':
      return <AdvisorDashboard />;
    case 'project_officer':
      return <ProjectOfficerDashboard />;
    default:
      return (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Invalid Role</h2>
          <p className="text-gray-600 mt-2">Your account role is not recognized.</p>
        </div>
      );
  }
};

export default Dashboard;
