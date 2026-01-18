import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from 'framer-motion';
import { Home, ChevronRight, Plus, Edit2, Trash2, X, Upload, Calendar, Stethoscope } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LanguageSelector from '../components/LanguageSelector';
import Logo from '../components/Logo';
import { useTranslation } from '../components/translations';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';

export default function MyHorses() {
  const t = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHorse, setEditingHorse] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCustomStable, setShowCustomStable] = useState(false);
  const [selectedHorseForEvents, setSelectedHorseForEvents] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventFormData, setEventFormData] = useState({
    event_type: 'Farrier',
    event_date: '',
    provider_name: '',
    description: '',
    cost: '',
    next_due_date: '',
    notes: '',
    is_recurring: false,
    recurrence_weeks: 6,
    reminder_weeks_before: 1,
    reminder_email: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    home_stable_name: '',
    suite_number: '',
    breed: '',
    birth_year: '',
    color: '',
    height: '',
    chip_number: '',
    description: '',
    image_url: ''
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        if (!userData.roles?.includes('Rider')) {
          alert('This page is only accessible to riders');
          navigate(createPageUrl('Dashboard'));
          return;
        }
        setUser(userData);
      } catch (error) {
        base44.auth.redirectToLogin(createPageUrl('MyHorses'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const { data: horses = [] } = useQuery({
    queryKey: ['my-horses', user?.email],
    queryFn: () => base44.entities.Horse.filter({ owner_email: user.email }),
    enabled: !!user,
    initialData: []
  });

  const { data: stables = [] } = useQuery({
    queryKey: ['approved-stables'],
    queryFn: () => base44.entities.Stable.filter({ approval_status: 'approved' }),
    initialData: []
  });

  const { data: horseEvents = [] } = useQuery({
    queryKey: ['horse-events', selectedHorseForEvents?.id],
    queryFn: () => base44.entities.HorseEvent.filter({ horse_id: selectedHorseForEvents.id }),
    enabled: !!selectedHorseForEvents,
    initialData: []
  });

  const createHorseMutation = useMutation({
    mutationFn: (data) => base44.entities.Horse.create({ ...data, owner_email: user.email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-horses'] });
      resetForm();
    }
  });

  const updateHorseMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Horse.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-horses'] });
      resetForm();
    }
  });

  const deleteHorseMutation = useMutation({
    mutationFn: (id) => base44.entities.Horse.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-horses'] });
    }
  });

  const createEventMutation = useMutation({
    mutationFn: (data) => base44.entities.HorseEvent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horse-events'] });
      setShowEventForm(false);
      setEventFormData({
        event_type: 'Farrier',
        event_date: '',
        provider_name: '',
        description: '',
        cost: '',
        next_due_date: '',
        notes: '',
        is_recurring: false,
        recurrence_weeks: 6,
        reminder_weeks_before: 1,
        reminder_email: ''
      });
    }
  });

  const completeEventMutation = useMutation({
    mutationFn: ({ id, completedDate }) => base44.entities.HorseEvent.update(id, {
      status: 'completed',
      completed_date: completedDate
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horse-events'] });
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id) => base44.entities.HorseEvent.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horse-events'] });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      home_stable_name: '',
      suite_number: '',
      breed: '',
      birth_year: '',
      color: '',
      height: '',
      chip_number: '',
      description: '',
      image_url: ''
    });
    setEditingHorse(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      alert('Please enter a horse name');
      return;
    }

    const submitData = {
      name: formData.name,
      home_stable_name: formData.home_stable_name || undefined,
      suite_number: formData.suite_number || undefined,
      breed: formData.breed || undefined,
      birth_year: formData.birth_year ? parseInt(formData.birth_year) : undefined,
      color: formData.color || undefined,
      height: formData.height || undefined,
      chip_number: formData.chip_number || undefined,
      description: formData.description || undefined,
      image_url: formData.image_url || undefined
    };

    if (editingHorse) {
      updateHorseMutation.mutate({ id: editingHorse.id, data: submitData });
    } else {
      createHorseMutation.mutate(submitData);
    }
  };

  const handleEdit = (horse) => {
    setEditingHorse(horse);
    const isCustomStable = horse.home_stable_name && !stables.some(s => s.name === horse.home_stable_name);
    setShowCustomStable(isCustomStable);
    setFormData({
      name: horse.name || '',
      home_stable_name: horse.home_stable_name || '',
      suite_number: horse.suite_number || '',
      breed: horse.breed || '',
      birth_year: horse.birth_year?.toString() || '',
      color: horse.color || '',
      height: horse.height || '',
      chip_number: horse.chip_number || '',
      description: horse.description || '',
      image_url: horse.image_url || ''
    });
    setShowForm(true);
  };

  const handleDelete = (horse) => {
    if (confirm(`Are you sure you want to delete ${horse.name}?`)) {
      deleteHorseMutation.mutate(horse.id);
    }
  };

  const handleAddEvent = () => {
    if (!eventFormData.event_type || !eventFormData.event_date) {
      alert('Please fill in event type and date');
      return;
    }

    if (eventFormData.is_recurring && !eventFormData.reminder_email) {
      alert('Please provide an email address for reminders');
      return;
    }

    const eventData = {
      horse_id: selectedHorseForEvents.id,
      horse_name: selectedHorseForEvents.name,
      event_type: eventFormData.event_type,
      event_date: eventFormData.event_date,
      provider_name: eventFormData.provider_name || undefined,
      description: eventFormData.description || undefined,
      cost: eventFormData.cost ? parseFloat(eventFormData.cost) : undefined,
      notes: eventFormData.notes || undefined,
      status: 'scheduled'
    };

    if (eventFormData.is_recurring) {
      // Calculate next due date based on recurrence
      const nextDate = new Date(eventFormData.event_date);
      nextDate.setDate(nextDate.getDate() + (eventFormData.recurrence_weeks * 7));
      
      eventData.is_recurring = true;
      eventData.recurrence_weeks = parseInt(eventFormData.recurrence_weeks);
      eventData.reminder_weeks_before = parseInt(eventFormData.reminder_weeks_before);
      eventData.reminder_email = eventFormData.reminder_email;
      eventData.next_due_date = nextDate.toISOString().split('T')[0];
    } else {
      eventData.next_due_date = eventFormData.next_due_date || undefined;
    }

    createEventMutation.mutate(eventData);
  };

  const handleCompleteEvent = (event) => {
    const today = new Date().toISOString().split('T')[0];
    completeEventMutation.mutate({ id: event.id, completedDate: today });

    // If recurring, create next occurrence
    if (event.is_recurring && event.next_due_date) {
      const nextDate = new Date(event.next_due_date);
      const futureDate = new Date(nextDate);
      futureDate.setDate(futureDate.getDate() + (event.recurrence_weeks * 7));

      createEventMutation.mutate({
        horse_id: event.horse_id,
        horse_name: event.horse_name,
        event_type: event.event_type,
        event_date: event.next_due_date,
        provider_name: event.provider_name,
        description: event.description,
        cost: event.cost,
        notes: event.notes,
        is_recurring: true,
        recurrence_weeks: event.recurrence_weeks,
        reminder_weeks_before: event.reminder_weeks_before,
        reminder_email: event.reminder_email,
        next_due_date: futureDate.toISOString().split('T')[0],
        status: 'scheduled',
        parent_event_id: event.id
      });
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, image_url: file_url }));
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{t.horses.title}</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1B4332] mb-2">{t.horses.title}</h1>
            <p className="text-[#1B4332]/60">{t.horses.subtitle}</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#1B4332] hover:bg-[#1B4332]/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t.horses.addHorse}
          </Button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <Card className="bg-white border-[#1B4332]/10 mb-6">
            <CardHeader className="border-b border-[#1B4332]/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-[#1B4332]">
                  {editingHorse ? t.horses.editHorse : t.horses.addNewHorse}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="text-[#1B4332]/60"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.horses.horseName} *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="border-[#1B4332]/20"
                    placeholder={t.horses.horseName}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.horses.breed}</Label>
                  <Input
                    value={formData.breed}
                    onChange={(e) => setFormData(prev => ({ ...prev, breed: e.target.value }))}
                    className="border-[#1B4332]/20"
                    placeholder={t.horses.breed}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.horses.homeStable}</Label>
                  {!showCustomStable ? (
                    <Select
                      value={formData.home_stable_name}
                      onValueChange={(value) => {
                        if (value === '__custom__') {
                          setShowCustomStable(true);
                          setFormData(prev => ({ ...prev, home_stable_name: '' }));
                        } else {
                          setFormData(prev => ({ ...prev, home_stable_name: value }));
                        }
                      }}
                    >
                      <SelectTrigger className="border-[#1B4332]/20">
                        <SelectValue placeholder={t.horses.selectStable} />
                      </SelectTrigger>
                      <SelectContent>
                        {stables.map(stable => (
                          <SelectItem key={stable.id} value={stable.name}>
                            {stable.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">{t.horses.otherCustom}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={formData.home_stable_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, home_stable_name: e.target.value }))}
                        className="border-[#1B4332]/20"
                        placeholder={t.horses.homeStable}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCustomStable(false);
                          setFormData(prev => ({ ...prev, home_stable_name: '' }));
                        }}
                        className="border-[#1B4332]/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t.horses.suiteNumber}</Label>
                  <Input
                    value={formData.suite_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, suite_number: e.target.value }))}
                    className="border-[#1B4332]/20"
                    placeholder={t.horses.suiteNumber}
                  />
                </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t.horses.birthYear}</Label>
                  <Input
                    type="number"
                    min="1990"
                    max={new Date().getFullYear()}
                    value={formData.birth_year}
                    onChange={(e) => setFormData(prev => ({ ...prev, birth_year: e.target.value }))}
                    className="border-[#1B4332]/20"
                    placeholder={t.horses.birthYear}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.horses.color}</Label>
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="border-[#1B4332]/20"
                    placeholder={t.horses.color}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.horses.height}</Label>
                  <Input
                    value={formData.height}
                    onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                    className="border-[#1B4332]/20"
                    placeholder={t.horses.height}
                  />
                </div>
                </div>

                <div className="space-y-2">
                <Label>{t.horses.microchip}</Label>
                <Input
                  value={formData.chip_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, chip_number: e.target.value }))}
                  className="border-[#1B4332]/20 font-mono text-sm"
                  placeholder={t.horses.microchip}
                />
                </div>

                <div className="space-y-2">
                <Label>{t.horses.description}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="border-[#1B4332]/20"
                  placeholder={t.horses.description}
                  rows={3}
                />
                </div>

                <div className="space-y-2">
                <Label>{t.horses.horsePhoto}</Label>
                {formData.image_url && (
                  <div className="mb-2">
                    <img 
                      src={formData.image_url} 
                      alt="Horse" 
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
                <label className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingImage}
                    className="border-[#1B4332]/20"
                    onClick={() => document.getElementById('horse-image-upload').click()}
                    >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingImage ? t.horses.uploading : t.horses.uploadPhoto}
                    </Button>
                  <input
                    id="horse-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="border-[#1B4332]/20"
                >
                  {t.common.cancel}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createHorseMutation.isPending || updateHorseMutation.isPending}
                  className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                >
                  {editingHorse ? t.horses.updateHorse : t.horses.addHorse}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Horses List */}
        {horses.length === 0 ? (
          <Card className="bg-white border-[#1B4332]/10">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-[#1B4332]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🐴</span>
              </div>
              <h3 className="text-lg font-semibold text-[#1B4332] mb-2">{t.horses.noHorses}</h3>
              <p className="text-[#1B4332]/60 mb-4">{t.horses.startAdding}</p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t.horses.addHorse}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {horses.map((horse) => (
              <Card key={horse.id} className="bg-white border-[#1B4332]/10 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    {horse.image_url ? (
                      <img 
                        src={horse.image_url} 
                        alt={horse.name}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-[#1B4332]/10 rounded-lg flex items-center justify-center text-4xl">
                        🐴
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-[#1B4332] mb-1">
                        {horse.name}
                      </h3>
                      {horse.breed && (
                        <p className="text-sm text-[#1B4332]/70 mb-1">{horse.breed}</p>
                      )}
                      {horse.chip_number && (
                        <p className="text-xs text-[#1B4332]/60 font-mono mb-1">
                          🔖 {t.horses.chipLabel} {horse.chip_number}
                        </p>
                      )}
                      {(horse.home_stable_name || horse.suite_number) && (
                        <p className="text-sm text-[#1B4332]/60 mb-2">
                          📍 {horse.home_stable_name}{horse.suite_number && ` - Suite ${horse.suite_number}`}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {horse.birth_year && (
                          <span className="text-xs bg-[#1B4332]/10 text-[#1B4332] px-2 py-1 rounded-full">
                            {t.horses.born} {horse.birth_year}
                          </span>
                        )}
                        {horse.color && (
                          <span className="text-xs bg-[#8B5A2B]/10 text-[#8B5A2B] px-2 py-1 rounded-full">
                            {horse.color}
                          </span>
                        )}
                        {horse.height && (
                          <span className="text-xs bg-[#1B4332]/10 text-[#1B4332] px-2 py-1 rounded-full">
                            {horse.height}
                          </span>
                        )}
                      </div>
                      {horse.description && (
                        <p className="text-sm text-[#1B4332]/60 mb-3 line-clamp-2">
                          {horse.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedHorseForEvents(horse)}
                          className="border-[#1B4332]/20 text-[#1B4332]"
                        >
                          <Calendar className="w-3 h-3 mr-1" />
                          {t.horses.healthLog}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(horse)}
                          className="border-[#1B4332]/20 text-[#1B4332]"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          {t.common.edit}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(horse)}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {t.common.delete}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Horse Events Modal */}
      {selectedHorseForEvents && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-[#1B4332]/10 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl text-[#1B4332] flex items-center gap-2">
                  <Stethoscope className="w-5 h-5" />
                  {t.events.title} - {selectedHorseForEvents.name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedHorseForEvents(null);
                    setShowEventForm(false);
                  }}
                  className="text-[#1B4332]/60"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Add Event Button */}
              {!showEventForm && (
                <Button
                  onClick={() => setShowEventForm(true)}
                  className="w-full bg-[#1B4332] hover:bg-[#1B4332]/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t.events.logNewEvent}
                </Button>
              )}

              {/* Event Form */}
              {showEventForm && (
                <div className="p-4 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t.events.eventType} *</Label>
                      <Select
                        value={eventFormData.event_type}
                        onValueChange={(value) => setEventFormData(prev => ({ ...prev, event_type: value }))}
                      >
                        <SelectTrigger className="border-[#1B4332]/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Farrier">{t.events.farrier}</SelectItem>
                          <SelectItem value="Vaccination">{t.events.vaccination}</SelectItem>
                          <SelectItem value="Veterinarian">{t.events.veterinarian}</SelectItem>
                          <SelectItem value="Other">{t.events.other}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.events.date} *</Label>
                      <Input
                        type="date"
                        value={eventFormData.event_date}
                        onChange={(e) => setEventFormData(prev => ({ ...prev, event_date: e.target.value }))}
                        className="border-[#1B4332]/20"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t.events.providerName}</Label>
                      <Input
                        value={eventFormData.provider_name}
                        onChange={(e) => setEventFormData(prev => ({ ...prev, provider_name: e.target.value }))}
                        className="border-[#1B4332]/20"
                        placeholder={t.events.providerName}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.events.cost}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={eventFormData.cost}
                        onChange={(e) => setEventFormData(prev => ({ ...prev, cost: e.target.value }))}
                        className="border-[#1B4332]/20"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.events.description}</Label>
                    <Textarea
                      value={eventFormData.description}
                      onChange={(e) => setEventFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="border-[#1B4332]/20"
                      placeholder={t.events.whatWasDone}
                      rows={3}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t.events.nextDueDate}</Label>
                      <Input
                        type="date"
                        value={eventFormData.next_due_date}
                        onChange={(e) => setEventFormData(prev => ({ ...prev, next_due_date: e.target.value }))}
                        className="border-[#1B4332]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.events.additionalNotes}</Label>
                      <Input
                        value={eventFormData.notes}
                        onChange={(e) => setEventFormData(prev => ({ ...prev, notes: e.target.value }))}
                        className="border-[#1B4332]/20"
                        placeholder={t.events.anyOtherNotes}
                      />
                    </div>
                  </div>

                  {/* Recurring Schedule */}
                  <div className="pt-4 border-t border-[#1B4332]/10 space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_recurring"
                        checked={eventFormData.is_recurring}
                        onChange={(e) => setEventFormData(prev => ({ 
                          ...prev, 
                          is_recurring: e.target.checked,
                          reminder_email: e.target.checked ? user.email : ''
                        }))}
                        className="w-4 h-4 text-[#1B4332] border-[#1B4332]/20 rounded focus:ring-[#1B4332]"
                      />
                      <Label htmlFor="is_recurring" className="cursor-pointer font-semibold text-[#1B4332]">
                        {t.events.scheduleRecurring}
                      </Label>
                    </div>
                    
                    {eventFormData.is_recurring && (
                      <div className="space-y-4 pl-6">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{t.events.repeatEvery} *</Label>
                            <Input
                              type="number"
                              min="1"
                              max="52"
                              value={eventFormData.recurrence_weeks}
                              onChange={(e) => setEventFormData(prev => ({ ...prev, recurrence_weeks: e.target.value }))}
                              className="border-[#1B4332]/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t.events.remindMe} *</Label>
                            <Input
                              type="number"
                              min="1"
                              max={eventFormData.recurrence_weeks || 1}
                              value={eventFormData.reminder_weeks_before}
                              onChange={(e) => setEventFormData(prev => ({ ...prev, reminder_weeks_before: e.target.value }))}
                              className="border-[#1B4332]/20"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t.events.reminderEmail} *</Label>
                          <Input
                            type="email"
                            value={eventFormData.reminder_email}
                            onChange={(e) => setEventFormData(prev => ({ ...prev, reminder_email: e.target.value }))}
                            className="border-[#1B4332]/20"
                            placeholder={t.events.reminderEmail}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowEventForm(false);
                        setEventFormData({
                          event_type: 'Farrier',
                          event_date: '',
                          provider_name: '',
                          description: '',
                          cost: '',
                          next_due_date: '',
                          notes: '',
                          is_recurring: false,
                          recurrence_weeks: 6,
                          reminder_weeks_before: 1,
                          reminder_email: ''
                        });
                      }}
                      className="border-[#1B4332]/20"
                    >
                      {t.common.cancel}
                    </Button>
                    <Button
                      onClick={handleAddEvent}
                      disabled={createEventMutation.isPending}
                      className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                    >
                      {createEventMutation.isPending ? t.events.saving : t.events.saveEvent}
                    </Button>
                  </div>
                </div>
              )}

              {/* Events List */}
              <div className="space-y-3">
                <h3 className="font-semibold text-[#1B4332]">{t.events.eventHistory}</h3>
                {horseEvents.length > 0 ? (
                  horseEvents
                    .sort((a, b) => {
                      // Scheduled events first, then by date
                      if (a.status === 'scheduled' && b.status !== 'scheduled') return -1;
                      if (a.status !== 'scheduled' && b.status === 'scheduled') return 1;
                      return new Date(b.event_date) - new Date(a.event_date);
                    })
                    .map((event) => (
                      <div
                        key={event.id}
                        className={`p-4 rounded-lg border ${
                          event.status === 'scheduled' 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-white border-[#1B4332]/10'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`text-xs px-2 py-1 rounded-full ${
                              event.event_type === 'Farrier' ? 'bg-blue-100 text-blue-800' :
                              event.event_type === 'Vaccination' ? 'bg-green-100 text-green-800' :
                              event.event_type === 'Veterinarian' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {event.event_type}
                            </div>
                            <span className="text-sm text-[#1B4332]/60">
                              {format(new Date(event.event_date), 'MMM d, yyyy')}
                            </span>
                            {event.status === 'scheduled' && (
                              <div className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                                📅 {t.events.scheduled}
                              </div>
                            )}
                            {event.status === 'completed' && (
                              <div className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                                ✓ {t.events.completed}
                              </div>
                            )}
                            {event.is_recurring && (
                              <div className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">
                                ↻ {t.events.every} {event.recurrence_weeks}{t.events.weeks}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteEventMutation.mutate(event.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>

                        {event.provider_name && (
                          <p className="text-sm text-[#1B4332] mb-1">
                            <strong>{t.events.provider}</strong> {event.provider_name}
                          </p>
                        )}
                        
                        {event.description && (
                          <p className="text-sm text-[#1B4332]/80 mb-2">
                            {event.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-3 text-xs text-[#1B4332]/60 mb-2">
                          {event.cost && (
                            <span>💰 ${event.cost.toFixed(2)}</span>
                          )}
                          {event.next_due_date && event.status !== 'completed' && (
                            <span className="text-amber-700">
                              📅 {t.events.nextDue} {format(new Date(event.next_due_date), 'MMM d, yyyy')}
                            </span>
                          )}
                          {event.completed_date && (
                            <span className="text-green-700">
                              ✓ {t.events.done} {format(new Date(event.completed_date), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                        
                        {event.notes && (
                          <p className="text-xs text-[#1B4332]/60 mb-2 italic">
                            {event.notes}
                          </p>
                        )}

                        {event.status === 'scheduled' && (
                          <Button
                            onClick={() => handleCompleteEvent(event)}
                            disabled={completeEventMutation.isPending}
                            size="sm"
                            className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                          >
                            ✓ {t.events.markCompleted}
                          </Button>
                        )}
                      </div>
                    ))
                ) : (
                  <p className="text-center text-[#1B4332]/60 py-8">
                    {t.events.noEvents}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}