import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { motion } from 'framer-motion';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Check, 
  X,
  Home,
  ChevronRight,
  Clock,
  UserCog,
  MessageSquare,
  Eye,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Logo from '../components/Logo';
import { format } from 'date-fns';

export default function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        if (userData.role !== 'admin') {
          navigate(createPageUrl('Dashboard'));
          return;
        }
        setUser(userData);
      } catch (error) {
        base44.auth.redirectToLogin(createPageUrl('Admin'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const { data: stables = [] } = useQuery({
    queryKey: ['all-stables'],
    queryFn: () => base44.entities.Stable.list(),
    enabled: !!user,
    initialData: []
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['contact-messages'],
    queryFn: () => base44.entities.ContactMessage.list('-created_date'),
    enabled: !!user,
    initialData: []
  });

  const updateStableStatusMutation = useMutation({
    mutationFn: async ({ stableId, status, managerEmail }) => {
      await base44.entities.Stable.update(stableId, { approval_status: status });
      
      if (status === 'approved' && managerEmail) {
        const users = await base44.entities.User.list();
        const manager = users.find(u => u.email === managerEmail);
        if (manager && !manager.roles?.includes('StableManager')) {
          await base44.entities.User.update(manager.id, {
            roles: [...(manager.roles || []), 'StableManager']
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-stables'] });
    }
  });

  const changeManagerMutation = useMutation({
    mutationFn: async ({ stableId, oldEmail, newEmail }) => {
      await base44.entities.Stable.update(stableId, { manager_email: newEmail });
      
      const users = await base44.entities.User.list();
      const stables = await base44.entities.Stable.list();
      
      if (oldEmail) {
        const oldManager = users.find(u => u.email === oldEmail);
        const hasOtherStables = stables.some(s => s.manager_email === oldEmail && s.id !== stableId);
        if (oldManager && !hasOtherStables && oldManager.roles?.includes('StableManager')) {
          await base44.entities.User.update(oldManager.id, {
            roles: oldManager.roles.filter(r => r !== 'StableManager')
          });
        }
      }
      
      const newManager = users.find(u => u.email === newEmail);
      if (newManager && !newManager.roles?.includes('StableManager')) {
        await base44.entities.User.update(newManager.id, {
          roles: [...(newManager.roles || []), 'StableManager']
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-stables'] });
    }
  });

  const updateMessageStatusMutation = useMutation({
    mutationFn: ({ messageId, status }) => 
      base44.entities.ContactMessage.update(messageId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-messages'] });
    }
  });

  const deleteStableMutation = useMutation({
    mutationFn: async (stableId) => {
      await base44.entities.Stable.delete(stableId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-stables'] });
    }
  });

  const handleApproveStable = (stable) => {
    updateStableStatusMutation.mutate({ 
      stableId: stable.id, 
      status: 'approved',
      managerEmail: stable.manager_email 
    });
  };

  const handleRejectStable = (stableId) => {
    updateStableStatusMutation.mutate({ stableId, status: 'rejected' });
  };

  const handleChangeManager = (stable) => {
    const newEmail = prompt(`Change manager for "${stable.name}".\n\nCurrent: ${stable.manager_email}\n\nEnter new manager email:`);
    if (newEmail && newEmail !== stable.manager_email) {
      changeManagerMutation.mutate({
        stableId: stable.id,
        oldEmail: stable.manager_email,
        newEmail: newEmail.trim()
      });
    }
  };

  const handleMessageStatusChange = (messageId, status) => {
    updateMessageStatusMutation.mutate({ messageId, status });
  };

  const handleDeleteStable = (stable) => {
    if (confirm(`Are you sure you want to delete "${stable.name}"? This action cannot be undone.`)) {
      deleteStableMutation.mutate(stable.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const pendingStables = stables.filter(s => s.approval_status === 'pending');
  const approvedStables = stables.filter(s => s.approval_status === 'approved');
  const rejectedStables = stables.filter(s => s.approval_status === 'rejected');

  const newMessages = messages.filter(m => m.status === 'new');
  const readMessages = messages.filter(m => m.status === 'read');
  const resolvedMessages = messages.filter(m => m.status === 'resolved');

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Navigation */}
      <nav className="bg-white border-b border-[#1B4332]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo />
          
          <div className="flex items-center gap-4">
            <Link 
              to={createPageUrl('Dashboard')}
              className="flex items-center gap-2 text-sm text-[#1B4332]/60 hover:text-[#1B4332] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>Admin Panel</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1B4332] mb-2">Admin Panel</h1>
          <p className="text-[#1B4332]/60">Manage stables and contact messages</p>
        </div>

        <Tabs defaultValue="stables" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="stables" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Stables</span>
              {pendingStables.length > 0 && (
                <Badge className="bg-orange-500 text-white ml-2">{pendingStables.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
              {newMessages.length > 0 && (
                <Badge className="bg-orange-500 text-white ml-2">{newMessages.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Stables Tab */}
          <TabsContent value="stables">
            <div className="space-y-12">
              {/* Pending Stables */}
              {pendingStables.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-[#1B4332] mb-6 flex items-center gap-2">
                    <Clock className="w-6 h-6 text-orange-500" />
                    Pending Approval ({pendingStables.length})
                  </h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    {pendingStables.map((stable) => (
                      <StableCard 
                        key={stable.id} 
                        stable={stable} 
                        onApprove={() => handleApproveStable(stable)}
                        onReject={() => handleRejectStable(stable.id)}
                        onDelete={() => handleDeleteStable(stable)}
                        isPending
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Stables */}
              <div>
                <h2 className="text-2xl font-bold text-[#1B4332] mb-6 flex items-center gap-2">
                  <Check className="w-6 h-6 text-green-600" />
                  Approved Stables ({approvedStables.length})
                </h2>
                {approvedStables.length === 0 ? (
                  <p className="text-[#1B4332]/60">No approved stables yet</p>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {approvedStables.map((stable) => (
                      <StableCard 
                        key={stable.id} 
                        stable={stable}
                        onChangeManager={() => handleChangeManager(stable)}
                        onDelete={() => handleDeleteStable(stable)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Rejected Stables */}
              {rejectedStables.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-[#1B4332] mb-6 flex items-center gap-2">
                    <X className="w-6 h-6 text-red-500" />
                    Rejected ({rejectedStables.length})
                  </h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rejectedStables.map((stable) => (
                      <StableCard 
                        key={stable.id} 
                        stable={stable}
                        onApprove={() => handleApproveStable(stable)}
                        onDelete={() => handleDeleteStable(stable)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages">
            {selectedMessage ? (
              <MessageDetail 
                message={selectedMessage} 
                onBack={() => setSelectedMessage(null)}
                onStatusChange={handleMessageStatusChange}
              />
            ) : (
              <div className="space-y-8">
                {/* New Messages */}
                {newMessages.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-[#1B4332] mb-6 flex items-center gap-2">
                      <MessageSquare className="w-6 h-6 text-orange-500" />
                      New Messages ({newMessages.length})
                    </h2>
                    <div className="space-y-3">
                      {newMessages.map((message) => (
                        <MessageCard 
                          key={message.id} 
                          message={message}
                          onClick={() => setSelectedMessage(message)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Read Messages */}
                {readMessages.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-[#1B4332] mb-6 flex items-center gap-2">
                      <Eye className="w-6 h-6 text-blue-500" />
                      Read Messages ({readMessages.length})
                    </h2>
                    <div className="space-y-3">
                      {readMessages.map((message) => (
                        <MessageCard 
                          key={message.id} 
                          message={message}
                          onClick={() => setSelectedMessage(message)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolved Messages */}
                {resolvedMessages.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-[#1B4332] mb-6 flex items-center gap-2">
                      <Check className="w-6 h-6 text-green-600" />
                      Resolved ({resolvedMessages.length})
                    </h2>
                    <div className="space-y-3">
                      {resolvedMessages.map((message) => (
                        <MessageCard 
                          key={message.id} 
                          message={message}
                          onClick={() => setSelectedMessage(message)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {messages.length === 0 && (
                  <p className="text-center text-[#1B4332]/60 py-12">
                    No contact messages yet
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StableCard({ stable, onApprove, onReject, isPending, onChangeManager, onDelete }) {
  const statusColors = {
    pending: 'bg-orange-100 text-orange-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };

  return (
    <Card className="bg-white border-[#1B4332]/10">
      <CardHeader className="border-b border-[#1B4332]/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-[#1B4332]" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg text-[#1B4332] mb-2">
                {stable.name}
              </CardTitle>
              <Badge className={statusColors[stable.approval_status]}>
                {stable.approval_status}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-3">
        {stable.description && (
          <p className="text-sm text-[#1B4332]/80 pb-2 border-b border-[#1B4332]/10">
            {stable.description}
          </p>
        )}
        {stable.address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-[#8B5A2B] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[#1B4332]">{stable.address}</p>
              {(stable.city || stable.state) && (
                <p className="text-[#1B4332]/60">
                  {[stable.city, stable.state, stable.country].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
        {stable.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-[#8B5A2B]" />
            <span className="text-[#1B4332]">{stable.phone}</span>
          </div>
        )}
        {stable.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-[#8B5A2B]" />
            <span className="text-[#1B4332] truncate">{stable.email}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-[#1B4332]/10">
          <div className="text-xs text-[#1B4332]/60">
            Manager: {stable.manager_email}
          </div>
          <div className="flex items-center gap-2">
            {onChangeManager && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onChangeManager}
                className="h-6 px-2 text-xs text-[#1B4332] hover:bg-[#1B4332]/10"
              >
                <UserCog className="w-3 h-3 mr-1" />
                Change
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-6 px-2 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {(isPending || stable.approval_status === 'rejected') && onApprove && (
          <div className="flex gap-2 pt-3">
            {isPending && onReject && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(stable.id)}
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-1" />
                Reject
              </Button>
            )}
            <Button
              size="sm"
              onClick={onApprove}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="w-4 h-4 mr-1" />
              Approve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessageCard({ message, onClick }) {
  const typeColors = {
    'General': 'bg-blue-100 text-blue-800',
    'Bug Report': 'bg-red-100 text-red-800',
    'Feature Suggestion': 'bg-purple-100 text-purple-800'
  };

  const statusColors = {
    'new': 'bg-orange-100 text-orange-800',
    'read': 'bg-blue-100 text-blue-800',
    'resolved': 'bg-green-100 text-green-800'
  };

  return (
    <Card 
      className="bg-white border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-[#1B4332] mb-1">{message.subject}</h3>
            <div className="flex flex-wrap gap-2">
              <Badge className={typeColors[message.type]}>
                {message.type}
              </Badge>
              <Badge className={statusColors[message.status]}>
                {message.status}
              </Badge>
            </div>
          </div>
          <Eye className="w-5 h-5 text-[#1B4332]/40" />
        </div>
        <p className="text-sm text-[#1B4332]/70 mb-2 line-clamp-2">
          {message.message}
        </p>
        <div className="flex items-center justify-between text-xs text-[#1B4332]/60">
          <span>{message.sender_name || message.sender_email || 'Anonymous'}</span>
          <span>{format(new Date(message.created_date), 'MMM d, yyyy')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageDetail({ message, onBack, onStatusChange }) {
  const typeColors = {
    'General': 'bg-blue-100 text-blue-800',
    'Bug Report': 'bg-red-100 text-red-800',
    'Feature Suggestion': 'bg-purple-100 text-purple-800'
  };

  return (
    <Card className="bg-white border-[#1B4332]/10">
      <CardHeader className="border-b border-[#1B4332]/10">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-[#1B4332]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <CardTitle className="text-2xl text-[#1B4332] mb-3">
          {message.subject}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge className={typeColors[message.type]}>
            {message.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="font-semibold text-[#1B4332] mb-2">From</h3>
          <div className="space-y-1">
            {message.sender_name && (
              <p className="text-[#1B4332]">{message.sender_name}</p>
            )}
            {message.sender_email && (
              <p className="text-[#1B4332]/70 text-sm">{message.sender_email}</p>
            )}
            {!message.sender_name && !message.sender_email && (
              <p className="text-[#1B4332]/60 text-sm">Anonymous</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-[#1B4332] mb-2">Date</h3>
          <p className="text-[#1B4332]/70">
            {format(new Date(message.created_date), 'MMMM d, yyyy \'at\' h:mm a')}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-[#1B4332] mb-2">Message</h3>
          <div className="bg-[#1B4332]/5 rounded-lg p-4">
            <p className="text-[#1B4332] whitespace-pre-wrap">{message.message}</p>
          </div>
        </div>

        <div className="border-t border-[#1B4332]/10 pt-6">
          <h3 className="font-semibold text-[#1B4332] mb-3">Status</h3>
          <div className="flex gap-2">
            <Button
              variant={message.status === 'new' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onStatusChange(message.id, 'new')}
              className={message.status === 'new' ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              New
            </Button>
            <Button
              variant={message.status === 'read' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onStatusChange(message.id, 'read')}
              className={message.status === 'read' ? 'bg-blue-500 hover:bg-blue-600' : ''}
            >
              Read
            </Button>
            <Button
              variant={message.status === 'resolved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onStatusChange(message.id, 'resolved')}
              className={message.status === 'resolved' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Resolved
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}