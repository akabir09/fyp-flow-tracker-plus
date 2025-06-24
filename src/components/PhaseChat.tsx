
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type ChatMessage = Database['public']['Tables']['phase_chat_messages']['Row'] & {
  profiles: {
    full_name: string | null;
    role: Database['public']['Enums']['user_role'] | null;
  } | null;
};

interface PhaseChatProps {
  projectId: string;
  phase: string;
}

const PhaseChat = ({ projectId, phase }: PhaseChatProps) => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();
    subscribeToMessages();

    // Cleanup function
    return () => {
      if (channelRef.current) {
        console.log('Cleaning up channel subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId, phase]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('phase_chat_messages')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('project_id', projectId)
        .eq('phase', phase)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load chat messages');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    // Clean up existing channel if it exists
    if (channelRef.current) {
      console.log('Removing existing channel before creating new one');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new channel with unique name to avoid conflicts
    const channelName = `phase-chat-${projectId}-${phase}-${Date.now()}`;
    console.log('Creating new channel:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'phase_chat_messages',
          filter: `project_id=eq.${projectId}`
        },
        async (payload) => {
          console.log('Received new message:', payload);
          // Fetch the complete message with profile data
          const { data } = await supabase
            .from('phase_chat_messages')
            .select(`
              *,
              profiles(full_name, role)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data && data.phase === phase) {
            setMessages(prev => [...prev, data]);
          }
        }
      )
      .subscribe((status) => {
        console.log('Channel subscription status:', status);
      });

    channelRef.current = channel;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !profile) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('phase_chat_messages')
        .insert({
          project_id: projectId,
          phase: phase,
          user_id: profile.id,
          message: newMessage.trim()
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getRoleColor = (role: string | null) => {
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

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'project_officer':
        return 'Project Officer';
      case 'advisor':
        return 'Advisor';
      case 'student':
        return 'Student';
      default:
        return 'User';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">Loading chat...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <MessageCircle className="h-5 w-5" />
          <span>Phase Discussion</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwnMessage = message.user_id === profile?.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isOwnMessage
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border shadow-sm'
                    }`}
                  >
                    {!isOwnMessage && (
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {message.profiles?.full_name || 'Unknown User'}
                        </span>
                        <Badge 
                          className={`text-xs ${getRoleColor(message.profiles?.role)}`}
                        >
                          {getRoleLabel(message.profiles?.role)}
                        </Badge>
                      </div>
                    )}
                    
                    <p className={`text-sm ${isOwnMessage ? 'text-white' : 'text-gray-800'}`}>
                      {message.message}
                    </p>
                    
                    <div className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 bg-white border-t">
          <div className="flex space-x-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PhaseChat;
