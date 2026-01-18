import React, { useState, useEffect } from 'react';
import { useTranslation } from '../components/translations';
import LanguageSelector from '../components/LanguageSelector';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from 'framer-motion';
import { User, Calendar, Clock, Home, ChevronRight, Edit2, Check, X, Upload, Plus, ChevronLeft, Trophy, GripVertical } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import Logo from '../components/Logo';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addMonths, subMonths, isWithinInterval } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function RiderProfile() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [highlightedSessionId, setHighlightedSessionId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editContext, setEditContext] = useState(null);
  const [view, setView] = useState('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sectionOrder, setSectionOrder] = useState(() => {
    const saved = localStorage.getItem('riderProfileSectionOrder');
    return saved ? JSON.parse(saved) : ['profileAndHorses', 'todaySessions', 'calendar'];
  });
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    profile_image: '',
    locker_number: ''
  });
  const [sessionForm, setSessionForm] = useState({
    trainer_email: '',
    trainer_name: '',
    horse_name: '',
    session_date: '',
    duration: 60,
    session_type: 'Lesson',
    notes: ''
  });
  const [trainers, setTrainers] = useState([]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        setFormData({
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          profile_image: userData.profile_image || '',
          locker_number: userData.locker_number || ''
        });

        const connections = await base44.entities.UserConnection.filter({
          to_user_email: userData.email,
          status: 'approved',
          connection_type: 'Trainer-Rider'
        });
        
        const users = await base44.entities.User.list();
        const connectedTrainers = connections.map(conn => {
          const trainer = users.find(u => u.email === conn.from_user_email);
          return {
            email: conn.from_user_email,
            name: trainer?.first_name && trainer?.last_name 
              ? `${trainer.first_name} ${trainer.last_name}` 
              : trainer?.full_name || conn.from_user_email
          };
        });
        setTrainers(connectedTrainers);
      } catch (error) {
        base44.auth.redirectToLogin(createPageUrl('RiderProfile'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const { data: sessions = [] } = useQuery({
    queryKey: ['rider-sessions', user?.email],
    queryFn: async () => {
      const allSessions = await base44.entities.TrainingSession.list();
      return allSessions
        .filter(s => (s.rider_email || s.data?.rider_email) === user.email)
        .map(s => {
          const sessionData = s.data || s;
          return { 
            id: s.id, 
            created_date: s.created_date,
            updated_date: s.updated_date,
            ...sessionData 
          };
        });
    },
    enabled: !!user,
    initialData: []
  });

  const { data: horses = [] } = useQuery({
    queryKey: ['my-horses', user?.email],
    queryFn: async () => {
      const allHorses = await base44.entities.Horse.list();
      return allHorses
        .filter(h => h.data?.owner_email === user.email || h.owner_email === user.email)
        .map(h => ({ id: h.id, ...h.data }));
    },
    enabled: !!user,
    initialData: []
  });

  const { data: allCompetitions = [] } = useQuery({
    queryKey: ['all-competitions'],
    queryFn: async () => {
      const comps = await base44.entities.Competition.list();
      return comps.map(c => ({ id: c.id, ...c.data }));
    },
    enabled: !!user,
    initialData: []
  });

  const myCompetitions = allCompetitions.filter(comp =>
    comp.riders?.some(r => r.rider_email === user?.email)
  );

  // Handle highlight parameter from notifications
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && sessions.length > 0) {
      setHighlightedSessionId(highlightId);
      // Clear the URL param
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
      // Scroll to the session after a short delay - try multiple possible IDs
      setTimeout(() => {
        const possibleIds = [
          `session-${highlightId}`,
          `session-mobile-${highlightId}`,
          `session-desktop-${highlightId}`,
          `session-calendar-${highlightId}`
        ];
        for (const id of possibleIds) {
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      }, 100);
      // Clear highlight after 5 seconds
      setTimeout(() => {
        setHighlightedSessionId(null);
      }, 5000);
    }
  }, [searchParams, sessions, setSearchParams]);

  const verifySessionMutation = useMutation({
    mutationFn: (sessionId) => base44.entities.TrainingSession.update(sessionId, {
      rider_verified: true,
      rider_verified_date: new Date().toISOString(),
      status: 'completed'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-sessions'] });
    }
  });

  const createSessionMutation = useMutation({
    mutationFn: (data) => base44.entities.TrainingSession.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-sessions'] });
      setShowAddSession(false);
      setEditingSession(null);
      setSessionForm({
        trainer_email: '',
        trainer_name: '',
        horse_name: '',
        session_date: '',
        duration: 60,
        session_type: 'Lesson',
        notes: ''
      });
    }
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TrainingSession.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-sessions'] });
      setShowAddSession(false);
      setEditingSession(null);
      setEditContext(null);
      setSessionForm({
        trainer_email: '',
        trainer_name: '',
        horse_name: '',
        session_date: '',
        duration: 60,
        session_type: 'Lesson',
        notes: ''
      });
    }
  });

  const cancelSessionMutation = useMutation({
    mutationFn: (sessionId) => base44.entities.TrainingSession.update(sessionId, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-sessions'] });
    }
  });

  const handleAddSession = () => {
    if (!sessionForm.session_date || !sessionForm.trainer_email) {
      alert('Please select trainer and date/time');
      return;
    }

    const sessionData = {
      trainer_email: sessionForm.trainer_email,
      trainer_name: sessionForm.trainer_name,
      rider_email: user.email,
      rider_name: `${formData.first_name} ${formData.last_name}`.trim() || user.full_name,
      horse_name: sessionForm.horse_name,
      session_date: sessionForm.session_date,
      duration: sessionForm.duration,
      session_type: sessionForm.session_type,
      notes: sessionForm.notes,
      status: 'scheduled'
    };

    if (editingSession) {
      updateSessionMutation.mutate({ id: editingSession.id, data: sessionData });
    } else {
      createSessionMutation.mutate(sessionData);
    }
  };

  const handleEditSession = (session, context = 'calendar') => {
    setEditingSession(session);
    setEditContext(context);
    setSessionForm({
      trainer_email: session.trainer_email,
      trainer_name: session.trainer_name,
      horse_name: session.horse_name,
      session_date: session.session_date,
      duration: session.duration,
      session_type: session.session_type,
      notes: session.notes || ''
    });
    if (context !== 'today' && context !== 'calendar') {
      setShowAddSession(true);
    }
  };

  const handleCancelSession = (sessionId) => {
    if (confirm('Are you sure you want to cancel this session?')) {
      cancelSessionMutation.mutate(sessionId);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, profile_image: file_url }));
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe(formData);
      setUser(prev => ({ ...prev, ...formData }));
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    const first = formData.first_name?.[0] || user?.full_name?.[0] || '';
    const last = formData.last_name?.[0] || '';
    return (first + last).toUpperCase() || 'R';
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(sectionOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setSectionOrder(items);
    localStorage.setItem('riderProfileSectionOrder', JSON.stringify(items));
  };

  const getViewRangeSessions = () => {
    let start, end;

    if (view === 'day') {
      start = startOfDay(selectedDate);
      end = endOfDay(selectedDate);
    } else if (view === 'week') {
      start = startOfWeek(selectedDate, { weekStartsOn: 0 });
      end = endOfWeek(selectedDate, { weekStartsOn: 0 });
    } else {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    }

    const filteredSessions = sessions.filter(s => {
      const sessionDate = new Date(s.session_date);
      return isWithinInterval(sessionDate, { start, end }) && s.status !== 'cancelled';
    }).sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

    const filteredComps = myCompetitions.filter(c => {
      const compDate = new Date(c.competition_date);
      return isWithinInterval(compDate, { start, end }) && c.status !== 'cancelled';
    }).sort((a, b) => new Date(a.competition_date) - new Date(b.competition_date));

    return { sessions: filteredSessions, competitions: filteredComps, start, end };
  };

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const todaysSessions = sessions
    .filter(s => {
      const sessionDate = new Date(s.session_date);
      return sessionDate >= todayStart && sessionDate <= todayEnd && s.status !== 'cancelled';
    })
    .sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

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

  const renderSection = (sectionId, provided, snapshot) => {
    if (sectionId === 'profileAndHorses') {
      return (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`${snapshot.isDragging ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-[#1B4332]/40" />
            </div>
            <span className="text-sm text-[#1B4332]/60">Profile & Horses</span>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-white border-[#1B4332]/10 shadow-sm">
                <CardHeader className="border-b border-[#1B4332]/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-[#1B4332] flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {t.riderProfile.profile}
                    </CardTitle>
                    {!editing ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(true)}
                        className="border-[#1B4332]/20 text-[#1B4332]"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        {t.common.edit}
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(false)}
                          className="border-[#1B4332]/20"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-[#1B4332]"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center mb-6">
                    <Avatar className="w-24 h-24 bg-[#1B4332] text-white text-2xl font-semibold mb-3">
                      {formData.profile_image ? (
                        <img 
                          src={formData.profile_image} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-[#1B4332] text-white text-2xl">
                          {getInitials()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    {editing && (
                      <label className="cursor-pointer">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingImage}
                          className="border-[#1B4332]/20 text-xs"
                          onClick={() => document.getElementById('profile-image-upload').click()}
                        >
                          <Upload className="w-3 h-3 mr-2" />
                          {uploadingImage ? t.riderProfile.uploading : t.riderProfile.changePhoto}
                        </Button>
                        <input
                          id="profile-image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[#1B4332] font-medium">{t.profile.firstName}</Label>
                      {editing ? (
                        <Input
                          value={formData.first_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                          className="border-[#1B4332]/20"
                        />
                      ) : (
                        <p className="text-[#1B4332]">{formData.first_name || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#1B4332] font-medium">{t.profile.lastName}</Label>
                      {editing ? (
                        <Input
                          value={formData.last_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                          className="border-[#1B4332]/20"
                        />
                      ) : (
                        <p className="text-[#1B4332]">{formData.last_name || '-'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#1B4332] font-medium">{t.profile.email}</Label>
                      <p className="text-[#1B4332] text-sm">{user?.email}</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#1B4332] font-medium">{t.riderProfile.lockerNumber}</Label>
                      {editing ? (
                        <Input
                          value={formData.locker_number}
                          onChange={(e) => setFormData(prev => ({ ...prev, locker_number: e.target.value }))}
                          className="border-[#1B4332]/20"
                          placeholder={t.riderProfile.enterLockerNumber}
                        />
                      ) : (
                        <p className="text-[#1B4332]">{formData.locker_number || '-'}</p>
                      )}
                    </div>

                    {user?.birthday && (() => {
                      const birthDate = new Date(user.birthday);
                      const today = new Date();
                      const age = today.getFullYear() - birthDate.getFullYear();
                      const monthDiff = today.getMonth() - birthDate.getMonth();
                      const isMinor = age < 18 || (age === 18 && monthDiff < 0);
                      
                      if (isMinor && user?.parent_email) {
                        return (
                          <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg mt-4">
                            <div className="flex items-center gap-2 text-amber-800 font-medium">
                              <User className="w-4 h-4" />
                              {t.riderProfile.minorRider} ({age} {t.riderProfile.yearsOld})
                            </div>
                            <div className="space-y-1 text-sm">
                              <p className="text-[#1B4332]/80">
                                <strong>{t.riderProfile.parentGuardian}</strong>
                              </p>
                              <p className="text-[#1B4332]">{user.parent_email}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#1B4332]/10 shadow-sm">
                <CardHeader className="border-b border-[#1B4332]/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-[#1B4332] flex items-center gap-2">
                      <span className="text-2xl">🐴</span>
                      {t.riderProfile.myHorses}
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => window.location.href = createPageUrl('MyHorses')}
                      className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                    >
                      {t.riderProfile.manageHorses}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {horses.length > 0 ? (
                    <div className="grid gap-3">
                      {horses.map((horse) => (
                        <div
                          key={horse.id}
                          className="p-4 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10 hover:border-[#1B4332]/20 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-[#1B4332] mb-1">{horse.name}</h3>
                              <div className="space-y-1 text-sm text-[#1B4332]/60">
                                {horse.breed && <p>{t.riderProfile.breed} {horse.breed}</p>}
                                {horse.home_stable_name && <p>{t.riderProfile.stable} {horse.home_stable_name}</p>}
                                {horse.suite_number && <p>{t.riderProfile.suite} {horse.suite_number}</p>}
                              </div>
                            </div>
                            {horse.image_url && (
                              <img 
                                src={horse.image_url} 
                                alt={horse.name}
                                className="w-16 h-16 rounded-lg object-cover ml-4"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[#1B4332]/60 mb-4">{t.riderProfile.noHorsesYet}</p>
                      <Button
                        onClick={() => window.location.href = createPageUrl('MyHorses')}
                        variant="outline"
                        className="border-[#1B4332]/20"
                      >
                        {t.riderProfile.addFirstHorse}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      );
    }

    if (sectionId === 'todaySessions' && todaysSessions.length > 0) {
      return (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`${snapshot.isDragging ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-[#1B4332]/40" />
            </div>
            <span className="text-sm text-[#1B4332]/60">Today's Sessions</span>
          </div>
          <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10">
            <CardHeader className="border-b border-[#1B4332]/10">
              <CardTitle className="text-base text-[#1B4332] flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t.riderProfile.todaySessions} ({todaysSessions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {todaysSessions.map((session) => (
                  <div key={session.id} id={`session-${session.id}`}>
                    <div className={`p-3 rounded-lg border transition-all duration-500 ${highlightedSessionId === session.id ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-400' : 'bg-white border-[#1B4332]/10'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold text-[#1B4332]">
                            {format(new Date(session.session_date), 'h:mm a')}
                          </div>
                          <div className="text-xs text-[#8B5A2B] bg-[#8B5A2B]/10 px-2 py-1 rounded-full">
                            {session.session_type}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!session.rider_verified && (
                          <Button
                            onClick={() => verifySessionMutation.mutate(session.id)}
                            disabled={verifySessionMutation.isPending}
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            {verifySessionMutation.isPending ? t.riderProfile.verifying : `✓ ${t.riderProfile.verify}`}
                          </Button>
                        )}
                        {new Date(session.session_date) > new Date() ? (
                          <>
                            <Button
                              onClick={() => handleEditSession(session, 'today')}
                              size="sm"
                              variant="outline"
                              className="flex-1 border-[#1B4332]/20"
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              {t.riderProfile.edit}
                            </Button>
                            <Button
                              onClick={() => handleCancelSession(session.id)}
                              size="sm"
                              variant="outline"
                              className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <X className="w-3 h-3 mr-1" />
                              {t.riderProfile.cancel}
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => handleCancelSession(session.id)}
                            size="sm"
                            variant="outline"
                            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <X className="w-3 h-3 mr-1" />
                            {t.riderProfile.delete}
                          </Button>
                        )}
                      </div>
                    </div>
                    {editingSession?.id === session.id && editContext === 'today' && (
                      <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm">{t.riderProfile.trainer} *</Label>
                          <Select
                            value={sessionForm.trainer_email}
                            onValueChange={(value) => {
                              const trainer = trainers.find(t => t.email === value);
                              setSessionForm(prev => ({
                                ...prev,
                                trainer_email: value,
                                trainer_name: trainer?.name || ''
                              }));
                            }}
                          >
                            <SelectTrigger className="border-[#1B4332]/20 text-sm">
                              <SelectValue placeholder={t.riderProfile.selectTrainer} />
                            </SelectTrigger>
                            <SelectContent>
                              {trainers.map(trainer => (
                                <SelectItem key={trainer.email} value={trainer.email}>
                                  {trainer.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label className="text-sm">{t.riderProfile.horse}</Label>
                            <Select
                              value={sessionForm.horse_name}
                              onValueChange={(value) => setSessionForm(prev => ({ ...prev, horse_name: value }))}
                            >
                              <SelectTrigger className="border-[#1B4332]/20 text-sm">
                                <SelectValue placeholder={t.riderProfile.selectHorse} />
                              </SelectTrigger>
                              <SelectContent>
                                {horses.map(horse => (
                                  <SelectItem key={horse.id} value={horse.name}>
                                    {horse.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">{t.riderProfile.sessionType}</Label>
                            <Select
                              value={sessionForm.session_type}
                              onValueChange={(value) => setSessionForm(prev => ({ ...prev, session_type: value }))}
                            >
                              <SelectTrigger className="border-[#1B4332]/20 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Lesson">{t.riderProfile.lesson}</SelectItem>
                                <SelectItem value="Training">{t.riderProfile.training}</SelectItem>
                                <SelectItem value="Horse Training">{t.riderProfile.horseTraining}</SelectItem>
                                <SelectItem value="Horse Transport">{t.riderProfile.horseTransport}</SelectItem>
                                <SelectItem value="Competition Prep">{t.riderProfile.competitionPrep}</SelectItem>
                                <SelectItem value="Evaluation">{t.riderProfile.evaluation}</SelectItem>
                                <SelectItem value="Other">{t.riderProfile.other}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label className="text-sm">{t.riderProfile.dateTime} *</Label>
                            <Input
                              type="datetime-local"
                              value={sessionForm.session_date}
                              onChange={(e) => setSessionForm(prev => ({ ...prev, session_date: e.target.value }))}
                              className="border-[#1B4332]/20 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">{t.riderProfile.duration}</Label>
                            <Input
                              type="number"
                              value={sessionForm.duration}
                              onChange={(e) => setSessionForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                              className="border-[#1B4332]/20 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">{t.riderProfile.notes}</Label>
                          <Textarea
                            value={sessionForm.notes}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                            className="border-[#1B4332]/20 text-sm"
                            placeholder={t.riderProfile.sessionDetails}
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingSession(null);
                              setEditContext(null);
                              setSessionForm({
                                trainer_email: '',
                                trainer_name: '',
                                horse_name: '',
                                session_date: '',
                                duration: 60,
                                session_type: 'Lesson',
                                notes: ''
                              });
                            }}
                            size="sm"
                            className="border-[#1B4332]/20"
                          >
                            {t.riderProfile.cancel}
                          </Button>
                          <Button
                            onClick={handleAddSession}
                            disabled={updateSessionMutation.isPending}
                            size="sm"
                            className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                          >
                            {updateSessionMutation.isPending ? t.riderProfile.updating : t.riderProfile.update}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (sectionId === 'calendar') {
      return (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`${snapshot.isDragging ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-[#1B4332]/40" />
            </div>
            <span className="text-sm text-[#1B4332]/60">Calendar View</span>
          </div>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  variant={view === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setView('day');
                    setSelectedDate(new Date());
                  }}
                  className={view === 'day' ? 'bg-[#1B4332]' : 'border-[#1B4332]/20'}
                >
                  {t.riderProfile.day}
                </Button>
                <Button
                  variant={view === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setView('week');
                    setSelectedDate(new Date());
                  }}
                  className={view === 'week' ? 'bg-[#1B4332]' : 'border-[#1B4332]/20'}
                >
                  {t.riderProfile.week}
                </Button>
                <Button
                  variant={view === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setView('month');
                    setSelectedDate(new Date());
                  }}
                  className={view === 'month' ? 'bg-[#1B4332]' : 'border-[#1B4332]/20'}
                >
                  {t.riderProfile.month}
                </Button>
              </div>
              <Button
                onClick={() => {
                  setEditingSession(null);
                  setSessionForm({
                    trainer_email: '',
                    trainer_name: '',
                    horse_name: '',
                    session_date: '',
                    duration: 60,
                    session_type: 'Lesson',
                    notes: ''
                  });
                  setShowAddSession(true);
                }}
                size="sm"
                className="bg-[#1B4332] hover:bg-[#1B4332]/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t.riderProfile.scheduleSession}
              </Button>
            </div>

            {showAddSession && !editingSession && (
              <Card className="bg-white border-[#1B4332]/10">
                <CardHeader className="border-b border-[#1B4332]/10">
                  <CardTitle className="text-lg text-[#1B4332]">
                    {t.riderProfile.scheduleNewSession}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>{t.riderProfile.trainer} *</Label>
                    <Select
                      value={sessionForm.trainer_email}
                      onValueChange={(value) => {
                        const trainer = trainers.find(t => t.email === value);
                        setSessionForm(prev => ({
                          ...prev,
                          trainer_email: value,
                          trainer_name: trainer?.name || ''
                        }));
                      }}
                    >
                      <SelectTrigger className="border-[#1B4332]/20">
                        <SelectValue placeholder={t.riderProfile.selectTrainer} />
                      </SelectTrigger>
                      <SelectContent>
                        {trainers.map(trainer => (
                          <SelectItem key={trainer.email} value={trainer.email}>
                            {trainer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t.riderProfile.horse}</Label>
                      <Select
                        value={sessionForm.horse_name}
                        onValueChange={(value) => setSessionForm(prev => ({ ...prev, horse_name: value }))}
                      >
                        <SelectTrigger className="border-[#1B4332]/20">
                          <SelectValue placeholder={t.riderProfile.selectHorse} />
                        </SelectTrigger>
                        <SelectContent>
                          {horses.map(horse => (
                            <SelectItem key={horse.id} value={horse.name}>
                              {horse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.riderProfile.sessionType}</Label>
                      <Select
                        value={sessionForm.session_type}
                        onValueChange={(value) => setSessionForm(prev => ({ ...prev, session_type: value }))}
                      >
                        <SelectTrigger className="border-[#1B4332]/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lesson">{t.riderProfile.lesson}</SelectItem>
                          <SelectItem value="Training">{t.riderProfile.training}</SelectItem>
                          <SelectItem value="Horse Training">{t.riderProfile.horseTraining}</SelectItem>
                          <SelectItem value="Horse Transport">{t.riderProfile.horseTransport}</SelectItem>
                          <SelectItem value="Competition Prep">{t.riderProfile.competitionPrep}</SelectItem>
                          <SelectItem value="Evaluation">{t.riderProfile.evaluation}</SelectItem>
                          <SelectItem value="Other">{t.riderProfile.other}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t.riderProfile.dateTime} *</Label>
                      <Input
                        type="datetime-local"
                        value={sessionForm.session_date}
                        onChange={(e) => setSessionForm(prev => ({ ...prev, session_date: e.target.value }))}
                        className="border-[#1B4332]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.riderProfile.duration}</Label>
                      <Input
                        type="number"
                        value={sessionForm.duration}
                        onChange={(e) => setSessionForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                        className="border-[#1B4332]/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.riderProfile.notes}</Label>
                    <Textarea
                      value={sessionForm.notes}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="border-[#1B4332]/20"
                      placeholder={t.riderProfile.sessionDetails}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddSession(false);
                        setEditingSession(null);
                      }}
                      className="border-[#1B4332]/20"
                    >
                      {t.riderProfile.cancel}
                    </Button>
                    <Button
                      onClick={handleAddSession}
                      disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
                      className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                    >
                      {(createSessionMutation.isPending || updateSessionMutation.isPending) 
                        ? t.riderProfile.scheduling 
                        : t.riderProfile.scheduleSession}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white border-[#1B4332]/10">
              <CardHeader className="border-b border-[#1B4332]/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="text-lg text-[#1B4332]">
                    {view === 'day' && format(selectedDate, 'EEEE, MMMM d, yyyy')}
                    {view === 'week' && `Week of ${format(startOfWeek(selectedDate, { weekStartsOn: 0 }), 'MMM d')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 0 }), 'MMM d, yyyy')}`}
                    {view === 'month' && format(selectedDate, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (view === 'day') setSelectedDate(addDays(selectedDate, -1));
                        else if (view === 'week') setSelectedDate(addDays(selectedDate, -7));
                        else setSelectedDate(subMonths(selectedDate, 1));
                      }}
                      className="border-[#1B4332]/20"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (view === 'day') setSelectedDate(addDays(selectedDate, 1));
                        else if (view === 'week') setSelectedDate(addDays(selectedDate, 7));
                        else setSelectedDate(addMonths(selectedDate, 1));
                      }}
                      className="border-[#1B4332]/20"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {(() => {
                  const { sessions: viewSessions, competitions: viewComps } = getViewRangeSessions();
                  
                  if (viewSessions.length === 0 && viewComps.length === 0) {
                    return <p className="text-center text-[#1B4332]/60 py-8">{t.riderProfile.noSessionsView} {view}</p>;
                  }

                  return (
                    <div className="space-y-3">
                      {viewComps.map((competition) => (
                        <div
                          key={competition.id}
                          className="p-4 bg-amber-50 rounded-lg border-2 border-amber-300"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Trophy className="w-5 h-5 text-amber-600" />
                              <div>
                                <div className="font-semibold text-[#1B4332]">
                                  {competition.name}
                                </div>
                                <div className="text-sm text-[#1B4332]/60">
                                  {format(new Date(competition.competition_date), 'EEE, MMM d - h:mm a')}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                              Competition
                            </div>
                          </div>
                          <div className="text-sm text-[#1B4332]/80 mb-2">
                            📍 {competition.location}
                          </div>
                          <div className="text-sm text-[#1B4332]/60">
                            Trainer: {competition.trainer_name || competition.trainer_email}
                          </div>
                        </div>
                      ))}
                      {viewSessions.map((session) => (
                        <div key={session.id} id={`session-${session.id}`}>
                          <div className={`p-4 rounded-lg border transition-all duration-500 ${highlightedSessionId === session.id ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-400' : 'bg-[#1B4332]/5 border-[#1B4332]/10'}`}>
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-semibold text-[#1B4332]">
                                  {format(new Date(session.session_date), 'EEE, MMM d - h:mm a')}
                                </div>
                                <div className="text-sm text-[#1B4332]/60">
                                  {session.duration} {t.riderProfile.minutes}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-[#8B5A2B] bg-[#8B5A2B]/10 px-2 py-1 rounded-full">
                                  {session.session_type}
                                </div>
                                {session.rider_verified && (
                                  <div className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                    ✓ {t.riderProfile.verified}
                                  </div>
                                )}
                              </div>
                            </div>
                            {session.horse_name && (
                              <div className="text-sm text-[#1B4332]/60 mb-2">
                                🐴 {session.horse_name}
                              </div>
                            )}
                            {session.notes && (
                              <p className="text-xs text-[#1B4332]/60 mb-3">{session.notes}</p>
                            )}
                            <div className="flex gap-2">
                              {!session.rider_verified && new Date(session.session_date) <= new Date() && (
                                <Button
                                  onClick={() => verifySessionMutation.mutate(session.id)}
                                  disabled={verifySessionMutation.isPending}
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {verifySessionMutation.isPending ? t.riderProfile.verifying : `✓ ${t.riderProfile.verifyCompletion}`}
                                </Button>
                              )}
                              {new Date(session.session_date) > new Date() ? (
                                <>
                                  <Button
                                    onClick={() => handleEditSession(session, 'calendar')}
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 border-[#1B4332]/20"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    {t.riderProfile.edit}
                                  </Button>
                                  <Button
                                    onClick={() => handleCancelSession(session.id)}
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    {t.riderProfile.cancel}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  onClick={() => handleCancelSession(session.id)}
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  {t.riderProfile.delete}
                                </Button>
                              )}
                            </div>
                          </div>
                          {editingSession?.id === session.id && editContext === 'calendar' && (
                            <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                              <div className="space-y-2">
                                <Label className="text-sm">{t.riderProfile.trainer} *</Label>
                                <Select
                                  value={sessionForm.trainer_email}
                                  onValueChange={(value) => {
                                    const trainer = trainers.find(t => t.email === value);
                                    setSessionForm(prev => ({
                                      ...prev,
                                      trainer_email: value,
                                      trainer_name: trainer?.name || ''
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="border-[#1B4332]/20 text-sm">
                                    <SelectValue placeholder={t.riderProfile.selectTrainer} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {trainers.map(trainer => (
                                      <SelectItem key={trainer.email} value={trainer.email}>
                                        {trainer.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label className="text-sm">{t.riderProfile.horse}</Label>
                                  <Select
                                    value={sessionForm.horse_name}
                                    onValueChange={(value) => setSessionForm(prev => ({ ...prev, horse_name: value }))}
                                  >
                                    <SelectTrigger className="border-[#1B4332]/20 text-sm">
                                      <SelectValue placeholder={t.riderProfile.selectHorse} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {horses.map(horse => (
                                        <SelectItem key={horse.id} value={horse.name}>
                                          {horse.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm">{t.riderProfile.sessionType}</Label>
                                  <Select
                                    value={sessionForm.session_type}
                                    onValueChange={(value) => setSessionForm(prev => ({ ...prev, session_type: value }))}
                                  >
                                    <SelectTrigger className="border-[#1B4332]/20 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Lesson">{t.riderProfile.lesson}</SelectItem>
                                      <SelectItem value="Training">{t.riderProfile.training}</SelectItem>
                                      <SelectItem value="Horse Training">{t.riderProfile.horseTraining}</SelectItem>
                                      <SelectItem value="Horse Transport">{t.riderProfile.horseTransport}</SelectItem>
                                      <SelectItem value="Competition Prep">{t.riderProfile.competitionPrep}</SelectItem>
                                      <SelectItem value="Evaluation">{t.riderProfile.evaluation}</SelectItem>
                                      <SelectItem value="Other">{t.riderProfile.other}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label className="text-sm">{t.riderProfile.dateTime} *</Label>
                                  <Input
                                    type="datetime-local"
                                    value={sessionForm.session_date}
                                    onChange={(e) => setSessionForm(prev => ({ ...prev, session_date: e.target.value }))}
                                    className="border-[#1B4332]/20 text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm">{t.riderProfile.duration}</Label>
                                  <Input
                                    type="number"
                                    value={sessionForm.duration}
                                    onChange={(e) => setSessionForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                                    className="border-[#1B4332]/20 text-sm"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm">{t.riderProfile.notes}</Label>
                                <Textarea
                                  value={sessionForm.notes}
                                  onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                                  className="border-[#1B4332]/20 text-sm"
                                  placeholder={t.riderProfile.sessionDetails}
                                  rows={2}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setEditingSession(null);
                                    setEditContext(null);
                                    setSessionForm({
                                      trainer_email: '',
                                      trainer_name: '',
                                      horse_name: '',
                                      session_date: '',
                                      duration: 60,
                                      session_type: 'Lesson',
                                      notes: ''
                                    });
                                  }}
                                  size="sm"
                                  className="border-[#1B4332]/20"
                                >
                                  {t.riderProfile.cancel}
                                </Button>
                                <Button
                                  onClick={handleAddSession}
                                  disabled={updateSessionMutation.isPending}
                                  size="sm"
                                  className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                                >
                                  {updateSessionMutation.isPending ? t.riderProfile.updating : t.riderProfile.update}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{t.riderProfile.breadcrumb}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1B4332] mb-2">{t.riderProfile.myProfile}</h1>
          <p className="text-[#1B4332]/60">{t.riderProfile.subtitle}</p>
        </div>

        {/* Desktop: Two-column layout with Profile/Horses on left, Calendar on right */}
        {/* Mobile: Stacked vertically */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column - Profile & Horses */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <Card className="bg-white border-[#1B4332]/10 shadow-sm">
              <CardHeader className="border-b border-[#1B4332]/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-[#1B4332] flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {t.riderProfile.profile}
                  </CardTitle>
                  {!editing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                      className="border-[#1B4332]/20 text-[#1B4332]"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      {t.common.edit}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(false)}
                        className="border-[#1B4332]/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#1B4332]"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center mb-6">
                  <Avatar className="w-24 h-24 bg-[#1B4332] text-white text-2xl font-semibold mb-3">
                    {formData.profile_image ? (
                      <img
                        src={formData.profile_image}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <AvatarFallback className="bg-[#1B4332] text-white text-2xl">
                        {getInitials()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  {editing && (
                    <label className="cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        className="border-[#1B4332]/20 text-xs"
                        onClick={() => document.getElementById('profile-image-upload').click()}
                      >
                        <Upload className="w-3 h-3 mr-2" />
                        {uploadingImage ? t.riderProfile.uploading : t.riderProfile.changePhoto}
                      </Button>
                      <input
                        id="profile-image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[#1B4332] font-medium">{t.profile.firstName}</Label>
                    {editing ? (
                      <Input
                        value={formData.first_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                        className="border-[#1B4332]/20"
                      />
                    ) : (
                      <p className="text-[#1B4332]">{formData.first_name || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1B4332] font-medium">{t.profile.lastName}</Label>
                    {editing ? (
                      <Input
                        value={formData.last_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                        className="border-[#1B4332]/20"
                      />
                    ) : (
                      <p className="text-[#1B4332]">{formData.last_name || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1B4332] font-medium">{t.profile.email}</Label>
                    <p className="text-[#1B4332] text-sm">{user?.email}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1B4332] font-medium">{t.riderProfile.lockerNumber}</Label>
                    {editing ? (
                      <Input
                        value={formData.locker_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, locker_number: e.target.value }))}
                        className="border-[#1B4332]/20"
                        placeholder={t.riderProfile.enterLockerNumber}
                      />
                    ) : (
                      <p className="text-[#1B4332]">{formData.locker_number || '-'}</p>
                    )}
                  </div>

                  {user?.birthday && (() => {
                    const birthDate = new Date(user.birthday);
                    const today = new Date();
                    const age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    const isMinor = age < 18 || (age === 18 && monthDiff < 0);

                    if (isMinor && user?.parent_email) {
                      return (
                        <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg mt-4">
                          <div className="flex items-center gap-2 text-amber-800 font-medium">
                            <User className="w-4 h-4" />
                            {t.riderProfile.minorRider} ({age} {t.riderProfile.yearsOld})
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="text-[#1B4332]/80">
                              <strong>{t.riderProfile.parentGuardian}</strong>
                            </p>
                            <p className="text-[#1B4332]">{user.parent_email}</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Horses Card */}
            <Card className="bg-white border-[#1B4332]/10 shadow-sm">
              <CardHeader className="border-b border-[#1B4332]/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-[#1B4332] flex items-center gap-2">
                    <span className="text-2xl">🐴</span>
                    {t.riderProfile.myHorses}
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => window.location.href = createPageUrl('MyHorses')}
                    className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                  >
                    {t.riderProfile.manageHorses}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {horses.length > 0 ? (
                  <div className="grid gap-3">
                    {horses.map((horse) => (
                      <div
                        key={horse.id}
                        className="p-4 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10 hover:border-[#1B4332]/20 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-[#1B4332] mb-1">{horse.name}</h3>
                            <div className="space-y-1 text-sm text-[#1B4332]/60">
                              {horse.breed && <p>{t.riderProfile.breed} {horse.breed}</p>}
                              {horse.home_stable_name && <p>{t.riderProfile.stable} {horse.home_stable_name}</p>}
                              {horse.suite_number && <p>{t.riderProfile.suite} {horse.suite_number}</p>}
                            </div>
                          </div>
                          {horse.image_url && (
                            <img
                              src={horse.image_url}
                              alt={horse.name}
                              className="w-16 h-16 rounded-lg object-cover ml-4"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-[#1B4332]/60 mb-4">{t.riderProfile.noHorsesYet}</p>
                    <Button
                      onClick={() => window.location.href = createPageUrl('MyHorses')}
                      variant="outline"
                      className="border-[#1B4332]/20"
                    >
                      {t.riderProfile.addFirstHorse}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's Sessions - only on mobile or if there are sessions */}
            {todaysSessions.length > 0 && (
              <Card className="lg:hidden bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10">
                <CardHeader className="border-b border-[#1B4332]/10">
                  <CardTitle className="text-base text-[#1B4332] flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t.riderProfile.todaySessions} ({todaysSessions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {todaysSessions.map((session) => (
                      <div key={session.id} id={`session-mobile-${session.id}`} className={`p-3 rounded-lg border transition-all duration-500 ${highlightedSessionId === session.id ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-400' : 'bg-white border-[#1B4332]/10'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-[#1B4332]">
                              {format(new Date(session.session_date), 'h:mm a')}
                            </div>
                            <div className="text-xs text-[#8B5A2B] bg-[#8B5A2B]/10 px-2 py-1 rounded-full">
                              {session.session_type}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!session.rider_verified && (
                            <Button
                              onClick={() => verifySessionMutation.mutate(session.id)}
                              disabled={verifySessionMutation.isPending}
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            >
                              {verifySessionMutation.isPending ? t.riderProfile.verifying : `✓ ${t.riderProfile.verify}`}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Calendar (2/3 width on desktop) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Sessions - desktop only */}
            {todaysSessions.length > 0 && (
              <Card className="hidden lg:block bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10">
                <CardHeader className="border-b border-[#1B4332]/10">
                  <CardTitle className="text-base text-[#1B4332] flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t.riderProfile.todaySessions} ({todaysSessions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid md:grid-cols-2 gap-2">
                    {todaysSessions.map((session) => (
                      <div key={session.id} id={`session-desktop-${session.id}`} className={`p-3 rounded-lg border transition-all duration-500 ${highlightedSessionId === session.id ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-400' : 'bg-white border-[#1B4332]/10'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-[#1B4332]">
                              {format(new Date(session.session_date), 'h:mm a')}
                            </div>
                            <div className="text-xs text-[#8B5A2B] bg-[#8B5A2B]/10 px-2 py-1 rounded-full">
                              {session.session_type}
                            </div>
                          </div>
                        </div>
                        {!session.rider_verified && (
                          <Button
                            onClick={() => verifySessionMutation.mutate(session.id)}
                            disabled={verifySessionMutation.isPending}
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                          >
                            {verifySessionMutation.isPending ? t.riderProfile.verifying : `✓ ${t.riderProfile.verify}`}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Calendar View */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Button
                    variant={view === 'day' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setView('day');
                      setSelectedDate(new Date());
                    }}
                    className={view === 'day' ? 'bg-[#1B4332]' : 'border-[#1B4332]/20'}
                  >
                    {t.riderProfile.day}
                  </Button>
                  <Button
                    variant={view === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setView('week');
                      setSelectedDate(new Date());
                    }}
                    className={view === 'week' ? 'bg-[#1B4332]' : 'border-[#1B4332]/20'}
                  >
                    {t.riderProfile.week}
                  </Button>
                  <Button
                    variant={view === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setView('month');
                      setSelectedDate(new Date());
                    }}
                    className={view === 'month' ? 'bg-[#1B4332]' : 'border-[#1B4332]/20'}
                  >
                    {t.riderProfile.month}
                  </Button>
                </div>
                <Button
                  onClick={() => {
                    setEditingSession(null);
                    setSessionForm({
                      trainer_email: '',
                      trainer_name: '',
                      horse_name: '',
                      session_date: '',
                      duration: 60,
                      session_type: 'Lesson',
                      notes: ''
                    });
                    setShowAddSession(true);
                  }}
                  size="sm"
                  className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t.riderProfile.scheduleSession}
                </Button>
              </div>

              {showAddSession && !editingSession && (
                <Card className="bg-white border-[#1B4332]/10">
                  <CardHeader className="border-b border-[#1B4332]/10">
                    <CardTitle className="text-lg text-[#1B4332]">
                      {t.riderProfile.scheduleNewSession}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label>{t.riderProfile.trainer} *</Label>
                      <Select
                        value={sessionForm.trainer_email}
                        onValueChange={(value) => {
                          const trainer = trainers.find(t => t.email === value);
                          setSessionForm(prev => ({
                            ...prev,
                            trainer_email: value,
                            trainer_name: trainer?.name || ''
                          }));
                        }}
                      >
                        <SelectTrigger className="border-[#1B4332]/20">
                          <SelectValue placeholder={t.riderProfile.selectTrainer} />
                        </SelectTrigger>
                        <SelectContent>
                          {trainers.map(trainer => (
                            <SelectItem key={trainer.email} value={trainer.email}>
                              {trainer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t.riderProfile.horse}</Label>
                        <Select
                          value={sessionForm.horse_name}
                          onValueChange={(value) => setSessionForm(prev => ({ ...prev, horse_name: value }))}
                        >
                          <SelectTrigger className="border-[#1B4332]/20">
                            <SelectValue placeholder={t.riderProfile.selectHorse} />
                          </SelectTrigger>
                          <SelectContent>
                            {horses.map(horse => (
                              <SelectItem key={horse.id} value={horse.name}>
                                {horse.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t.riderProfile.sessionType}</Label>
                        <Select
                          value={sessionForm.session_type}
                          onValueChange={(value) => setSessionForm(prev => ({ ...prev, session_type: value }))}
                        >
                          <SelectTrigger className="border-[#1B4332]/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Lesson">{t.riderProfile.lesson}</SelectItem>
                            <SelectItem value="Training">{t.riderProfile.training}</SelectItem>
                            <SelectItem value="Horse Training">{t.riderProfile.horseTraining}</SelectItem>
                            <SelectItem value="Horse Transport">{t.riderProfile.horseTransport}</SelectItem>
                            <SelectItem value="Competition Prep">{t.riderProfile.competitionPrep}</SelectItem>
                            <SelectItem value="Evaluation">{t.riderProfile.evaluation}</SelectItem>
                            <SelectItem value="Other">{t.riderProfile.other}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t.riderProfile.dateTime} *</Label>
                        <Input
                          type="datetime-local"
                          value={sessionForm.session_date}
                          onChange={(e) => setSessionForm(prev => ({ ...prev, session_date: e.target.value }))}
                          className="border-[#1B4332]/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.riderProfile.duration}</Label>
                        <Input
                          type="number"
                          value={sessionForm.duration}
                          onChange={(e) => setSessionForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                          className="border-[#1B4332]/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.riderProfile.notes}</Label>
                      <Textarea
                        value={sessionForm.notes}
                        onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                        className="border-[#1B4332]/20"
                        placeholder={t.riderProfile.sessionDetails}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddSession(false);
                          setEditingSession(null);
                        }}
                        className="border-[#1B4332]/20"
                      >
                        {t.riderProfile.cancel}
                      </Button>
                      <Button
                        onClick={handleAddSession}
                        disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
                        className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                      >
                        {(createSessionMutation.isPending || updateSessionMutation.isPending)
                          ? t.riderProfile.scheduling
                          : t.riderProfile.scheduleSession}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-white border-[#1B4332]/10">
                <CardHeader className="border-b border-[#1B4332]/10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <CardTitle className="text-lg text-[#1B4332]">
                      {view === 'day' && format(selectedDate, 'EEEE, MMMM d, yyyy')}
                      {view === 'week' && `Week of ${format(startOfWeek(selectedDate, { weekStartsOn: 0 }), 'MMM d')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 0 }), 'MMM d, yyyy')}`}
                      {view === 'month' && format(selectedDate, 'MMMM yyyy')}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (view === 'day') setSelectedDate(addDays(selectedDate, -1));
                          else if (view === 'week') setSelectedDate(addDays(selectedDate, -7));
                          else setSelectedDate(subMonths(selectedDate, 1));
                        }}
                        className="border-[#1B4332]/20"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (view === 'day') setSelectedDate(addDays(selectedDate, 1));
                          else if (view === 'week') setSelectedDate(addDays(selectedDate, 7));
                          else setSelectedDate(addMonths(selectedDate, 1));
                        }}
                        className="border-[#1B4332]/20"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {(() => {
                    const { sessions: viewSessions, competitions: viewComps } = getViewRangeSessions();

                    if (viewSessions.length === 0 && viewComps.length === 0) {
                      return <p className="text-center text-[#1B4332]/60 py-8">{t.riderProfile.noSessionsView} {view}</p>;
                    }

                    return (
                      <div className="space-y-3">
                        {viewComps.map((competition) => (
                          <div
                            key={competition.id}
                            className="p-4 bg-amber-50 rounded-lg border-2 border-amber-300"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-amber-600" />
                                <div>
                                  <div className="font-semibold text-[#1B4332]">
                                    {competition.name}
                                  </div>
                                  <div className="text-sm text-[#1B4332]/60">
                                    {format(new Date(competition.competition_date), 'EEE, MMM d - h:mm a')}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                Competition
                              </div>
                            </div>
                            <div className="text-sm text-[#1B4332]/80 mb-2">
                              📍 {competition.location}
                            </div>
                            <div className="text-sm text-[#1B4332]/60">
                              Trainer: {competition.trainer_name || competition.trainer_email}
                            </div>
                          </div>
                        ))}
                        {viewSessions.map((session) => (
                          <div
                            key={session.id}
                            id={`session-calendar-${session.id}`}
                            className={`p-4 rounded-lg border transition-all duration-500 ${highlightedSessionId === session.id ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-400' : 'bg-[#1B4332]/5 border-[#1B4332]/10'}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-semibold text-[#1B4332]">
                                  {format(new Date(session.session_date), 'EEE, MMM d - h:mm a')}
                                </div>
                                <div className="text-sm text-[#1B4332]/60">
                                  {session.duration} {t.riderProfile.minutes}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-[#8B5A2B] bg-[#8B5A2B]/10 px-2 py-1 rounded-full">
                                  {session.session_type}
                                </div>
                                {session.rider_verified && (
                                  <div className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                    ✓ {t.riderProfile.verified}
                                  </div>
                                )}
                              </div>
                            </div>
                            {session.horse_name && (
                              <div className="text-sm text-[#1B4332]/60 mb-2">
                                🐴 {session.horse_name}
                              </div>
                            )}
                            {session.notes && (
                              <p className="text-xs text-[#1B4332]/60 mb-3">{session.notes}</p>
                            )}
                            <div className="flex gap-2">
                              {!session.rider_verified && new Date(session.session_date) <= new Date() && (
                                <Button
                                  onClick={() => verifySessionMutation.mutate(session.id)}
                                  disabled={verifySessionMutation.isPending}
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {verifySessionMutation.isPending ? t.riderProfile.verifying : `✓ ${t.riderProfile.verifyCompletion}`}
                                </Button>
                              )}
                              {new Date(session.session_date) > new Date() && (
                                <Button
                                  onClick={() => handleCancelSession(session.id)}
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  {t.riderProfile.cancel}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}