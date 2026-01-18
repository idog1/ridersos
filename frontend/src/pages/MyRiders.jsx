import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from 'framer-motion';
import { Users, Home, ChevronRight, UserPlus, X, Clock } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LanguageSelector from '../components/LanguageSelector';
import Logo from '../components/Logo';
import { useTranslation } from '../components/translations';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function MyRiders() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [riderEmail, setRiderEmail] = useState('');
  const [addingRider, setAddingRider] = useState(false);
  const [connections, setConnections] = useState([]);
  const [pendingConnections, setPendingConnections] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);

        if (!userData.roles?.includes('Trainer')) {
          alert('You must be a trainer to access this page');
          navigate(createPageUrl('Dashboard'));
          return;
        }

        // Load approved connections and all users
        const allConnections = await base44.entities.UserConnection.filter({
          from_user_email: userData.email,
          connection_type: 'Trainer-Rider'
        });

        const users = await base44.entities.User.list();
        setAllUsers(users);
        setConnections(allConnections.filter(c => c.status === 'approved'));
        setPendingConnections(allConnections.filter(c => c.status === 'pending'));
      } catch (error) {
        console.error('Failed to load data:', error);
        base44.auth.redirectToLogin(createPageUrl('MyRiders'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [navigate]);

  const handleAddRider = async () => {
    if (!riderEmail.trim()) return;
    
    setAddingRider(true);
    try {
      const users = await base44.entities.User.list();
      const existingUser = users.find(u => u.email.toLowerCase() === riderEmail.toLowerCase().trim());
      
      // Check if already connected
      const existingConnection = [...connections, ...pendingConnections].find(
        c => c.to_user_email.toLowerCase() === riderEmail.toLowerCase().trim()
      );
      
      if (existingConnection) {
        alert('This rider is already connected or has a pending invitation');
        setAddingRider(false);
        return;
      }

      if (existingUser) {
        // User exists - create connection request
        const newConnection = await base44.entities.UserConnection.create({
          from_user_email: user.email,
          from_user_role: 'Trainer',
          to_user_email: riderEmail.trim(),
          connection_type: 'Trainer-Rider',
          status: 'pending',
          message: `${user.first_name || user.full_name || 'A trainer'} would like to add you to their team`
        });
        setPendingConnections(prev => [...prev, newConnection]);
        alert('Connection request sent! The rider will be notified to approve.');
      } else {
        // User doesn't exist - invite them
        await base44.users.inviteUser(riderEmail.trim(), 'user');
        alert('Invitation sent! Once they register, they will receive your connection request.');
      }
      
      setRiderEmail('');
    } catch (error) {
      console.error('Failed to add rider:', error);
      alert('Failed to add rider. Please try again.');
    } finally {
      setAddingRider(false);
    }
  };

  const handleRemoveRider = async (connectionId, riderEmail) => {
    if (!confirm(`Remove ${riderEmail} from your team?`)) return;
    
    try {
      await base44.entities.UserConnection.delete(connectionId);
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch (error) {
      console.error('Failed to remove rider:', error);
      alert('Failed to remove rider');
    }
  };

  const handleCancelInvitation = async (connectionId) => {
    if (!confirm('Cancel this invitation?')) return;
    
    try {
      await base44.entities.UserConnection.delete(connectionId);
      setPendingConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      alert('Failed to cancel invitation');
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

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Navigation */}
      <nav className="bg-white border-b border-[#1B4332]/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 flex items-center justify-between">
          <Logo />
          
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <NotificationBell user={user} />
            <Link 
              to={createPageUrl('Home')}
              className="flex items-center gap-2 text-sm text-[#1B4332]/60 hover:text-[#1B4332] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{t.nav.home}</span>
            </Link>
            <Button 
              onClick={() => navigate(createPageUrl('Dashboard'))}
              variant="outline"
              className="border-[#1B4332]/20 text-[#1B4332]"
            >
              {t.nav.dashboard}
            </Button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{t.myRiders.title}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1B4332] mb-2">
            {t.myRiders.title}
          </h1>
          <p className="text-[#1B4332]/60">
            {t.myRiders.subtitle}
          </p>
        </div>

        {/* Add Rider */}
        <Card className="bg-white border-[#1B4332]/10 shadow-sm mb-6">
          <CardHeader className="border-b border-[#1B4332]/10">
            <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-[#1B4332]" />
              </div>
              {t.myRiders.inviteRider}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  value={riderEmail}
                  onChange={(e) => setRiderEmail(e.target.value)}
                  placeholder="rider@example.com"
                  className="border-[#1B4332]/20"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddRider()}
                />
              </div>
              <Button
                onClick={handleAddRider}
                disabled={addingRider || !riderEmail.trim()}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {addingRider ? t.myRiders.inviting : t.myRiders.sendInvite}
              </Button>
            </div>
            <p className="text-xs text-[#1B4332]/60 mt-2">
              {t.manageStable.trainerInviteNote}
            </p>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {pendingConnections.length > 0 && (
          <Card className="bg-white border-[#1B4332]/10 shadow-sm mb-6">
            <CardHeader className="border-b border-[#1B4332]/10">
              <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                {t.myRiders.pendingInvitations} ({pendingConnections.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-2">
              {pendingConnections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div>
                    <p className="font-medium text-[#1B4332]">
                      {connection.to_user_email}
                    </p>
                    <Badge className="mt-1 bg-orange-100 text-orange-700">
                      {t.guardian.pending}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvitation(connection.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    {t.myRiders.cancelInvite}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Connected Riders */}
        <Card className="bg-white border-[#1B4332]/10 shadow-sm">
          <CardHeader className="border-b border-[#1B4332]/10">
            <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-[#1B4332]" />
              </div>
              {t.myRiders.connectedRiders} ({connections.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {connections.length > 0 ? (
              <div className="space-y-2">
                {connections.map((connection) => {
                  const rider = allUsers.find(u => u.email === connection.to_user_email);
                  const riderName = rider?.first_name && rider?.last_name 
                    ? `${rider.first_name} ${rider.last_name}`
                    : rider?.full_name || connection.to_user_email;
                  
                  return (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-3 bg-[#1B4332]/5 rounded-lg"
                    >
                      <div>
                        <p className="font-semibold text-[#1B4332] text-lg">
                          {riderName}
                        </p>
                        <p className="text-sm text-[#1B4332]/60">
                          {connection.to_user_email}
                        </p>
                        <p className="text-xs text-[#1B4332]/50 mt-1">
                          Connected on {new Date(connection.updated_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRider(connection.id, connection.to_user_email)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        {t.myRiders.remove}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[#1B4332]/60 text-center py-8">
                {t.myRiders.noRiders}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}