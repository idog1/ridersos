import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { motion } from 'framer-motion';
import { Home, ChevronRight, Bell, Save } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from '../components/translations';
import Logo from '../components/Logo';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function NotificationSettings() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    email_session_scheduled: true,
    email_session_cancelled: true,
    email_session_reminder: true,
    email_competition_scheduled: true,
    email_payment_request: true,
    email_horse_event_reminder: true,
    email_connection_request: true,
    inapp_session_scheduled: true,
    inapp_session_cancelled: true,
    inapp_session_reminder: true,
    inapp_competition_scheduled: true,
    inapp_payment_request: true,
    inapp_horse_event_reminder: true,
    inapp_connection_request: true
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        
        // Load existing preferences
        if (userData.notification_preferences) {
          setPreferences(prev => ({ ...prev, ...userData.notification_preferences }));
        }
      } catch (error) {
        base44.auth.redirectToLogin(createPageUrl('NotificationSettings'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ notification_preferences: preferences });
      alert('Notification preferences saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getNotificationTypes = () => [
    { key: 'session_scheduled', label: t.notificationSettings.sessionScheduled, description: t.notificationSettings.sessionScheduledDesc },
    { key: 'session_cancelled', label: t.notificationSettings.sessionCancelled, description: t.notificationSettings.sessionCancelledDesc },
    { key: 'session_reminder', label: t.notificationSettings.sessionReminders, description: t.notificationSettings.sessionRemindersDesc },
    { key: 'competition_scheduled', label: t.notificationSettings.competitionEvents, description: t.notificationSettings.competitionEventsDesc },
    { key: 'payment_request', label: t.notificationSettings.paymentRequests, description: t.notificationSettings.paymentRequestsDesc },
    { key: 'horse_event_reminder', label: t.notificationSettings.horseCareReminders, description: t.notificationSettings.horseCareRemindersDesc },
    { key: 'connection_request', label: t.notificationSettings.connectionRequests, description: t.notificationSettings.connectionRequestsDesc }
  ];

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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{t.notificationSettings.breadcrumb}</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1B4332] mb-2">{t.notificationSettings.title}</h1>
            <p className="text-[#1B4332]/60">{t.notificationSettings.subtitle}</p>
          </div>

          <Card className="bg-white border-[#1B4332]/10 shadow-sm">
            <CardHeader className="border-b border-[#1B4332]/10">
              <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#1B4332]" />
                </div>
                {t.notificationSettings.preferences}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {getNotificationTypes().map((type) => (
                <div key={type.key} className="pb-6 border-b border-[#1B4332]/10 last:border-0 last:pb-0">
                  <div className="mb-4">
                    <h3 className="font-semibold text-[#1B4332] mb-1">{type.label}</h3>
                    <p className="text-sm text-[#1B4332]/60">{type.description}</p>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`email_${type.key}`}
                        checked={preferences[`email_${type.key}`]}
                        onChange={(e) => setPreferences(prev => ({
                          ...prev,
                          [`email_${type.key}`]: e.target.checked
                        }))}
                        className="w-4 h-4 text-[#1B4332] border-[#1B4332]/20 rounded focus:ring-[#1B4332]"
                      />
                      <Label htmlFor={`email_${type.key}`} className="cursor-pointer text-[#1B4332]">
                        {t.notificationSettings.emailNotifications}
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`inapp_${type.key}`}
                        checked={preferences[`inapp_${type.key}`]}
                        onChange={(e) => setPreferences(prev => ({
                          ...prev,
                          [`inapp_${type.key}`]: e.target.checked
                        }))}
                        className="w-4 h-4 text-[#1B4332] border-[#1B4332]/20 rounded focus:ring-[#1B4332]"
                      />
                      <Label htmlFor={`inapp_${type.key}`} className="cursor-pointer text-[#1B4332]">
                        {t.notificationSettings.inAppNotifications}
                      </Label>
                    </div>
                  </div>
                </div>
              ))}

              <div className="pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-[#1B4332] hover:bg-[#1B4332]/90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? t.notificationSettings.saving : t.notificationSettings.savePreferences}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}