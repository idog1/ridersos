import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from 'framer-motion';
import { Home, ChevronRight, Users, Calendar, DollarSign, UserPlus, Clock, CheckCircle2, Trophy } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LanguageSelector from '../components/LanguageSelector';
import Logo from '../components/Logo';
import { useTranslation } from '../components/translations';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';

export default function Guardian() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [riderEmail, setRiderEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [dateRange, setDateRange] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customRange, setCustomRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        
        // Check if any riders have this user as their parent
        const allUsers = await base44.entities.User.list();
        const hasChildren = allUsers.some(u => 
          u.parent_email && userData.email && 
          u.parent_email.toLowerCase() === userData.email.toLowerCase()
        );
        
        // If user has children but doesn't have Parent/Guardian role, add it
        if (hasChildren && !userData.roles?.includes('Parent/Guardian')) {
          await base44.auth.updateMe({
            roles: [...(userData.roles || []), 'Parent/Guardian']
          });
          userData.roles = [...(userData.roles || []), 'Parent/Guardian'];
        }
        
        // If no Parent/Guardian role and no children, redirect
        if (!userData.roles?.includes('Parent/Guardian')) {
          alert('This page is only accessible to parents/guardians');
          navigate(createPageUrl('Dashboard'));
          return;
        }
        
        setUser(userData);
      } catch (error) {
        base44.auth.redirectToLogin(createPageUrl('Guardian'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-guardian'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: guardianRelationships = [], refetch: refetchRelationships } = useQuery({
    queryKey: ['guardian-relationships', user?.email],
    queryFn: () => base44.entities.GuardianMinor.filter({
      guardian_email: user.email.toLowerCase(),
      status: 'active'
    }),
    enabled: !!user,
    staleTime: 0,
    cacheTime: 0
  });

  // Get riders based on both GuardianMinor relationships AND parent_email (fallback)
  const myRiderEmails = guardianRelationships.map(r => r.minor_email.toLowerCase());
  const myRiders = allUsers.filter(u => {
    // Check GuardianMinor relationship first
    if (myRiderEmails.includes(u.email.toLowerCase())) return true;
    // Fallback to parent_email field
    if (u.parent_email && user?.email && 
        u.parent_email.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;
    return false;
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ['all-sessions'],
    queryFn: () => base44.entities.TrainingSession.list(),
    enabled: !!user && myRiders.length > 0,
    initialData: []
  });

  const { data: billingRates = [] } = useQuery({
    queryKey: ['billing-rates'],
    queryFn: () => base44.entities.BillingRate.list(),
    enabled: !!user,
    initialData: []
  });

  const { data: allCompetitions = [] } = useQuery({
    queryKey: ['all-competitions'],
    queryFn: () => base44.entities.Competition.list(),
    enabled: !!user && myRiders.length > 0,
    initialData: []
  });

  // Filter sessions and competitions for my riders
  const riderEmails = myRiders.map(r => r.email);
  const riderSessions = allSessions.filter(s => riderEmails.includes(s.rider_email));
  const riderCompetitions = allCompetitions.filter(c => 
    c.riders?.some(r => riderEmails.includes(r.rider_email))
  );

  // Apply date range filter
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'year':
        return { from: startOfYear(now), to: endOfYear(now) };
      case 'specific':
        const specificDate = new Date(selectedYear, selectedMonth, 1);
        return { from: startOfMonth(specificDate), to: endOfMonth(specificDate) };
      case 'custom':
        return customRange;
      default:
        return { from: startOfMonth(now), to: endOfMonth(now) };
    }
  };

  const range = getDateRange();
  const filteredSessions = riderSessions.filter(session => {
    const sessionDate = new Date(session.session_date);
    return sessionDate >= range.from && sessionDate <= range.to;
  });
  const filteredCompetitions = riderCompetitions.filter(comp => {
    const compDate = new Date(comp.competition_date);
    return compDate >= range.from && compDate <= range.to;
  });

  // Calculate balance
  const verifiedSessions = filteredSessions.filter(s => s.rider_verified);
  const calculateBalance = () => {
    let total = 0;
    const breakdown = {};

    // Regular sessions
    verifiedSessions.forEach(session => {
      const rate = billingRates.find(r => 
        r.trainer_email === session.trainer_email && 
        r.session_type === session.session_type
      );

      if (rate) {
        total += rate.rate;
        
        const trainerKey = session.trainer_name || session.trainer_email;
        if (!breakdown[trainerKey]) {
          breakdown[trainerKey] = {
            sessions: [],
            competitions: [],
            total: 0,
            currency: rate.currency
          };
        }
        breakdown[trainerKey].sessions.push({
          ...session,
          rate: rate.rate
        });
        breakdown[trainerKey].total += rate.rate;
      }
    });

    // Competitions
    filteredCompetitions.forEach(comp => {
      const myRidersInComp = comp.riders?.filter(r => riderEmails.includes(r.rider_email)) || [];
      
      myRidersInComp.forEach(rider => {
        if (rider.payment_status !== 'paid') return;

        rider.services?.forEach(service => {
          const rate = billingRates.find(r => 
            r.trainer_email === comp.trainer_email && 
            r.session_type === service
          );

          if (rate) {
            total += rate.rate;
            
            const trainerKey = comp.trainer_name || comp.trainer_email;
            if (!breakdown[trainerKey]) {
              breakdown[trainerKey] = {
                sessions: [],
                competitions: [],
                total: 0,
                currency: rate.currency
              };
            }

            // Find existing competition or add new one
            let compEntry = breakdown[trainerKey].competitions.find(c => c.id === comp.id);
            if (!compEntry) {
              compEntry = {
                id: comp.id,
                name: comp.name,
                date: comp.competition_date,
                location: comp.location,
                riders: []
              };
              breakdown[trainerKey].competitions.push(compEntry);
            }

            // Add rider service
            let riderEntry = compEntry.riders.find(r => r.rider_email === rider.rider_email);
            if (!riderEntry) {
              riderEntry = {
                rider_email: rider.rider_email,
                rider_name: rider.rider_name,
                services: {}
              };
              compEntry.riders.push(riderEntry);
            }
            
            if (!riderEntry.services[service]) {
              riderEntry.services[service] = { count: 0, amount: 0 };
            }
            riderEntry.services[service].count++;
            riderEntry.services[service].amount += rate.rate;

            breakdown[trainerKey].total += rate.rate;
          }
        });
      });
    });

    return { total, breakdown };
  };

  const { total, breakdown } = calculateBalance();
  const currency = billingRates[0]?.currency || 'ILS';

  const handleInviteRider = async () => {
    if (!riderEmail.trim()) return;

    setInviting(true);
    try {
      // Check if user exists
      const existingUser = allUsers.find(u => u.email.toLowerCase() === riderEmail.toLowerCase().trim());
      
      if (existingUser) {
        // Check if already linked
        const existingRelationship = guardianRelationships.find(r => 
          r.minor_email.toLowerCase() === existingUser.email.toLowerCase()
        );
        
        if (existingRelationship) {
          alert('This rider is already under your guardianship');
          setInviting(false);
          return;
        }
        
        // Check if they're a minor
        if (existingUser.birthday) {
          const birthDate = new Date(existingUser.birthday);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const isMinor = age < 18 || (age === 18 && monthDiff < 0);
          
          if (isMinor) {
            // Update their parent_email and create relationship
            await base44.entities.User.update(existingUser.id, {
              parent_email: user.email
            });
            await base44.entities.GuardianMinor.create({
              guardian_email: user.email.toLowerCase(),
              minor_email: existingUser.email.toLowerCase(),
              relationship: 'parent',
              status: 'active'
            });
            
            alert('Rider added successfully!');
            refetchRelationships();
          } else {
            alert('This user is not a minor and does not need a guardian');
          }
        } else {
          alert('Cannot determine if this user is a minor. Please ask them to update their birthday.');
        }
      } else {
        // Invite new user and create pending relationship
        await base44.users.inviteUser(riderEmail.trim(), 'user');
        await base44.entities.GuardianMinor.create({
          guardian_email: user.email.toLowerCase(),
          minor_email: riderEmail.toLowerCase().trim(),
          relationship: 'parent',
          status: 'pending'
        });
        
        alert('Invitation sent! Once they register as a minor rider, they will be linked to your account.');
        refetchRelationships();
      }
      
      setRiderEmail('');
    } catch (error) {
      console.error('Failed to invite rider:', error);
      alert('Failed to invite rider. Please try again.');
    } finally {
      setInviting(false);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo />
          
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <NotificationBell user={user} />
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{t.guardian.title}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1B4332] mb-2">{t.guardian.title}</h1>
          <p className="text-[#1B4332]/60">{t.guardian.subtitle}</p>
        </div>

        <Tabs defaultValue="riders" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 h-auto">
            <TabsTrigger value="riders" className="text-xs sm:text-sm px-2 py-2">
              <span className="hidden sm:inline">{t.guardian.myRiders}</span>
              <span className="sm:hidden">{t.guardian.riders}</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs sm:text-sm px-2 py-2">{t.guardian.schedule}</TabsTrigger>
            <TabsTrigger value="balance" className="text-xs sm:text-sm px-2 py-2">
              <span className="hidden sm:inline">{t.guardian.activityBalance}</span>
              <span className="sm:hidden">{t.guardian.balance}</span>
            </TabsTrigger>
          </TabsList>

          {/* My Riders Tab */}
          <TabsContent value="riders">
            <div className="space-y-6">
              {/* Invite Rider */}
              <Card className="bg-white border-[#1B4332]/10 shadow-sm">
                <CardHeader className="border-b border-[#1B4332]/10 p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl text-[#1B4332] flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                      <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-[#1B4332]" />
                    </div>
                    <span className="text-base sm:text-xl">{t.guardian.addRider}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Input
                        type="email"
                        value={riderEmail}
                        onChange={(e) => setRiderEmail(e.target.value)}
                        placeholder="rider@example.com"
                        className="border-[#1B4332]/20"
                        onKeyPress={(e) => e.key === 'Enter' && handleInviteRider()}
                      />
                    </div>
                    <Button
                      onClick={handleInviteRider}
                      disabled={inviting || !riderEmail.trim()}
                      className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white w-full sm:w-auto"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {inviting ? t.guardian.adding : t.common.add}
                    </Button>
                  </div>
                  <p className="text-xs text-[#1B4332]/60 mt-2">
                    {t.guardian.enterMinorEmail}
                  </p>
                </CardContent>
              </Card>

              {/* Riders List */}
              <Card className="bg-white border-[#1B4332]/10 shadow-sm">
                <CardHeader className="border-b border-[#1B4332]/10 p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl text-[#1B4332] flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#1B4332]" />
                    </div>
                    <span className="text-base sm:text-xl">{t.guardian.myRiders} ({myRiders.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {myRiders.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {myRiders.map((rider) => (
                        <div
                          key={rider.id}
                          className="p-4 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-[#1B4332] rounded-full flex items-center justify-center text-white font-semibold">
                              {(rider.first_name?.[0] || rider.full_name?.[0] || 'R').toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-semibold text-[#1B4332]">
                                {rider.first_name && rider.last_name 
                                  ? `${rider.first_name} ${rider.last_name}`
                                  : rider.full_name || rider.email}
                              </h3>
                              <p className="text-sm text-[#1B4332]/60">{rider.email}</p>
                            </div>
                          </div>
                          {rider.birthday && (
                            <p className="text-xs text-[#1B4332]/60">
                              {t.guardian.birthday} {format(new Date(rider.birthday), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-[#1B4332]/60 py-8">
                      {t.guardian.noRiders}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule">
            <div className="space-y-6">
              {/* Upcoming Competitions with Payment Requests */}
              {riderCompetitions.filter(c => new Date(c.competition_date) >= new Date() && c.status !== 'cancelled').length > 0 && (
                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                  <CardHeader className="border-b border-amber-200/50 p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-xl text-[#1B4332] flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <span className="text-sm sm:text-xl leading-tight">{t.guardian.upcomingCompetitions}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="space-y-4">
                      {riderCompetitions
                        .filter(c => new Date(c.competition_date) >= new Date() && c.status !== 'cancelled')
                        .sort((a, b) => new Date(a.competition_date) - new Date(b.competition_date))
                        .map((comp) => {
                          const myRidersInComp = comp.riders?.filter(r => riderEmails.includes(r.rider_email)) || [];
                          
                          return (
                            <div key={comp.id} className="p-3 sm:p-4 bg-white rounded-lg border-2 border-amber-300">
                              <div className="mb-3">
                                <div className="flex items-start gap-2 mb-1">
                                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-[#1B4332] text-sm sm:text-lg break-words">{comp.name}</h3>
                                  </div>
                                </div>
                                <p className="text-xs sm:text-sm text-[#1B4332]/60 ml-6 sm:ml-7">
                                  {format(new Date(comp.competition_date), 'EEE, MMM d, yyyy - h:mm a')}
                                </p>
                                <p className="text-xs sm:text-sm text-[#1B4332]/60 ml-6 sm:ml-7 break-words">
                                  📍 {comp.location}
                                </p>
                                <p className="text-xs text-[#1B4332]/50 ml-6 sm:ml-7 mt-1 break-words">
                                  {t.guardian.trainer} {comp.trainer_name || comp.trainer_email}
                                </p>
                              </div>
                              
                              <div className="space-y-3">
                                {myRidersInComp.map((rider, idx) => {
                                  const myRider = myRiders.find(r => r.email === rider.rider_email);
                                  const totalCost = rider.services?.reduce((sum, service) => {
                                    const rate = billingRates.find(r => 
                                      r.trainer_email === comp.trainer_email && 
                                      r.session_type === service
                                    );
                                    return sum + (rate?.rate || 0);
                                  }, 0) || 0;
                                  const paymentStatus = rider.payment_status || 'pending';
                                  
                                  return (
                                    <div key={idx} className="p-2 sm:p-3 bg-amber-50/50 rounded-lg border border-amber-200">
                                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm sm:text-base text-[#1B4332] break-words">
                                            {myRider?.first_name && myRider?.last_name 
                                              ? `${myRider.first_name} ${myRider.last_name}`
                                              : myRider?.full_name || rider.rider_name}
                                          </div>
                                          <div className="text-xs sm:text-sm text-[#1B4332]/70 mt-1 break-words">
                                            {t.guardian.services} {rider.services?.join(', ')}
                                          </div>
                                          {totalCost > 0 && (
                                            <div className="text-base sm:text-lg font-bold text-amber-700 mt-2">
                                              {billingRates[0]?.currency || 'ILS'} {totalCost.toFixed(2)}
                                            </div>
                                          )}
                                        </div>
                                        <div className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 self-start ${
                                          paymentStatus === 'paid' 
                                            ? 'bg-green-100 text-green-700' 
                                            : paymentStatus === 'requested'
                                            ? 'bg-orange-100 text-orange-700'
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          {paymentStatus === 'paid' ? `✓ ${t.guardian.paid}` : paymentStatus === 'requested' ? t.guardian.requested : t.guardian.pending}
                                        </div>
                                      </div>
                                      {paymentStatus === 'requested' && (
                                        <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded text-xs text-orange-800 break-words">
                                          {t.guardian.paymentRequested}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Training Sessions */}
              <Card className="bg-white border-[#1B4332]/10 shadow-sm">
                <CardHeader className="border-b border-[#1B4332]/10 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="text-lg sm:text-xl text-[#1B4332] flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#1B4332]" />
                      </div>
                      <span className="text-base sm:text-xl">{t.guardian.trainingSessions}</span>
                    </CardTitle>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="w-full sm:w-40 border-[#1B4332]/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">{t.guardian.thisWeek}</SelectItem>
                        <SelectItem value="month">{t.guardian.thisMonth}</SelectItem>
                        <SelectItem value="year">{t.guardian.thisYear}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {filteredSessions.length > 0 ? (
                    <div className="space-y-3">
                      {filteredSessions
                        .sort((a, b) => new Date(a.session_date) - new Date(b.session_date))
                        .map((session) => {
                          const rider = myRiders.find(r => r.email === session.rider_email);
                          return (
                            <div
                              key={session.id}
                              className="p-4 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="font-semibold text-[#1B4332]">
                                    {rider?.first_name || rider?.full_name?.split(' ')[0] || session.rider_name}
                                  </h3>
                                  <p className="text-sm text-[#1B4332]/60">
                                    {format(new Date(session.session_date), 'EEEE, MMM d')} at {format(new Date(session.session_date), 'h:mm a')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-[#8B5A2B] bg-[#8B5A2B]/10 px-2 py-1 rounded-full">
                                    {session.session_type}
                                  </div>
                                  {session.rider_verified && (
                                    <div className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      {t.guardian.verified}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm text-[#1B4332]/80">
                                {t.guardian.trainer} {session.trainer_name || session.trainer_email}
                              </div>
                              {session.horse_name && (
                                <div className="text-sm text-[#1B4332]/60">
                                  🐴 {session.horse_name}
                                </div>
                              )}
                              {session.notes && (
                                <p className="text-xs text-[#1B4332]/60 mt-2">{session.notes}</p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-center text-[#1B4332]/60 py-8">
                      {t.guardian.noSessionsPeriod}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activity & Balance Tab */}
          <TabsContent value="balance">
            <div className="space-y-6">
              {/* Balance Summary */}
              <Card className="bg-white border-[#1B4332]/10 shadow-sm">
                <CardHeader className="border-b border-[#1B4332]/10 p-4 sm:p-6">
                  <div className="flex flex-col gap-3">
                    <CardTitle className="text-lg sm:text-xl text-[#1B4332] flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-[#1B4332]" />
                      </div>
                      <span className="text-base sm:text-xl">{t.guardian.paymentSummary}</span>
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-full sm:w-40 border-[#1B4332]/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">{t.guardian.thisWeek}</SelectItem>
                          <SelectItem value="month">{t.guardian.thisMonth}</SelectItem>
                          <SelectItem value="year">{t.guardian.thisYear}</SelectItem>
                          <SelectItem value="specific">{t.guardian.specificMonth}</SelectItem>
                        </SelectContent>
                      </Select>
                      {dateRange === 'specific' && (
                        <>
                          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                            <SelectTrigger className="w-full sm:w-32 border-[#1B4332]/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">January</SelectItem>
                              <SelectItem value="1">February</SelectItem>
                              <SelectItem value="2">March</SelectItem>
                              <SelectItem value="3">April</SelectItem>
                              <SelectItem value="4">May</SelectItem>
                              <SelectItem value="5">June</SelectItem>
                              <SelectItem value="6">July</SelectItem>
                              <SelectItem value="7">August</SelectItem>
                              <SelectItem value="8">September</SelectItem>
                              <SelectItem value="9">October</SelectItem>
                              <SelectItem value="10">November</SelectItem>
                              <SelectItem value="11">December</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                            <SelectTrigger className="w-full sm:w-24 border-[#1B4332]/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="p-4 sm:p-6 bg-gradient-to-br from-[#1B4332] to-[#8B5A2B] rounded-xl text-white mb-6">
                    <p className="text-xs sm:text-sm opacity-90 mb-2">{t.guardian.totalBalanceDue}</p>
                    <p className="text-2xl sm:text-4xl font-bold break-words">
                      {currency} {total.toFixed(2)}
                    </p>
                    <p className="text-xs sm:text-sm opacity-75 mt-2">
                      {verifiedSessions.length} {verifiedSessions.length === 1 ? t.guardian.session : t.guardian.sessions}
                    </p>
                  </div>

                  {/* Breakdown by Trainer */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-[#1B4332]">{t.guardian.breakdownByTrainer}</h3>
                    {Object.keys(breakdown).length > 0 ? (
                      Object.entries(breakdown).map(([trainer, data]) => (
                        <div
                          key={trainer}
                          className="p-4 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10"
                        >
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <h4 className="font-semibold text-[#1B4332]">{trainer}</h4>
                              <p className="text-sm text-[#1B4332]/60 mt-1">
                                {data.sessions.length} {data.sessions.length === 1 ? t.guardian.session : t.guardian.sessions}
                              </p>
                            </div>
                            <span className="text-lg font-bold text-[#1B4332]">
                              {data.currency} {data.total.toFixed(2)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {data.sessions.map((session) => {
                              const rider = myRiders.find(r => r.email === session.rider_email);
                              return (
                                <div
                                  key={session.id}
                                  className="flex justify-between text-sm py-2 border-t border-[#1B4332]/10"
                                >
                                  <div>
                                    <span className="text-[#1B4332] font-medium">
                                      {rider?.first_name || session.rider_name}
                                    </span>
                                    {' - '}
                                    <span className="text-[#1B4332]/70">
                                      {format(new Date(session.session_date), 'MMM d')}
                                    </span>
                                    {' - '}
                                    <span className="text-[#1B4332]/60 text-xs">
                                      {session.session_type}
                                    </span>
                                  </div>
                                  <span className="text-[#1B4332] font-medium">
                                    {data.currency} {session.rate.toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {data.competitions && data.competitions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-amber-200">
                              {data.competitions.map((comp) => (
                                <div key={comp.id} className="mb-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Trophy className="w-4 h-4 text-amber-600" />
                                    <span className="font-medium text-amber-700 text-sm">{comp.name}</span>
                                  </div>
                                  <div className="ml-6 space-y-2">
                                    {comp.riders.map((rider, ridx) => {
                                      const myRider = myRiders.find(r => r.email === rider.rider_email);
                                      return (
                                        <div key={ridx} className="text-sm">
                                          <div className="font-medium text-[#1B4332] mb-1">
                                            {myRider?.first_name || rider.rider_name}
                                          </div>
                                          {Object.entries(rider.services).map(([service, serviceData]) => (
                                            <div key={service} className="flex justify-between text-xs py-1 border-t border-[#1B4332]/10">
                                              <span className="text-[#1B4332]/70">{service}</span>
                                              <span className="text-[#1B4332] font-medium">
                                                {data.currency} {serviceData.amount.toFixed(2)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-[#1B4332]/60 text-center py-8">
                        {t.guardian.noVerifiedSessions}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}