
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Chatbot from './Chatbot';
import NotificationDropdown from './NotificationDropdown';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'student':
        return 'bg-purple-100 text-purple-800';
      case 'advisor':
        return 'bg-purple-100 text-purple-800';
      case 'project_officer':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'project_officer':
        return 'Project Officer';
      case 'advisor':
        return 'Advisor';
      case 'student':
        return 'Student';
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-purple-600" />
                <h1 className="text-xl font-bold text-gray-900">Proactive</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {profile && (
                <>
                  <Badge className={getRoleColor(profile.role)}>
                    {getRoleLabel(profile.role)}
                  </Badge>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {profile.full_name}
                    </span>
                  </div>
                </>
              )}
              <NotificationDropdown />
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Chatbot */}
      <Chatbot />
    </div>
  );
};

export default Layout;
