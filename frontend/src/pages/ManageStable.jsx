import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from 'framer-motion';
import { Building2, Home, ChevronRight, Calendar, Plus, Trash2, Edit2, Save, X, Upload, MapPin, Navigation, UserPlus, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Logo from '../components/Logo';

export default function ManageStable() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stable, setStable] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStable, setEditingStable] = useState(false);
  const [savingStable, setSavingStable] = useState(false);
  const [stableForm, setStableForm] = useState({});
  const [uploadingImages, setUploadingImages] = useState(false);
  const [trainerEmail, setTrainerEmail] = useState('');
  const [addingTrainer, setAddingTrainer] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'Training',
    event_date: '',
    location: '',
    event_latitude: null,
    event_longitude: null
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);

        if (!userData.roles?.includes('StableManager')) {
          alert('You must be a stable manager to access this page');
          navigate(createPageUrl('Dashboard'));
          return;
        }

        // Load stable managed by this user
        const stables = await base44.entities.Stable.filter({ 
          manager_email: userData.email,
          approval_status: 'approved'
        });

        if (stables.length === 0) {
          alert('No approved stable found. Please register a stable first.');
          navigate(createPageUrl('RegisterStable'));
          return;
        }

        const stableData = stables[0];
        setStable(stableData);
        setStableForm(stableData);

        // Load events for this stable
        const stableEvents = await base44.entities.StableEvent.list(stableData.id);
        setEvents(stableEvents.sort((a, b) => new Date(a.event_date) - new Date(b.event_date)));
      } catch (error) {
        console.error('Failed to load data:', error);
        base44.auth.redirectToLogin(createPageUrl('ManageStable'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [navigate]);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const currentImages = stableForm.images || [];
    if (currentImages.length + files.length > 4) {
      alert('You can only upload up to 4 images total');
      return;
    }

    setUploadingImages(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const newImageUrls = results.map(r => r.file_url);
      
      setStableForm(prev => ({
        ...prev,
        images: [...(prev.images || []), ...newImageUrls]
      }));
    } catch (error) {
      console.error('Failed to upload images:', error);
      alert('Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = (index) => {
    setStableForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSaveStable = async () => {
    setSavingStable(true);
    try {
      await base44.entities.Stable.update(stable.id, stableForm);
      setStable(stableForm);
      setEditingStable(false);
    } catch (error) {
      console.error('Failed to update stable:', error);
      alert('Failed to update stable details');
    } finally {
      setSavingStable(false);
    }
  };

  const handleSaveEvent = async () => {
    try {
      if (editingEvent) {
        await base44.entities.StableEvent.update(editingEvent.id, eventForm);
        setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, ...eventForm } : e));
      } else {
        const newEvent = await base44.entities.StableEvent.create(stable.id, eventForm);
        setEvents(prev => [...prev, newEvent].sort((a, b) => new Date(a.event_date) - new Date(b.event_date)));
      }
      setShowEventForm(false);
      setEditingEvent(null);
      setEventForm({ 
        title: '', 
        description: '', 
        event_type: 'Training', 
        event_date: '', 
        location: stable.address || '',
        event_latitude: stable.latitude || null,
        event_longitude: stable.longitude || null
      });
    } catch (error) {
      console.error('Failed to save event:', error);
      alert('Failed to save event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await base44.entities.StableEvent.delete(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Failed to delete event');
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type || 'Training',
      event_date: event.event_date?.slice(0, 16) || '',
      location: event.location || '',
      event_latitude: event.event_latitude || null,
      event_longitude: event.event_longitude || null
    });
    setShowEventForm(true);
  };

  const handleUseStableLocation = () => {
    setEventForm(prev => ({
      ...prev,
      location: stable.address || '',
      event_latitude: stable.latitude || null,
      event_longitude: stable.longitude || null
    }));
  };

  const handleGetEventLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setEventForm(prev => ({
          ...prev,
          event_latitude: position.coords.latitude,
          event_longitude: position.coords.longitude
        }));
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location');
      }
    );
  };

  const handleAddTrainer = async () => {
    if (!trainerEmail.trim()) return;
    
    setAddingTrainer(true);
    try {
      const users = await base44.entities.User.list();
      const existingUser = users.find(u => u.email.toLowerCase() === trainerEmail.toLowerCase().trim());
      
      const currentTrainers = stable.trainer_emails || [];
      if (currentTrainers.includes(trainerEmail.toLowerCase().trim())) {
        alert('This trainer is already connected to your stable');
        setAddingTrainer(false);
        return;
      }

      if (existingUser) {
        // User exists - create connection request
        await base44.entities.UserConnection.create({
          from_user_email: user.email,
          from_user_role: 'Admin',
          to_user_email: trainerEmail.trim(),
          connection_type: 'Trainer-Rider',
          status: 'pending',
          message: `${stable.name} would like to add you as a trainer`
        });
        alert('Connection request sent! The trainer will be notified to approve.');
      } else {
        // User doesn't exist - invite them
        await base44.users.inviteUser(trainerEmail.trim(), 'user');
        alert('Invitation sent! Once they register, they will be connected as a trainer.');
      }
      
      setTrainerEmail('');
    } catch (error) {
      console.error('Failed to add trainer:', error);
      alert('Failed to add trainer. Please try again.');
    } finally {
      setAddingTrainer(false);
    }
  };

  const handleRemoveTrainer = async (email) => {
    if (!confirm(`Remove ${email} as a trainer?`)) return;
    
    try {
      const updatedTrainers = (stable.trainer_emails || []).filter(t => t !== email);
      await base44.entities.Stable.update(stable.id, { trainer_emails: updatedTrainers });
      setStable(prev => ({ ...prev, trainer_emails: updatedTrainers }));
      setStableForm(prev => ({ ...prev, trainer_emails: updatedTrainers }));
    } catch (error) {
      console.error('Failed to remove trainer:', error);
      alert('Failed to remove trainer');
    }
  };

  const handleApproveTrainer = async (connectionId, trainerEmail) => {
    try {
      await base44.entities.UserConnection.update(connectionId, { status: 'approved' });
      
      const updatedTrainers = [...(stable.trainer_emails || []), trainerEmail];
      await base44.entities.Stable.update(stable.id, { trainer_emails: updatedTrainers });
      
      setStable(prev => ({ ...prev, trainer_emails: updatedTrainers }));
      setStableForm(prev => ({ ...prev, trainer_emails: updatedTrainers }));
      
      // Reload to refresh pending requests
      window.location.reload();
    } catch (error) {
      console.error('Failed to approve trainer:', error);
      alert('Failed to approve trainer');
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
            <Link 
              to={createPageUrl('Home')}
              className="flex items-center gap-2 text-sm text-[#1B4332]/60 hover:text-[#1B4332] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <Button 
              onClick={() => navigate(createPageUrl('Dashboard'))}
              variant="outline"
              className="border-[#1B4332]/20 text-[#1B4332]"
            >
              Dashboard
            </Button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>Manage Stable</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1B4332] mb-2">
            Manage Your Stable
          </h1>
          <p className="text-[#1B4332]/60">
            Update stable details and manage events
          </p>
        </div>

        {/* Stable Details */}
        <Card className="bg-white border-[#1B4332]/10 shadow-sm mb-6">
          <CardHeader className="border-b border-[#1B4332]/10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#1B4332]" />
                </div>
                Stable Information
              </CardTitle>
              {!editingStable ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingStable(true)}
                  className="border-[#1B4332]/20 text-[#1B4332]"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingStable(false);
                      setStableForm(stable);
                    }}
                    className="border-[#1B4332]/20 text-[#1B4332]"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveStable}
                    disabled={savingStable}
                    className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingStable ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#1B4332] font-medium">Stable Name</Label>
                  {editingStable ? (
                    <Input
                      value={stableForm.name || ''}
                      onChange={(e) => setStableForm(prev => ({ ...prev, name: e.target.value }))}
                      className="border-[#1B4332]/20"
                    />
                  ) : (
                    <p className="text-[#1B4332] py-2">{stable?.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1B4332] font-medium">Phone</Label>
                  {editingStable ? (
                    <Input
                      value={stableForm.phone || ''}
                      onChange={(e) => setStableForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="border-[#1B4332]/20"
                    />
                  ) : (
                    <p className="text-[#1B4332] py-2">{stable?.phone || '-'}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[#1B4332] font-medium">Description</Label>
                {editingStable ? (
                  <Textarea
                    value={stableForm.description || ''}
                    onChange={(e) => setStableForm(prev => ({ ...prev, description: e.target.value }))}
                    className="border-[#1B4332]/20 h-24"
                  />
                ) : (
                  <p className="text-[#1B4332] py-2">{stable?.description || '-'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[#1B4332] font-medium">Address</Label>
                {editingStable ? (
                  <Input
                    value={stableForm.address || ''}
                    onChange={(e) => setStableForm(prev => ({ ...prev, address: e.target.value }))}
                    className="border-[#1B4332]/20"
                  />
                ) : (
                  <p className="text-[#1B4332] py-2">{stable?.address || '-'}</p>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#1B4332] font-medium">City</Label>
                  {editingStable ? (
                    <Input
                      value={stableForm.city || ''}
                      onChange={(e) => setStableForm(prev => ({ ...prev, city: e.target.value }))}
                      className="border-[#1B4332]/20"
                    />
                  ) : (
                    <p className="text-[#1B4332] py-2">{stable?.city || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1B4332] font-medium">State</Label>
                  {editingStable ? (
                    <Input
                      value={stableForm.state || ''}
                      onChange={(e) => setStableForm(prev => ({ ...prev, state: e.target.value }))}
                      className="border-[#1B4332]/20"
                    />
                  ) : (
                    <p className="text-[#1B4332] py-2">{stable?.state || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1B4332] font-medium">Country</Label>
                  {editingStable ? (
                    <Input
                      value={stableForm.country || ''}
                      onChange={(e) => setStableForm(prev => ({ ...prev, country: e.target.value }))}
                      className="border-[#1B4332]/20"
                    />
                  ) : (
                    <p className="text-[#1B4332] py-2">{stable?.country || '-'}</p>
                  )}
                </div>
              </div>

              {/* Images Section */}
              <div className="pt-4 border-t border-[#1B4332]/10">
                <Label className="text-[#1B4332] font-medium mb-3 block">Stable Images (max 4)</Label>
                {editingStable ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(stableForm.images || []).map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-[#1B4332]/5">
                          <img src={img} alt={`Stable ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {(stableForm.images?.length || 0) < 4 && (
                        <label className="aspect-square rounded-lg border-2 border-dashed border-[#1B4332]/20 flex flex-col items-center justify-center cursor-pointer hover:border-[#1B4332]/40 hover:bg-[#1B4332]/5 transition-colors">
                          <Upload className="w-6 h-6 text-[#1B4332]/40 mb-1" />
                          <span className="text-xs text-[#1B4332]/60">Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={uploadingImages}
                          />
                        </label>
                      )}
                    </div>
                    {uploadingImages && (
                      <p className="text-sm text-[#1B4332]/60">Uploading images...</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(stable?.images || []).map((img, idx) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-[#1B4332]/5">
                        <img src={img} alt={`Stable ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {(!stable?.images || stable.images.length === 0) && (
                      <p className="text-sm text-[#1B4332]/60 col-span-full">No images uploaded yet</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trainers Management */}
        <Card className="bg-white border-[#1B4332]/10 shadow-sm mb-6">
          <CardHeader className="border-b border-[#1B4332]/10">
            <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-[#1B4332]" />
              </div>
              Trainers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6">
              <Label className="text-[#1B4332] font-medium mb-2 block">Add Trainer</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={trainerEmail}
                  onChange={(e) => setTrainerEmail(e.target.value)}
                  placeholder="trainer@example.com"
                  className="border-[#1B4332]/20"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTrainer()}
                />
                <Button
                  onClick={handleAddTrainer}
                  disabled={addingTrainer || !trainerEmail.trim()}
                  className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {addingTrainer ? 'Adding...' : 'Add'}
                </Button>
              </div>
              <p className="text-xs text-[#1B4332]/60 mt-2">
                Enter trainer's email. They'll receive an invitation if not registered.
              </p>
            </div>

            {(stable?.trainer_emails?.length > 0) ? (
              <div className="space-y-2">
                <Label className="text-[#1B4332] font-medium">Connected Trainers</Label>
                {stable.trainer_emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-3 bg-[#1B4332]/5 rounded-lg"
                  >
                    <span className="text-[#1B4332]">{email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTrainer(email)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#1B4332]/60 text-center py-4">
                No trainers connected yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Events Management */}
        <Card className="bg-white border-[#1B4332]/10 shadow-sm">
          <CardHeader className="border-b border-[#1B4332]/10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[#1B4332]" />
                </div>
                Events
              </CardTitle>
              {!showEventForm && (
                <Button
                  size="sm"
                  onClick={() => setShowEventForm(true)}
                  className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Event
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {showEventForm && (
              <Card className="bg-[#1B4332]/5 border-[#1B4332]/20 mb-6">
                <CardContent className="p-4 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[#1B4332] font-medium">Event Title *</Label>
                      <Input
                        value={eventForm.title}
                        onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                        className="border-[#1B4332]/20"
                        placeholder="e.g. Show Jumping Competition"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#1B4332] font-medium">Event Type</Label>
                      <Select
                        value={eventForm.event_type}
                        onValueChange={(value) => setEventForm(prev => ({ ...prev, event_type: value }))}
                      >
                        <SelectTrigger className="border-[#1B4332]/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Competition">Competition</SelectItem>
                          <SelectItem value="Training">Training</SelectItem>
                          <SelectItem value="Clinic">Clinic</SelectItem>
                          <SelectItem value="Show">Show</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1B4332] font-medium">Description</Label>
                    <Textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      className="border-[#1B4332]/20 h-20"
                      placeholder="Event details..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1B4332] font-medium">Date & Time *</Label>
                    <Input
                      type="datetime-local"
                      value={eventForm.event_date}
                      onChange={(e) => setEventForm(prev => ({ ...prev, event_date: e.target.value }))}
                      className="border-[#1B4332]/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1B4332] font-medium">Location</Label>
                    <div className="flex gap-2 mb-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleUseStableLocation}
                        className="border-[#1B4332]/20 text-[#1B4332]"
                      >
                        <Building2 className="w-4 h-4 mr-1" />
                        Use Stable Location
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGetEventLocation}
                        className="border-[#1B4332]/20 text-[#1B4332]"
                      >
                        <MapPin className="w-4 h-4 mr-1" />
                        Use Current Location
                      </Button>
                    </div>
                    <Input
                      value={eventForm.location}
                      onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                      className="border-[#1B4332]/20"
                      placeholder="Event location address"
                    />
                    {eventForm.event_latitude && eventForm.event_longitude && (
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <Navigation className="w-3 h-3" />
                        <span>Location coordinates set</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowEventForm(false);
                        setEditingEvent(null);
                        setEventForm({ 
                          title: '', 
                          description: '', 
                          event_type: 'Training', 
                          event_date: '', 
                          location: stable.address || '',
                          event_latitude: stable.latitude || null,
                          event_longitude: stable.longitude || null
                        });
                      }}
                      className="border-[#1B4332]/20 text-[#1B4332]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveEvent}
                      disabled={!eventForm.title || !eventForm.event_date}
                      className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                    >
                      {editingEvent ? 'Update Event' : 'Create Event'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 bg-[#1B4332]/5 rounded-lg"
                  >
                    <div className="w-10 h-10 bg-[#8B5A2B]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-[#8B5A2B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#1B4332] mb-1">{event.title}</h3>
                      {event.description && (
                        <p className="text-sm text-[#1B4332]/60 mb-2">{event.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-[#1B4332]/60">
                        <span>{new Date(event.event_date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}</span>
                        {event.event_type && (
                          <span className="px-2 py-0.5 bg-[#8B5A2B]/10 text-[#8B5A2B] rounded-full">
                            {event.event_type}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1">
                            📍 {event.location}
                            {event.event_latitude && event.event_longitude && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${event.event_latitude},${event.event_longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#8B5A2B] hover:underline ml-1"
                              >
                                (navigate)
                              </a>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditEvent(event)}
                        className="text-[#1B4332] hover:bg-[#1B4332]/10"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#1B4332]/60 text-center py-8">
                No events yet. Create your first event!
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}