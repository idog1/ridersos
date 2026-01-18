import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  UserCog
} from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from '../components/translations';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminStables() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
        base44.auth.redirectToLogin(createPageUrl('AdminStables'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const { data: stables, isLoading } = useQuery({
    queryKey: ['all-stables'],
    queryFn: () => base44.entities.Stable.list(),
    initialData: []
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ stableId, status, managerEmail }) => {
      await base44.entities.Stable.update(stableId, { approval_status: status });
      
      // Assign StableManager role when approving
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

  const handleApprove = (stable) => {
    updateStatusMutation.mutate({ 
      stableId: stable.id, 
      status: 'approved',
      managerEmail: stable.manager_email 
    });
  };

  const handleReject = (stableId) => {
    updateStatusMutation.mutate({ stableId, status: 'rejected' });
  };

  const changeManagerMutation = useMutation({
    mutationFn: async ({ stableId, oldEmail, newEmail }) => {
      // Update stable with new manager
      await base44.entities.Stable.update(stableId, { manager_email: newEmail });
      
      const users = await base44.entities.User.list();
      const stables = await base44.entities.Stable.list();
      
      // Remove StableManager role from old manager if no other stables
      if (oldEmail) {
        const oldManager = users.find(u => u.email === oldEmail);
        const hasOtherStables = stables.some(s => s.manager_email === oldEmail && s.id !== stableId);
        if (oldManager && !hasOtherStables && oldManager.roles?.includes('StableManager')) {
          await base44.entities.User.update(oldManager.id, {
            roles: oldManager.roles.filter(r => r !== 'StableManager')
          });
        }
      }
      
      // Add StableManager role to new manager
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

  if (loading || isLoading) {
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

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Navigation */}
      <nav className="bg-white border-b border-[#1B4332]/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 flex items-center justify-between">
          <Link to={createPageUrl('Home')} className="text-xl font-semibold text-[#1B4332] tracking-tight">
            RaidersOS.app
          </Link>
          
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <Link 
              to={createPageUrl('Dashboard')}
              className="flex items-center gap-2 text-sm text-[#1B4332]/60 hover:text-[#1B4332] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{t.nav.dashboard}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{t.admin.breadcrumb}</span>
          <ChevronRight className="w-4 h-4" />
          <span>{t.admin.stables}</span>
        </div>

        <div className="mb-12">
          <h1 className="text-4xl font-bold text-[#1B4332] mb-3">
            {t.quickActions.manageStable}
          </h1>
          <p className="text-[#1B4332]/60 text-lg">
            {t.admin.subtitle}
          </p>
        </div>

        {/* Pending Stables */}
        {pendingStables.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-[#1B4332] mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-orange-500" />
              {t.admin.pendingApproval} ({pendingStables.length})
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {pendingStables.map((stable) => (
                <StableCard 
                  key={stable.id} 
                  stable={stable} 
                  onApprove={() => handleApprove(stable)}
                  onReject={() => handleReject(stable.id)}
                  isPending
                />
              ))}
            </div>
          </div>
        )}

        {/* Approved Stables */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#1B4332] mb-6 flex items-center gap-2">
            <Check className="w-6 h-6 text-green-600" />
            {t.admin.approvedStables} ({approvedStables.length})
          </h2>
          {approvedStables.length === 0 ? (
            <p className="text-[#1B4332]/60">{t.admin.noApproved}</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {approvedStables.map((stable) => (
                <StableCard 
                  key={stable.id} 
                  stable={stable}
                  onChangeManager={() => handleChangeManager(stable)}
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
              {t.admin.rejected} ({rejectedStables.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rejectedStables.map((stable) => (
                <StableCard 
                  key={stable.id} 
                  stable={stable}
                  onApprove={() => handleApprove(stable)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StableCard({ stable, onApprove, onReject, isPending, onChangeManager }) {
  const t = useTranslation();
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
            {t.admin.manager}: {stable.manager_email}
          </div>
          {onChangeManager && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onChangeManager}
              className="h-6 px-2 text-xs text-[#1B4332] hover:bg-[#1B4332]/10"
            >
              <UserCog className="w-3 h-3 mr-1" />
              {t.admin.change}
            </Button>
          )}
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
                {t.admin.reject}
              </Button>
            )}
            <Button
              size="sm"
              onClick={onApprove}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="w-4 h-4 mr-1" />
              {t.admin.approve}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}