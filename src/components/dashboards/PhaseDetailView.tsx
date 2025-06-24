import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, FileText, MessageSquare, ArrowLeft, CheckCircle, AlertCircle, Clock, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type Document = Database['public']['Tables']['documents']['Row'];
type PhaseType = Database['public']['Enums']['fyp_phase'];

interface Comment {
  id: string;
  document_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    role: Database['public']['Enums']['user_role'] | null;
  } | null;
}

interface PhaseDetailViewProps {
  phase: string;
  projectId: string;
  onBack: () => void;
  isLocked: boolean;
}

const PhaseDetailView = ({ phase, projectId, onBack, isLocked }: PhaseDetailViewProps) => {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [newComment, setNewComment] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const getPhaseTitle = (phase: string) => {
    const phases = {
      phase1: 'Phase 1: Project Proposal',
      phase2: 'Phase 2: Literature Review',
      phase3: 'Phase 3: Implementation',
      phase4: 'Phase 4: Final Report'
    };
    return phases[phase as keyof typeof phases] || phase;
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
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
    }
  };

  const uploadFileToStorage = async (file: File, fileName: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${projectId}/${phase}/${fileName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('fyp-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get the public URL
      const { data } = supabase.storage
        .from('fyp-documents')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [phase, projectId]);

  const fetchDocuments = async () => {
    try {
      const { data: docsData, error } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('phase', phase as PhaseType)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setDocuments(docsData || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (documentId: string) => {
    try {
      const { data, error } = await supabase
        .from('document_comments')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    }
  };

  const handleUploadDocument = async () => {
    if (!documentTitle.trim() || !documentFile) {
      toast.error('Please provide both title and file');
      return;
    }

    setUploading(true);
    try {
      // Upload file to storage
      const fileUrl = await uploadFileToStorage(documentFile, documentTitle);
      
      if (!fileUrl) {
        throw new Error('Failed to upload file');
      }

      // Insert document record with file URL
      const { error } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          phase: phase as PhaseType,
          title: documentTitle,
          submitted_by: profile?.id,
          status: 'pending',
          file_url: fileUrl
        });

      if (error) throw error;

      toast.success('Document uploaded successfully');
      setUploadDialogOpen(false);
      setDocumentTitle('');
      setDocumentFile(null);
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (document: Document) => {
    if (!document.file_url) {
      toast.error('No file available for download');
      return;
    }

    try {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = document.file_url;
      link.download = `${document.title}.pdf`; // You might want to extract the actual file extension
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download document');
    }
  };

  const handleRequestReview = async (documentId: string) => {
    try {
      // Update document status to pending and add notification for advisor
      const { error } = await supabase
        .from('documents')
        .update({ status: 'pending' })
        .eq('id', documentId);

      if (error) throw error;

      toast.success('Review requested successfully');
      fetchDocuments();
    } catch (error) {
      console.error('Error requesting review:', error);
      toast.error('Failed to request review');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedDocument) return;

    try {
      const { error } = await supabase
        .from('document_comments')
        .insert({
          document_id: selectedDocument.id,
          user_id: profile?.id,
          comment: newComment
        });

      if (error) throw error;

      setNewComment('');
      fetchComments(selectedDocument.id);
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const openDocumentDetails = (document: Document) => {
    setSelectedDocument(document);
    fetchComments(document.id);
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{getPhaseTitle(phase)}</h1>
            {isLocked && (
              <p className="text-sm text-red-600 mt-1">
                Complete previous phases to unlock this phase
              </p>
            )}
          </div>
        </div>
        {!isLocked && (
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Upload a document for {getPhaseTitle(phase)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Document Title</Label>
                  <Input
                    id="title"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    placeholder="Enter document title"
                  />
                </div>
                <div>
                  <Label htmlFor="file">Select File</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.txt"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUploadDocument} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Documents List */}
      <div className="grid grid-cols-1 gap-4">
        {documents.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents</h3>
              <p className="text-gray-600">No documents have been uploaded for this phase yet.</p>
            </CardContent>
          </Card>
        ) : (
          documents.map((document) => (
            <Card key={document.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{document.title}</CardTitle>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(document.status || 'pending')}
                    {getStatusBadge(document.status || 'pending')}
                  </div>
                </div>
                <CardDescription>
                  Submitted on {document.submitted_at ? new Date(document.submitted_at).toLocaleDateString() : 'Unknown'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    {document.status === 'rejected' && document.advisor_feedback && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <p className="text-sm font-medium text-red-800">Advisor Feedback:</p>
                        <p className="text-sm text-red-700 mt-1">{document.advisor_feedback}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {document.file_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadDocument(document)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDocumentDetails(document)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    {document.status !== 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => handleRequestReview(document.id)}
                      >
                        Request Review
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Document Details Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title}</DialogTitle>
            <DialogDescription>
              Document details and communication thread
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Document Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Status:</span>
                {selectedDocument && getStatusBadge(selectedDocument.status || 'pending')}
              </div>
              <div className="text-sm text-gray-600">
                Submitted: {selectedDocument?.submitted_at && new Date(selectedDocument.submitted_at).toLocaleString()}
              </div>
              {selectedDocument?.file_url && (
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedDocument && handleDownloadDocument(selectedDocument)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Document
                  </Button>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center">
                <MessageSquare className="h-4 w-4 mr-2" />
                Comments & Communication
              </h4>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {comment.profiles?.full_name || 'Unknown User'}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {comment.profiles?.role || 'unknown'}
                        </Badge>
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.comment}</p>
                  </div>
                ))}
              </div>

              {/* Add Comment */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment or response..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                  Add Comment
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhaseDetailView;
