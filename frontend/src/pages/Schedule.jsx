import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Plus, X, ChevronLeft, ChevronRight, Home, Trophy, Edit2, Download, Share2, Upload } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from '../components/translations';
import * as XLSX from 'xlsx';
import CompetitionForm from '../components/schedule/CompetitionForm';
import Logo from '../components/Logo';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, addMonths, subMonths, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

export default function Schedule() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState('month'); // day, week, month, year
  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [showAddCompetition, setShowAddCompetition] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState(null);
  const [riders, setRiders] = useState([]);
  const [riderHorses, setRiderHorses] = useState([]);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const [sessionForm, setSessionForm] = useState({
    rider_email: '',
    rider_name: '',
    horse_name: '',
    session_date: '',
    duration: 60,
    session_type: 'Lesson',
    notes: '',
    is_recurring: false,
    recurrence_weeks: 4
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        if (!userData.roles?.includes('Trainer')) {
          alert('This page is only accessible to trainers');
          navigate(createPageUrl('Dashboard'));
          return;
        }
        setUser(userData);

        // Load connected riders
        const connections = await base44.entities.UserConnection.filter({
          from_user_email: userData.email,
          status: 'approved'
        });
        
        const users = await base44.entities.User.list();
        const connectedRiders = connections.map(conn => {
          const rider = users.find(u => u.email === conn.to_user_email);
          return {
            email: conn.to_user_email,
            name: rider?.first_name && rider?.last_name 
              ? `${rider.first_name} ${rider.last_name}` 
              : rider?.full_name || conn.to_user_email
          };
        });
        setRiders(connectedRiders);
      } catch (error) {
        base44.auth.redirectToLogin(createPageUrl('Schedule'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const { data: sessions = [] } = useQuery({
    queryKey: ['training-sessions', user?.email],
    queryFn: () => base44.entities.TrainingSession.filter({ trainer_email: user.email }),
    enabled: !!user,
    initialData: []
  });

  const { data: competitions = [] } = useQuery({
    queryKey: ['competitions', user?.email],
    queryFn: () => base44.entities.Competition.filter({ trainer_email: user.email }),
    enabled: !!user,
    initialData: []
  });

  const { data: rates = [] } = useQuery({
    queryKey: ['billing-rates', user?.email],
    queryFn: () => base44.entities.BillingRate.filter({ trainer_email: user.email }),
    enabled: !!user,
    initialData: []
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data) => {
      const session = await base44.entities.TrainingSession.create(data);
      // Create notification for rider about new session
      await base44.entities.Notification.create({
        user_email: data.rider_email,
        type: 'session_scheduled',
        title: 'New Training Session Scheduled',
        message: `${user.first_name || user.full_name || 'Your trainer'} scheduled a ${data.session_type} session for ${format(new Date(data.session_date), 'MMM d, yyyy at h:mm a')}.`,
        related_entity_type: 'TrainingSession',
        related_entity_id: session.id,
        link: `/RiderProfile?highlight=${session.id}`
      });
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      setShowAddSession(false);
      setEditingSession(null);
      setSessionForm({
        rider_email: '',
        rider_name: '',
        horse_name: '',
        session_date: '',
        duration: 60,
        session_type: 'Lesson',
        notes: '',
        is_recurring: false,
        recurrence_weeks: 4
      });
    }
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, data, originalSession }) => {
      await base44.entities.TrainingSession.update(id, data);
      // Create notification for rider about session update
      await base44.entities.Notification.create({
        user_email: data.rider_email,
        type: 'session_scheduled',
        title: 'Training Session Updated',
        message: `Your ${data.session_type} session has been updated. New time: ${format(new Date(data.session_date), 'MMM d, yyyy at h:mm a')}.`,
        related_entity_type: 'TrainingSession',
        related_entity_id: id,
        link: `/RiderProfile?highlight=${id}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      setShowAddSession(false);
      setEditingSession(null);
      setSessionForm({
        rider_email: '',
        rider_name: '',
        horse_name: '',
        session_date: '',
        duration: 60,
        session_type: 'Lesson',
        notes: '',
        is_recurring: false,
        recurrence_weeks: 4
      });
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (session) => {
      // Create notification for rider about session cancellation
      await base44.entities.Notification.create({
        user_email: session.rider_email,
        type: 'session_cancelled',
        title: 'Training Session Cancelled',
        message: `Your ${session.session_type} session on ${format(new Date(session.session_date), 'MMM d, yyyy at h:mm a')} has been cancelled by ${user.first_name || user.full_name || 'your trainer'}.`,
        related_entity_type: 'TrainingSession',
        related_entity_id: session.id,
        link: `/RiderProfile`
      });
      return base44.entities.TrainingSession.delete(session.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
    }
  });

  const deleteCompetitionMutation = useMutation({
    mutationFn: (id) => base44.entities.Competition.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
    }
  });

  const handleAddSession = () => {
    if (!sessionForm.rider_email || !sessionForm.session_date) {
      alert('Please select a rider and date/time');
      return;
    }

    if (editingSession) {
      // Update existing session
      updateSessionMutation.mutate({
        id: editingSession.id,
        data: {
          ...sessionForm,
          trainer_email: user.email,
          trainer_name: `${user.first_name} ${user.last_name}`.trim() || user.full_name
        },
        originalSession: editingSession
      });
      return;
    }

    if (sessionForm.is_recurring) {
      // Generate recurring sessions
      const recurringGroupId = `recurring-${Date.now()}`;
      const sessions = [];
      const baseDate = new Date(sessionForm.session_date);
      
      for (let week = 0; week < sessionForm.recurrence_weeks; week++) {
        const sessionDate = new Date(baseDate);
        sessionDate.setDate(sessionDate.getDate() + (week * 7));
        
        sessions.push({
          trainer_email: user.email,
          trainer_name: `${user.first_name} ${user.last_name}`.trim() || user.full_name,
          rider_email: sessionForm.rider_email,
          rider_name: sessionForm.rider_name,
          horse_name: sessionForm.horse_name,
          session_date: sessionDate.toISOString(),
          duration: sessionForm.duration,
          session_type: sessionForm.session_type,
          notes: sessionForm.notes,
          is_recurring: true,
          recurring_group_id: recurringGroupId,
          status: 'scheduled'
        });
      }

      // Create all sessions
      Promise.all(sessions.map(s => base44.entities.TrainingSession.create(s)))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
          setShowAddSession(false);
          setSessionForm({
            rider_email: '',
            rider_name: '',
            horse_name: '',
            session_date: '',
            duration: 60,
            session_type: 'Lesson',
            notes: '',
            is_recurring: false,
            recurrence_weeks: 4
          });
        });
    } else {
      createSessionMutation.mutate({
        ...sessionForm,
        trainer_email: user.email,
        trainer_name: `${user.first_name} ${user.last_name}`.trim() || user.full_name
      });
    }
  };

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const todaysSessions = sessions
    .filter(s => {
      const sessionDate = new Date(s.session_date);
      return sessionDate >= todayStart && sessionDate <= todayEnd && s.status !== 'cancelled';
    })
    .sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

  const getSessionsForDate = (date) => {
    return sessions.filter(s => {
      const sessionDate = new Date(s.session_date);
      return isSameDay(sessionDate, date) && s.status !== 'cancelled';
    });
  };

  const getCompetitionsForDate = (date) => {
    return competitions.filter(c => {
      const compDate = new Date(c.competition_date);
      return isSameDay(compDate, date) && c.status !== 'cancelled';
    });
  };

  const getViewRangeSessions = () => {
    const now = new Date();
    let start, end;

    if (view === 'day') {
      start = startOfDay(selectedDate);
      end = endOfDay(selectedDate);
    } else if (view === 'week') {
      start = startOfWeek(selectedDate, { weekStartsOn: 0 }); // Sunday
      end = endOfWeek(selectedDate, { weekStartsOn: 0 }); // Saturday
    } else {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    }

    const filteredSessions = sessions.filter(s => {
      const sessionDate = new Date(s.session_date);
      return isWithinInterval(sessionDate, { start, end }) && s.status !== 'cancelled';
    }).sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

    const filteredComps = competitions.filter(c => {
      const compDate = new Date(c.competition_date);
      return isWithinInterval(compDate, { start, end }) && c.status !== 'cancelled';
    }).sort((a, b) => new Date(a.competition_date) - new Date(b.competition_date));

    return { sessions: filteredSessions, competitions: filteredComps, start, end };
  };

  const exportToExcel = () => {
    const { sessions: viewSessions, competitions: viewComps } = getViewRangeSessions();
    
    // Prepare sessions data
    const sessionsData = viewSessions.map(session => ({
      'Date': format(new Date(session.session_date), 'yyyy-MM-dd'),
      'Time': format(new Date(session.session_date), 'HH:mm'),
      'Rider': session.rider_name || session.rider_email,
      'Horse': session.horse_name || '-',
      'Type': session.session_type,
      'Duration (min)': session.duration,
      'Status': session.status,
      'Notes': session.notes || '-'
    }));

    // Prepare competitions data
    const competitionsData = viewComps.map(comp => ({
      'Date': format(new Date(comp.competition_date), 'yyyy-MM-dd'),
      'Time': format(new Date(comp.competition_date), 'HH:mm'),
      'Event': comp.name,
      'Location': comp.location,
      'Riders': comp.riders?.map(r => r.rider_name || r.rider_email).join(', ') || '-',
      'Status': comp.status
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add sessions sheet
    if (sessionsData.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(sessionsData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Training Sessions');
    }
    
    // Add competitions sheet
    if (competitionsData.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(competitionsData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Competitions');
    }

    // Generate filename
    const fileName = `Schedule_${format(selectedDate, 'MMMM_yyyy')}.xlsx`;
    
    // Save file
    XLSX.writeFile(wb, fileName);
  };

  const shareViaWhatsApp = async () => {
    const { sessions: viewSessions, competitions: viewComps } = getViewRangeSessions();
    
    // Prepare sessions data
    const sessionsData = viewSessions.map(session => ({
      'Date': format(new Date(session.session_date), 'yyyy-MM-dd'),
      'Time': format(new Date(session.session_date), 'HH:mm'),
      'Rider': session.rider_name || session.rider_email,
      'Horse': session.horse_name || '-',
      'Type': session.session_type,
      'Duration (min)': session.duration,
      'Status': session.status,
      'Notes': session.notes || '-'
    }));

    // Prepare competitions data
    const competitionsData = viewComps.map(comp => ({
      'Date': format(new Date(comp.competition_date), 'yyyy-MM-dd'),
      'Time': format(new Date(comp.competition_date), 'HH:mm'),
      'Event': comp.name,
      'Location': comp.location,
      'Riders': comp.riders?.map(r => r.rider_name || r.rider_email).join(', ') || '-',
      'Status': comp.status
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add sessions sheet
    if (sessionsData.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(sessionsData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Training Sessions');
    }
    
    // Add competitions sheet
    if (competitionsData.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(competitionsData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Competitions');
    }

    // Generate filename
    const fileName = `Schedule_${format(selectedDate, 'MMMM_yyyy')}.xlsx`;
    
    // Generate file as blob
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], fileName, { type: blob.type });

    // Try to share via Web Share API
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Training Schedule',
          text: `Training schedule for ${format(selectedDate, 'MMMM yyyy')}`
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          alert('Could not share file. File downloaded instead.');
          XLSX.writeFile(wb, fileName);
        }
      }
    } else {
      // Fallback: download file and show message
      XLSX.writeFile(wb, fileName);
      alert('File downloaded! You can now manually share it via WhatsApp.');
    }
  };

  const downloadTemplate = () => {
    // Create example data
    const exampleData = [
      {
        'Rider Email': 'rider@example.com',
        'Rider Name': 'John Doe',
        'Horse Name': 'Thunder',
        'Date (YYYY-MM-DD)': '2026-01-10',
        'Time (HH:MM)': '14:00',
        'Duration (minutes)': 60,
        'Session Type': 'Lesson',
        'Notes': 'Focus on jumping technique'
      },
      {
        'Rider Email': 'rider@example.com',
        'Rider Name': 'John Doe',
        'Horse Name': 'Thunder',
        'Date (YYYY-MM-DD)': '2026-01-12',
        'Time (HH:MM)': '10:30',
        'Duration (minutes)': 45,
        'Session Type': 'Training',
        'Notes': 'Dressage practice'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exampleData);
    
    // Add instructions at the top
    XLSX.utils.sheet_add_aoa(ws, [[
      'INSTRUCTIONS: Fill in the rows below with your sessions. Session Type must be one of: Lesson, Training, Horse Training, Horse Transport, Competition Prep, Evaluation, Other'
    ]], { origin: 'A1' });
    
    XLSX.utils.book_append_sheet(wb, ws, 'Sessions Template');
    XLSX.writeFile(wb, 'Training_Sessions_Template.xlsx');
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Skip header rows and parse data
      const headers = jsonData.find(row => row[0] === 'Rider Email');
      if (!headers) {
        alert('Invalid file format. Please use the template file.');
        setImporting(false);
        return;
      }

      const headerIndex = jsonData.indexOf(headers);
      const dataRows = jsonData.slice(headerIndex + 1).filter(row => row[0]); // Skip empty rows

      const sessionsToCreate = [];
      const errors = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const riderEmail = row[0]?.toString().trim();
        const riderName = row[1]?.toString().trim();
        const horseName = row[2]?.toString().trim();
        const dateStr = row[3]?.toString().trim();
        const timeStr = row[4]?.toString().trim();
        const duration = parseInt(row[5]) || 60;
        const sessionType = row[6]?.toString().trim() || 'Lesson';
        const notes = row[7]?.toString().trim() || '';

        // Validate required fields
        if (!riderEmail || !dateStr || !timeStr) {
          errors.push(`Row ${i + 2}: Missing required fields (Rider Email, Date, or Time)`);
          continue;
        }

        // Validate rider exists in connections
        const riderExists = riders.find(r => r.email.toLowerCase() === riderEmail.toLowerCase());
        if (!riderExists) {
          errors.push(`Row ${i + 2}: Rider ${riderEmail} is not connected to you`);
          continue;
        }

        // Parse date and time
        try {
          const sessionDate = new Date(`${dateStr}T${timeStr}`);
          if (isNaN(sessionDate.getTime())) {
            errors.push(`Row ${i + 2}: Invalid date/time format`);
            continue;
          }

          sessionsToCreate.push({
            trainer_email: user.email,
            trainer_name: `${user.first_name} ${user.last_name}`.trim() || user.full_name,
            rider_email: riderEmail,
            rider_name: riderName || riderExists.name,
            horse_name: horseName || '',
            session_date: sessionDate.toISOString(),
            duration: duration,
            session_type: sessionType,
            notes: notes,
            status: 'scheduled'
          });
        } catch (error) {
          errors.push(`Row ${i + 2}: Error parsing data - ${error.message}`);
        }
      }

      // Show summary
      if (errors.length > 0) {
        alert(`Import completed with errors:\n\n${errors.join('\n')}\n\n${sessionsToCreate.length} sessions will be imported.`);
      }

      if (sessionsToCreate.length > 0) {
        // Create all sessions
        await Promise.all(sessionsToCreate.map(s => base44.entities.TrainingSession.create(s)));
        queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
        alert(`Successfully imported ${sessionsToCreate.length} training session(s)!`);
      } else {
        alert('No valid sessions found to import.');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import file. Please check the file format and try again.');
    } finally {
      setImporting(false);
      e.target.value = ''; // Reset file input
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
          <span>{t.schedule.title}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1B4332] mb-2">{t.schedule.title}</h1>
          <p className="text-[#1B4332]/60">{t.quickActions.manageSessions}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Today's Sessions */}
          <div className="lg:col-span-1">
            <Card className="bg-white border-[#1B4332]/10 shadow-sm sticky top-6">
              <CardHeader className="border-b border-[#1B4332]/10">
                <CardTitle className="text-lg text-[#1B4332] flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {t.schedule.todaySessions}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 max-h-[600px] overflow-y-auto">
                {todaysSessions.length > 0 ? (
                  <div className="space-y-3">
                    {todaysSessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-3 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-semibold text-[#1B4332]">
                            {format(new Date(session.session_date), 'h:mm a')}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSessionMutation.mutate(session)}
                            className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-[#8B5A2B]" />
                            <span className="text-[#1B4332]">{session.rider_name || session.rider_email}</span>
                          </div>
                          {session.horse_name && (
                            <div className="text-[#1B4332]/60">🐴 {session.horse_name}</div>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-[#8B5A2B] bg-[#8B5A2B]/10 px-2 py-0.5 rounded-full inline-block">
                              {session.session_type}
                            </div>
                            {session.is_recurring && (
                              <div className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                ↻ Recurring
                              </div>
                            )}
                          </div>
                          {session.notes && (
                            <p className="text-xs text-[#1B4332]/60 mt-2">{session.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[#1B4332]/60 py-8">{t.schedule.noSessions}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Calendar */}
          <div className="lg:col-span-2">
            {/* View Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
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
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => setShowAddSession(true)}
                  size="sm"
                  className="bg-[#1B4332] hover:bg-[#1B4332]/90 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t.schedule.addSession}
                </Button>
                <Button
                  onClick={() => setShowAddCompetition(true)}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  {t.schedule.addCompetition}
                </Button>
              </div>
            </div>

            {/* Add/Edit Competition Form */}
            {(showAddCompetition || editingCompetition) && (
              <Card className="bg-white border-amber-200 mb-6">
                <CardHeader className="border-b border-amber-200/50 bg-amber-50/50">
                  <CardTitle className="text-base sm:text-lg text-[#1B4332]">
                    {editingCompetition ? t.manageStable.updateEvent : t.schedule.addCompetition}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <CompetitionForm
                    user={user}
                    riders={riders}
                    competition={editingCompetition}
                    onCancel={() => {
                      setShowAddCompetition(false);
                      setEditingCompetition(null);
                    }}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ['competitions'] });
                      setShowAddCompetition(false);
                      setEditingCompetition(null);
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Add/Edit Session Form */}
            {showAddSession && (
              <Card className="bg-white border-[#1B4332]/10 mb-6">
                <CardHeader className="border-b border-[#1B4332]/10">
                 <CardTitle className="text-base sm:text-lg text-[#1B4332]">
                   {editingSession ? 'Edit Session' : t.riderProfile.scheduleNewSession}
                 </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                     <Label>{t.riderProfile.trainer} *</Label>
                     <Select
                       value={sessionForm.rider_email}
                       onValueChange={async (value) => {
                         const rider = riders.find(r => r.email === value);
                         setSessionForm(prev => ({
                           ...prev,
                           rider_email: value,
                           rider_name: rider?.name || '',
                           horse_name: ''
                         }));
                         // Load rider's horses
                         const horses = await base44.entities.Horse.filter({ owner_email: value });
                         setRiderHorses(horses);
                       }}
                     >
                       <SelectTrigger className="border-[#1B4332]/20">
                         <SelectValue placeholder={t.riderProfile.selectTrainer} />
                       </SelectTrigger>
                       <SelectContent>
                         {riders.map(rider => (
                           <SelectItem key={rider.email} value={rider.email}>
                             {rider.name}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                    </div>
                    <div className="space-y-2">
                     <Label>{t.riderProfile.horse}</Label>
                     <Select
                       value={sessionForm.horse_name}
                       onValueChange={(value) => setSessionForm(prev => ({ ...prev, horse_name: value }))}
                       disabled={!sessionForm.rider_email}
                     >
                       <SelectTrigger className="border-[#1B4332]/20">
                         <SelectValue placeholder={sessionForm.rider_email ? t.riderProfile.selectHorse : t.riderProfile.selectTrainer} />
                       </SelectTrigger>
                       <SelectContent>
                         {riderHorses.map(horse => (
                           <SelectItem key={horse.id} value={horse.name}>
                             {horse.name}
                           </SelectItem>
                         ))}
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
                  <div className="space-y-2">
                    <Label>{t.riderProfile.notes}</Label>
                    <Textarea
                      value={sessionForm.notes}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="border-[#1B4332]/20"
                      placeholder={t.riderProfile.sessionDetails}
                    />
                  </div>
                  
                  {/* Recurring Options */}
                  <div className="pt-4 border-t border-[#1B4332]/10 space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_recurring"
                        checked={sessionForm.is_recurring}
                        onChange={(e) => setSessionForm(prev => ({ ...prev, is_recurring: e.target.checked }))}
                        className="w-4 h-4 text-[#1B4332] border-[#1B4332]/20 rounded focus:ring-[#1B4332]"
                      />
                      <Label htmlFor="is_recurring" className="cursor-pointer">
                        Repeat weekly
                      </Label>
                    </div>
                    
                    {sessionForm.is_recurring && (
                      <div className="space-y-2">
                        <Label>Number of weeks</Label>
                        <Input
                          type="number"
                          min="1"
                          max="52"
                          value={sessionForm.recurrence_weeks}
                          onChange={(e) => setSessionForm(prev => ({ ...prev, recurrence_weeks: parseInt(e.target.value) || 1 }))}
                          className="border-[#1B4332]/20"
                        />
                        <p className="text-xs text-[#1B4332]/60">
                          This will create {sessionForm.recurrence_weeks} sessions, one per week
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddSession(false);
                      setEditingSession(null);
                      setSessionForm({
                        rider_email: '',
                        rider_name: '',
                        horse_name: '',
                        session_date: '',
                        duration: 60,
                        session_type: 'Lesson',
                        notes: '',
                        is_recurring: false,
                        recurrence_weeks: 4
                      });
                    }}
                    className="border-[#1B4332]/20 w-full sm:w-auto"
                  >
                    {t.common.cancel}
                  </Button>
                  <Button
                    onClick={handleAddSession}
                    disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
                    className="bg-[#1B4332] hover:bg-[#1B4332]/90 w-full sm:w-auto"
                  >
                    {(createSessionMutation.isPending || updateSessionMutation.isPending) ? t.riderProfile.scheduling : (editingSession ? t.common.save : t.riderProfile.scheduleSession)}
                  </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Calendar View */}
            <Card className="bg-white border-[#1B4332]/10">
              <CardHeader className="border-b border-[#1B4332]/10">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <CardTitle className="text-lg sm:text-xl text-[#1B4332]">
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
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadTemplate}
                      className="border-blue-600/20 text-blue-600 hover:bg-blue-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      <span className="hidden xs:inline">Download </span>Template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={importing}
                      className="border-[#1B4332]/20 text-[#1B4332] hover:bg-[#1B4332]/5"
                      onClick={() => document.getElementById('import-excel').click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {importing ? 'Importing...' : <><span className="hidden xs:inline">Import from </span>Excel</>}
                    </Button>
                    <input
                      id="import-excel"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                      className="border-[#1B4332]/20 text-[#1B4332] hover:bg-[#1B4332]/5"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      <span className="hidden xs:inline">Export to </span>Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={shareViaWhatsApp}
                      className="border-green-600/20 text-green-600 hover:bg-green-50"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      <span className="hidden xs:inline">Share via </span>WhatsApp
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-3">
                  {(() => {
                    const { sessions: viewSessions, competitions: viewComps } = getViewRangeSessions();
                    
                    if (viewSessions.length === 0 && viewComps.length === 0) {
                      return <p className="text-center text-[#1B4332]/60 py-8">{t.riderProfile.noSessionsView} {view}</p>;
                    }

                    return (
                      <>
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
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                  {t.riderProfile.competition}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingCompetition(competition)}
                                  className="h-8 w-8 p-0 text-[#1B4332] hover:bg-[#1B4332]/10"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteCompetitionMutation.mutate(competition.id)}
                                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-sm text-[#1B4332]/80 mb-2">
                              📍 {competition.location}
                            </div>
                            <div className="space-y-2 mt-3">
                              {competition.riders?.map((rider, idx) => {
                                const totalCost = rider.services?.reduce((sum, service) => {
                                  const rate = rates.find(r => r.trainer_email === user.email && r.session_type === service);
                                  return sum + (rate?.rate || 0);
                                }, 0) || 0;

                                return (
                                  <div key={idx} className="p-2 bg-white rounded border border-amber-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="text-sm font-medium text-[#1B4332]">
                                          {rider.rider_name || rider.rider_email}
                                        </div>
                                        <div className="text-xs text-[#1B4332]/60">
                                          {rider.services?.join(', ')}
                                        </div>
                                        {totalCost > 0 && (
                                          <div className="text-xs font-semibold text-amber-700 mt-1">
                                            Cost: {rates[0]?.currency || 'ILS'} {totalCost.toFixed(2)}
                                          </div>
                                        )}
                                      </div>
                                      <Select
                                        value={rider.payment_status || 'pending'}
                                        onValueChange={async (value) => {
                                          const updatedRiders = competition.riders.map((r, i) => 
                                            i === idx ? { ...r, payment_status: value } : r
                                          );
                                          await base44.entities.Competition.update(competition.id, {
                                            riders: updatedRiders
                                          });
                                          queryClient.invalidateQueries({ queryKey: ['competitions'] });
                                        }}
                                      >
                                        <SelectTrigger className="w-28 h-7 text-xs border-amber-300">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">{t.guardian.pending}</SelectItem>
                                          <SelectItem value="requested">{t.guardian.requested}</SelectItem>
                                          <SelectItem value="paid">{t.guardian.paid}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {viewSessions.map((session) => (
                          <div
                            key={session.id}
                            className="p-4 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-semibold text-[#1B4332] mb-1">
                                  {format(new Date(session.session_date), 'EEE, MMM d - h:mm a')} ({session.duration} min)
                                </div>
                                <div className="text-sm text-[#1B4332]/80">
                                  {session.rider_name || session.rider_email}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    // Load rider's horses
                                    const horses = await base44.entities.Horse.filter({ owner_email: session.rider_email });
                                    setRiderHorses(horses);
                                    setEditingSession(session);
                                    setSessionForm({
                                      rider_email: session.rider_email,
                                      rider_name: session.rider_name,
                                      horse_name: session.horse_name || '',
                                      session_date: format(new Date(session.session_date), "yyyy-MM-dd'T'HH:mm"),
                                      duration: session.duration,
                                      session_type: session.session_type,
                                      notes: session.notes || '',
                                      is_recurring: false,
                                      recurrence_weeks: 4
                                    });
                                    setShowAddSession(true);
                                  }}
                                  className="h-8 w-8 p-0 text-[#1B4332] hover:bg-[#1B4332]/10"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteSessionMutation.mutate(session)}
                                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {session.horse_name && (
                              <div className="text-sm text-[#1B4332]/60 mb-2">
                                🐴 {session.horse_name}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-[#8B5A2B] bg-[#8B5A2B]/10 px-2 py-1 rounded-full inline-block">
                                {session.session_type}
                              </div>
                              {session.is_recurring && (
                                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full inline-block">
                                  ↻ {t.events.scheduleRecurring}
                                </div>
                              )}
                            </div>
                            {session.notes && (
                              <p className="text-sm text-[#1B4332]/60 mt-3">{session.notes}</p>
                            )}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}