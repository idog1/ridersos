import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  LogOut, 
  Edit2, 
  Check, 
  X,
  Home,
  ChevronRight,
  Briefcase,
  Upload,
  Calendar as CalendarIcon,
  Users,
  MessageSquare,
  Bell,
  GripVertical
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LanguageSelector from '../components/LanguageSelector';
import Logo from '../components/Logo';
import { useTranslation } from '../components/translations';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function Dashboard() {
  const t = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pendingConnections, setPendingConnections] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    roles: [],
    profile_image: '',
    birthday: '',
    parent_email: ''
  });
  const [birthdayInputs, setBirthdayInputs] = useState({ day: '', month: '', year: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [quickActionOrder, setQuickActionOrder] = useState([]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);

        // Parse full_name into first and last name
        const nameParts = (userData.full_name || '').split(' ');

        // Normalize roles: convert 'Parent' to 'Parent/Guardian' and remove duplicates
        const normalizedRoles = [...new Set((userData.roles || []).map(role => 
          role === 'Parent' ? 'Parent/Guardian' : role
        ))];

        setFormData({
          first_name: userData.first_name || nameParts[0] || '',
          last_name: userData.last_name || nameParts.slice(1).join(' ') || '',
          roles: normalizedRoles,
          profile_image: userData.profile_image || '',
          birthday: userData.birthday || '',
          parent_email: userData.parent_email || ''
        });

        // Load dashboard card order from user profile
        if (userData.dashboard_card_order) {
          setQuickActionOrder(userData.dashboard_card_order);
        }

        // Initialize birthday inputs
        if (userData.birthday) {
          const date = new Date(userData.birthday);
          setBirthdayInputs({
            day: date.getDate().toString(),
            month: (date.getMonth() + 1).toString(),
            year: date.getFullYear().toString()
          });
        }

        // Load pending connections for this user
        const connections = await base44.entities.UserConnection.filter({
          to_user_email: userData.email,
          status: 'pending'
        });
        setPendingConnections(connections);

        // Load all users for displaying names
        const users = await base44.entities.User.list();
        setAllUsers(users);
      } catch (error) {
        // Redirect to login if not authenticated
        base44.auth.redirectToLogin(createPageUrl('Dashboard'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

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
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        roles: formData.roles,
        profile_image: formData.profile_image,
        birthday: formData.birthday
      };

      // Check if user is a minor (under 18)
      if (formData.birthday && formData.roles.includes('Rider')) {
        const birthDate = new Date(formData.birthday);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const isMinor = age < 18 || (age === 18 && monthDiff < 0);

        if (isMinor && formData.parent_email) {
          // Validate parent email is not the same as rider email
          if (formData.parent_email === user.email) {
            alert('Parent/Guardian email cannot be the same as your email');
            setSaving(false);
            return;
          }
        }

        if (isMinor && formData.parent_email && formData.parent_email !== user.parent_email) {
          // Check if parent email exists in system
          const allUsers = await base44.entities.User.list();
          const parentUser = allUsers.find(u => u.email.toLowerCase() === formData.parent_email.toLowerCase());

          if (parentUser) {
            // Parent exists - add Parent/Guardian role if not present
            if (!parentUser.roles?.includes('Parent/Guardian')) {
              await base44.entities.User.update(parentUser.id, {
                roles: [...(parentUser.roles || []), 'Parent/Guardian']
              });
            }
            updateData.parent_email = formData.parent_email;

            // Create explicit guardian-minor relationship
            const existingRelationship = await base44.entities.GuardianMinor.filter({
              guardian_email: formData.parent_email.toLowerCase(),
              minor_email: user.email.toLowerCase()
            });

            if (existingRelationship.length === 0) {
              await base44.entities.GuardianMinor.create({
                guardian_email: formData.parent_email.toLowerCase(),
                minor_email: user.email.toLowerCase(),
                relationship: 'parent',
                status: 'active'
              });
            }
          } else {
            // Parent doesn't exist - invite them and create pending relationship
            try {
              await base44.users.inviteUser(formData.parent_email, 'user');
              updateData.parent_email = formData.parent_email;

              // Create pending relationship
              await base44.entities.GuardianMinor.create({
                guardian_email: formData.parent_email.toLowerCase(),
                minor_email: user.email.toLowerCase(),
                relationship: 'parent',
                status: 'pending'
              });
            } catch (error) {
              console.error('Failed to invite parent:', error);
            }
          }
        } else if (isMinor) {
          updateData.parent_email = formData.parent_email;
        }
      }

      await base44.auth.updateMe(updateData);
      setUser(prev => ({
        ...prev,
        ...updateData
      }));
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout(createPageUrl('Home'));
  };

  const handleApproveConnection = async (connectionId) => {
    try {
      await base44.entities.UserConnection.update(connectionId, { status: 'approved' });
      setPendingConnections(prev => prev.filter(c => c.id !== connectionId));
      
      // Add Trainer role if not present
      if (!formData.roles.includes('Trainer')) {
        const newRoles = [...formData.roles, 'Trainer'];
        await base44.auth.updateMe({ roles: newRoles });
        setFormData(prev => ({ ...prev, roles: newRoles }));
        setUser(prev => ({ ...prev, roles: newRoles }));
      }
    } catch (error) {
      console.error('Failed to approve connection:', error);
      alert('Failed to approve connection');
    }
  };

  const handleRejectConnection = async (connectionId) => {
    try {
      await base44.entities.UserConnection.update(connectionId, { status: 'rejected' });
      setPendingConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch (error) {
      console.error('Failed to reject connection:', error);
      alert('Failed to reject connection');
    }
  };

  const getInitials = () => {
    const first = formData.first_name?.[0] || user?.full_name?.[0] || '';
    const last = formData.last_name?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const items = Array.from(quickActionOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setQuickActionOrder(items);
    
    // Save to user profile database
    try {
      await base44.auth.updateMe({ dashboard_card_order: items });
    } catch (error) {
      console.error('Failed to save card order:', error);
    }
  };

  // Generate quick action cards based on user roles
  const getQuickActionCards = () => {
    const cards = [];

    if (formData.roles.includes('Rider')) {
      cards.push({ id: 'riderProfile', component: 'riderProfile' });
      cards.push({ id: 'myHorses', component: 'myHorses' });
    }

    if (formData.roles.includes('Parent/Guardian')) {
      cards.push({ id: 'guardianDashboard', component: 'guardianDashboard' });
    }

    cards.push({ id: 'notificationSettings', component: 'notificationSettings' });

    if (user?.role === 'admin') {
      cards.push({ id: 'adminPanel', component: 'adminPanel' });
    }

    if (formData.roles.includes('Trainer')) {
      cards.push({ id: 'myRiders', component: 'myRiders' });
      cards.push({ id: 'trainingSchedule', component: 'trainingSchedule' });
      cards.push({ id: 'billing', component: 'billing' });
    }

    if (formData.roles.includes('StableManager')) {
      cards.push({ id: 'manageStable', component: 'manageStable' });
    } else {
      cards.push({ id: 'registerStable', component: 'registerStable' });
    }

    return cards;
  };

  // Initialize order on first load or when roles change
  useEffect(() => {
    if (user && formData.roles.length > 0) {
      const availableCards = getQuickActionCards();
      const savedOrder = user.dashboard_card_order;
      
      if (!savedOrder || savedOrder.length === 0) {
        const defaultOrder = availableCards.map(c => c.id);
        setQuickActionOrder(defaultOrder);
        base44.auth.updateMe({ dashboard_card_order: defaultOrder }).catch(console.error);
      } else {
        const availableIds = availableCards.map(c => c.id);
        const filteredOrder = savedOrder.filter(id => availableIds.includes(id));
        const newCards = availableIds.filter(id => !filteredOrder.includes(id));
        const finalOrder = [...filteredOrder, ...newCards];
        setQuickActionOrder(finalOrder);
        
        // Update if new cards were added
        if (newCards.length > 0) {
          base44.auth.updateMe({ dashboard_card_order: finalOrder }).catch(console.error);
        }
      }
    }
  }, [user, formData.roles]);

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
      {/* Header */}
      <header className="bg-white border-b border-[#1B4332]/10">
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
            <Link 
              to={createPageUrl('ContactUs')}
              className="flex items-center gap-2 text-sm text-[#1B4332]/60 hover:text-[#1B4332] transition-colors"
            >
              <span className="hidden sm:inline">{t.nav.contact}</span>
              <span className="sm:hidden">Help</span>
            </Link>
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="text-[#1B4332]/60 hover:text-[#1B4332] hover:bg-[#1B4332]/5"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t.nav.signOut}
            </Button>
          </div>
        </div>
      </header>

      {/* Beta Notice */}
      <div className="bg-yellow-50 border-b border-yellow-200">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3">
          <p className="text-sm text-yellow-800 text-center">
            ⚠️ <strong>{t.beta.notice}</strong>
            <a href={createPageUrl('ContactUs')} className="underline font-semibold hover:text-yellow-900">{t.beta.reportHere}</a>
            {t.beta.usingBugReport}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-2">
            <Link to={createPageUrl('Home')} className="hover:text-[#1B4332] transition-colors">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>{t.nav.dashboard}</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1B4332]">
            {t.dashboard.welcome}, {formData.first_name || user?.full_name?.split(' ')[0] || 'Rider'}!
          </h1>
          <p className="text-[#1B4332]/60 mt-2">
            {localStorage.getItem('language') === 'he' ? 'נהל את הפרופיל שלך ועקוב אחרי המסע האקווסטרי שלך' : 'Manage your profile and track your equestrian journey'}
          </p>
        </motion.div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <Card className="bg-white border-[#1B4332]/10 shadow-sm">
            <CardHeader className="border-b border-[#1B4332]/10 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg md:text-xl text-[#1B4332] flex items-center gap-2 md:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                    <User className="w-4 h-4 md:w-5 md:h-5 text-[#1B4332]" />
                  </div>
                  <span className="hidden sm:inline">{t.profile.profileInfo}</span>
                  <span className="sm:hidden">{t.dashboard.profile}</span>
                </CardTitle>
                {!editing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                    className="border-[#1B4332]/20 text-[#1B4332] hover:bg-[#1B4332]/5"
                  >
                    <Edit2 className="w-4 h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">{t.common.edit}</span>
                  </Button>
                ) : (
                  <div className="flex gap-1 md:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(false)}
                      className="border-[#1B4332]/20 text-[#1B4332] hover:bg-[#1B4332]/5"
                    >
                      <X className="w-4 h-4 md:mr-2" />
                      <span className="hidden md:inline">{t.common.cancel}</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                    >
                      <Check className="w-4 h-4 md:mr-2" />
                      <span className="hidden md:inline">{saving ? t.common.saving : t.common.save}</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* Avatar */}
                <div className="flex flex-col items-center">
                  <Avatar className="w-24 h-24 bg-[#1B4332] text-white text-2xl font-semibold">
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
                    <label className="mt-3 cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        className="border-[#1B4332]/20 text-[#1B4332] text-xs"
                        onClick={() => document.getElementById('profile-image-upload').click()}
                      >
                        {uploadingImage ? t.profile.uploading : t.profile.uploadPhoto}
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
                  {!editing && (
                    <p className="mt-3 text-sm text-[#1B4332]/60">
                      {user?.role === 'admin' ? t.profile.administrator : t.profile.member}
                    </p>
                  )}
                </div>

                {/* Form Fields */}
                <div className="flex-1 space-y-4 md:space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="first_name" className="text-[#1B4332] font-medium">
                        {t.profile.firstName}
                      </Label>
                      {editing ? (
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                          className="border-[#1B4332]/20 focus:border-[#1B4332] focus:ring-[#1B4332]"
                          placeholder={t.profile.enterFirstName}
                          />
                      ) : (
                        <p className="text-[#1B4332] py-2">
                          {formData.first_name || '-'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="last_name" className="text-[#1B4332] font-medium">
                        {t.profile.lastName}
                      </Label>
                      {editing ? (
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                          className="border-[#1B4332]/20 focus:border-[#1B4332] focus:ring-[#1B4332]"
                          placeholder={t.profile.enterLastName}
                          />
                      ) : (
                        <p className="text-[#1B4332] py-2">
                          {formData.last_name || '-'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1B4332] font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {t.profile.email}
                    </Label>
                    <div className="flex items-center gap-3">
                      <p className="text-[#1B4332] py-2">
                        {user?.email}
                      </p>
                      <span className="text-xs bg-[#1B4332]/10 text-[#1B4332] px-2 py-1 rounded-full">
                        {t.profile.verified}
                      </span>
                    </div>
                  </div>

                  {formData.roles.includes('Rider') && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="birthday" className="text-[#1B4332] font-medium flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          {t.profile.birthday}
                        </Label>
                        {editing ? (
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              type="number"
                              placeholder="DD"
                              min="1"
                              max="31"
                              value={birthdayInputs.day}
                              onChange={(e) => {
                                const day = e.target.value;
                                setBirthdayInputs(prev => ({ ...prev, day }));
                                if (day && birthdayInputs.month && birthdayInputs.year) {
                                  const year = birthdayInputs.year;
                                  const month = birthdayInputs.month.padStart(2, '0');
                                  const dayPadded = day.padStart(2, '0');
                                  setFormData(prev => ({ ...prev, birthday: `${year}-${month}-${dayPadded}` }));
                                }
                              }}
                              className="border-[#1B4332]/20 text-center"
                            />
                            <Input
                              type="number"
                              placeholder="MM"
                              min="1"
                              max="12"
                              value={birthdayInputs.month}
                              onChange={(e) => {
                                const month = e.target.value;
                                setBirthdayInputs(prev => ({ ...prev, month }));
                                if (birthdayInputs.day && month && birthdayInputs.year) {
                                  const year = birthdayInputs.year;
                                  const monthPadded = month.padStart(2, '0');
                                  const day = birthdayInputs.day.padStart(2, '0');
                                  setFormData(prev => ({ ...prev, birthday: `${year}-${monthPadded}-${day}` }));
                                }
                              }}
                              className="border-[#1B4332]/20 text-center"
                            />
                            <Input
                              type="number"
                              placeholder="YYYY"
                              min="1900"
                              max={new Date().getFullYear()}
                              value={birthdayInputs.year}
                              onChange={(e) => {
                                const year = e.target.value;
                                setBirthdayInputs(prev => ({ ...prev, year }));
                                if (birthdayInputs.day && birthdayInputs.month && year && year.length === 4) {
                                  const month = birthdayInputs.month.padStart(2, '0');
                                  const day = birthdayInputs.day.padStart(2, '0');
                                  setFormData(prev => ({ ...prev, birthday: `${year}-${month}-${day}` }));
                                }
                              }}
                              className="border-[#1B4332]/20 text-center"
                            />
                          </div>
                        ) : (
                          <p className="text-[#1B4332] py-2">
                            {formData.birthday ? (() => {
                              const date = new Date(formData.birthday);
                              const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                              const day = date.getDate();
                              const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
                              return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
                            })() : '-'}
                          </p>
                        )}
                      </div>

                      {formData.birthday && (() => {
                        const birthDate = new Date(formData.birthday);
                        const today = new Date();
                        const age = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        const isMinor = age < 18 || (age === 18 && monthDiff < 0);
                        
                        if (isMinor) {
                          return (
                            <div className="space-y-2">
                              <Label htmlFor="parent_email" className="text-[#1B4332] font-medium flex items-center gap-2">
                                <User className="w-4 h-4" />
                                {t.profile.parentEmail} *
                              </Label>
                              {editing ? (
                                <Input
                                  id="parent_email"
                                  type="email"
                                  value={formData.parent_email}
                                  onChange={(e) => setFormData(prev => ({ ...prev, parent_email: e.target.value }))}
                                  className="border-[#1B4332]/20 focus:border-[#1B4332] focus:ring-[#1B4332]"
                                  placeholder="parent@example.com"
                                />
                              ) : (
                                <p className="text-[#1B4332] py-2">
                                  {formData.parent_email || '-'}
                                </p>
                              )}
                              {!editing && formData.parent_email && (
                                <p className="text-xs text-[#1B4332]/60">
                                  {t.profile.thisRiderMinor} ({age} years old)
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}

                  <div className="space-y-2 pb-20 md:pb-0">
                    <Label className="text-[#1B4332] font-medium flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      {t.profile.roles}
                    </Label>
                    {editing ? (
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const availableRoles = ['Rider', 'Trainer', 'Sponsor'];

                          // Check if user is not a minor (18 or older), then add Parent/Guardian role
                          if (formData.birthday) {
                            const birthDate = new Date(formData.birthday);
                            const today = new Date();
                            const age = today.getFullYear() - birthDate.getFullYear();
                            const monthDiff = today.getMonth() - birthDate.getMonth();
                            const isMinor = age < 18 || (age === 18 && monthDiff < 0);

                            if (!isMinor) {
                              availableRoles.push('Parent/Guardian');
                            }
                          }

                          return availableRoles.map(role => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => {
                                const newRoles = formData.roles.includes(role)
                                  ? formData.roles.filter(r => r !== role)
                                  : [...formData.roles, role];
                                setFormData(prev => ({ ...prev, roles: newRoles }));
                              }}
                              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                formData.roles.includes(role)
                                  ? 'bg-[#1B4332] text-white'
                                  : 'bg-[#1B4332]/10 text-[#1B4332] hover:bg-[#1B4332]/20'
                              }`}
                            >
                              {role}
                            </button>
                          ));
                        })()}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {formData.roles.length > 0 ? (
                          formData.roles.map(role => (
                            <span
                              key={role}
                              className="px-3 py-1.5 bg-[#1B4332] text-white rounded-full text-sm font-medium"
                            >
                              {role}
                            </span>
                          ))
                          ) : (
                          <p className="text-[#1B4332]/60 text-sm">{t.profile.noRolesSelected}</p>
                          )}
                          </div>
                          )}
                          </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Connections */}
        {pendingConnections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6"
          >
            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
              <CardHeader className="border-b border-orange-200/50">
                <CardTitle className="text-lg text-[#1B4332] flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center">
                    <span className="font-bold">{pendingConnections.length}</span>
                  </div>
                  {t.connections.pendingRequests}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {pendingConnections.map((connection) => {
                  const trainer = allUsers.find(u => u.email === connection.from_user_email);
                  const trainerName = trainer?.first_name && trainer?.last_name 
                    ? `${trainer.first_name} ${trainer.last_name}`
                    : trainer?.full_name || connection.from_user_email;

                  return (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-4 bg-white rounded-lg border border-orange-200"
                    >
                      <div>
                        <p className="font-semibold text-[#1B4332] text-lg">
                          {trainerName}
                        </p>
                        <p className="text-sm text-[#1B4332]/60">
                          {connection.from_user_email}
                        </p>
                        {connection.message && (
                          <p className="text-sm text-[#1B4332]/60 mt-1">
                            {connection.message}
                          </p>
                        )}
                        <p className="text-xs text-[#1B4332]/50 mt-1">
                          {t.connections.type} {connection.connection_type}
                        </p>
                      </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectConnection(connection.id)}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        {t.connections.decline}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveConnection(connection.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        {t.connections.approve}
                      </Button>
                    </div>
                    </div>
                    );
                    })}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6"
        >
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="quick-actions">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="grid md:grid-cols-2 gap-6"
                >
                  {quickActionOrder.map((cardId, index) => {
                    const renderCard = () => {
                      switch (cardId) {
                        case 'riderProfile':
                          if (!formData.roles.includes('Rider')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('RiderProfile')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <User className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.riderProfile}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.viewSchedule}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'myHorses':
                          if (!formData.roles.includes('Rider')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('MyHorses')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center text-2xl">
                                    🐴
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.myHorses}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.manageHorses}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'guardianDashboard':
                          if (!formData.roles.includes('Parent/Guardian')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('Guardian')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <Users className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.guardianDashboard}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.manageRiders}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                      case 'riderProfile':
                          if (!formData.roles.includes('Rider')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('RiderProfile')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <User className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.riderProfile}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.viewSchedule}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'myHorses':
                          if (!formData.roles.includes('Rider')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('MyHorses')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center text-2xl">
                                    🐴
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.myHorses}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.manageHorses}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'guardianDashboard':
                          if (!formData.roles.includes('Parent/Guardian')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('Guardian')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <Users className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.guardianDashboard}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.manageRiders}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'notificationSettings':
                          return (
                            <Card className="bg-white border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('NotificationSettings')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <Bell className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.notificationSettings}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.customizeAlerts}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'adminPanel':
                          if (user?.role !== 'admin') return null;
                          return (
                            <Card className="bg-white border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('Admin')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <Briefcase className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.adminPanel}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.manageStablesMessages}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'myRiders':
                          if (!formData.roles.includes('Trainer')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('MyRiders')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <User className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.myRiders}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.manageRiderTeam}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'trainingSchedule':
                          if (!formData.roles.includes('Trainer')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('Schedule')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <CalendarIcon className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.trainingSchedule}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.manageSessions}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'billing':
                          if (!formData.roles.includes('Trainer')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('Billing')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <Briefcase className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.billing}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.manageRatesRevenue}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'manageStable':
                          if (!formData.roles.includes('StableManager')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('ManageStable')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <Briefcase className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.manageStable}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.updateDetails}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        case 'registerStable':
                          if (formData.roles.includes('StableManager')) return null;
                          return (
                            <Card className="bg-gradient-to-br from-[#1B4332]/5 to-[#8B5A2B]/5 border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all cursor-pointer group">
                              <CardContent className="p-6" onClick={() => window.location.href = createPageUrl('RegisterStable')}>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                                    <Home className="w-6 h-6 text-[#1B4332]" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-[#1B4332]">{t.quickActions.registerStable}</h3>
                                    <p className="text-sm text-[#1B4332]/60">{t.quickActions.addStableToNetwork}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        default:
                          return null;
                      }
                    };

                    const card = renderCard();
                    if (!card) return null;

                    return (
                      <Draggable key={cardId} draggableId={cardId} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? 'opacity-50' : ''}
                          >
                            <div className="relative">
                              <div
                                {...provided.dragHandleProps}
                                className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1.5 bg-[#1B4332]/5 group-hover:bg-[#1B4332]/10 rounded transition-colors"
                              >
                                <GripVertical className="w-4 h-4 text-[#1B4332]/50 group-hover:text-[#1B4332]/70" />
                              </div>
                              {card}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </motion.div>
      </main>
    </div>
  );
}