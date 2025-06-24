
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, LogOut, User, FileText, Users, Settings, MessageSquare, Send, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface GeneralComment {
  id: string;
  comment: string;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();
  const [comments, setComments] = useState<GeneralComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    try {
      const { data: commentsData } = await supabase
        .from('document_comments')
        .select(`
          *,
          user:profiles!user_id(id, full_name, email, role)
        `)
        .is('document_id', null)
        .order('created_at', { ascending: false })
        .limit(20);

      setComments(commentsData || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !profile) {
      toast.error('Please enter a comment');
      return;
    }

    setIsSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('document_comments')
        .insert({
          comment: newComment.trim(),
          user_id: profile.id,
          document_id: null
        });

      if (error) throw error;

      setNewComment('');
      toast.success('Comment added successfully');
      fetchComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast.error('Failed to submit comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'student':
        return 'bg-blue-100 text-blue-800';
      case 'advisor':
        return 'bg-green-100 text-green-800';
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

  const getUserInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (role: string) => {
    switch (role) {
      case 'student':
        return 'bg-blue-500';
      case 'advisor':
        return 'bg-green-500';
      case 'project_officer':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getMessageAlignment = (userId: string) => {
    return userId === profile?.id ? 'flex-row-reverse' : 'flex-row';
  };

  const getMessageBgColor = (userId: string, role: string) => {
    if (userId === profile?.id) {
      return 'bg-blue-500 text-white';
    }
    
    switch (role) {
      case 'advisor':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'project_officer':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'student':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
                <FileText className="h-8 w-8 text-blue-600" />
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
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
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
        
        {/* Comments Section */}
        <div className="mt-12 border-t border-gray-200 pt-8">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>General Discussion</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Comment Input */}
              <div className="flex space-x-3">
                <Avatar>
                  <AvatarFallback className={`${getAvatarColor(profile?.role || '')} text-white`}>
                    {profile?.full_name ? getUserInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={submitComment}
                      disabled={isSubmittingComment || !newComment.trim()}
                      size="sm"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No comments yet. Start the conversation!</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`flex space-x-3 ${getMessageAlignment(comment.user.id)}`}
                    >
                      <Avatar className={comment.user.id === profile?.id ? 'order-last' : ''}>
                        <AvatarFallback className={`${getAvatarColor(comment.user.role)} text-white`}>
                          {getUserInitials(comment.user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex-1 max-w-xs ${comment.user.id === profile?.id ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-3 rounded-lg border ${getMessageBgColor(comment.user.id, comment.user.role)}`}>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium">
                              {comment.user.full_name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {getRoleLabel(comment.user.role)}
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed">{comment.comment}</p>
                          <div className="flex items-center space-x-1 mt-2">
                            <Calendar className="h-3 w-3 opacity-50" />
                            <span className="text-xs opacity-75">
                              {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Layout;
