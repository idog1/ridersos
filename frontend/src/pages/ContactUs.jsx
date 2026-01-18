import React, { useState, useEffect } from 'react';
import { useTranslation } from '../components/translations';
import LanguageSelector from '../components/LanguageSelector';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from 'framer-motion';
import { Home, ChevronRight, Mail, Send } from 'lucide-react';
import Logo from '../components/Logo';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ContactUs() {
  const t = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        // User not logged in, that's ok for contact form
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.type || !formData.subject || !formData.message) {
      alert('Please fill in all fields');
      return;
    }

    setSending(true);
    try {
      const senderName = user?.first_name && user?.last_name 
        ? `${user.first_name} ${user.last_name}` 
        : user?.full_name || 'Guest User';
      const senderEmail = user?.email || 'anonymous';

      // Save contact message to database
      await base44.entities.ContactMessage.create({
        type: formData.type,
        subject: formData.subject,
        message: formData.message,
        sender_email: senderEmail,
        sender_name: senderName,
        status: 'new'
      });

      // Notify all admin users
      const allUsers = await base44.entities.User.list();
      const adminUsers = allUsers.filter(u => u.role === 'admin');
      
      const emailSubject = `New Contact: ${formData.type} - ${formData.subject}`;
      const emailBody = `You have received a new contact message:\n\nType: ${formData.type}\nSubject: ${formData.subject}\n\nMessage:\n${formData.message}\n\n---\nFrom: ${senderName} (${senderEmail})`;

      // Send notification to all admins
      await Promise.all(
        adminUsers.map(admin => 
          base44.integrations.Core.SendEmail({
            from_name: 'RaidersOS Contact Form',
            to: admin.email,
            subject: emailSubject,
            body: emailBody
          })
        )
      );

      alert('Message sent successfully! We will get back to you soon.');
      setFormData({ type: '', subject: '', message: '' });
    } catch (error) {
      console.error('Failed to send message:', error);
      alert(`Failed to send message: ${error.message || 'Please try again.'}`);
    } finally {
      setSending(false);
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
            <Link 
              to={createPageUrl('Home')}
              className="flex items-center gap-2 text-sm text-[#1B4332]/60 hover:text-[#1B4332] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{t.nav.home}</span>
            </Link>
            {user && (
              <Link 
                to={createPageUrl('Dashboard')}
                className="flex items-center gap-2 text-sm text-[#1B4332]/60 hover:text-[#1B4332] transition-colors"
              >
                {t.nav.dashboard}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Home')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{t.contact.breadcrumb}</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1B4332] mb-2">{t.contact.title}</h1>
            <p className="text-[#1B4332]/60">{t.contact.subtitle}</p>
          </div>

          <Card className="bg-white border-[#1B4332]/10 shadow-sm">
            <CardHeader className="border-b border-[#1B4332]/10">
              <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#1B4332]" />
                </div>
                Send us a message
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-[#1B4332] font-medium">
                    {t.contact.messageType} *
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="border-[#1B4332]/20">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">{t.contact.general}</SelectItem>
                      <SelectItem value="Bug Report">{t.contact.bugReport}</SelectItem>
                      <SelectItem value="Feature Suggestion">{t.contact.featureSuggestion}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === 'Feature Suggestion' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <p className="text-sm text-amber-900 font-medium mb-2">{t.contact.featureSuggestionDisclaimer}</p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {t.contact.featureSuggestionDisclaimerText}
                      <br />{t.contact.disclaimerPoint1}
                      <br />{t.contact.disclaimerPoint2}
                      <br />{t.contact.disclaimerPoint3}
                      <br />{t.contact.disclaimerPoint4}
                    </p>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-[#1B4332] font-medium">
                    {t.contact.subject} *
                  </Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="border-[#1B4332]/20"
                    placeholder={t.contact.yourSubject}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-[#1B4332] font-medium">
                    {t.contact.message} *
                  </Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    className="border-[#1B4332]/20 min-h-[200px]"
                    placeholder={t.contact.yourMessage}
                  />
                </div>

                {user && (
                  <div className="p-4 bg-[#1B4332]/5 rounded-lg">
                    <p className="text-sm text-[#1B4332]/70">
                      {t.contact.name} <span className="font-medium text-[#1B4332]">
                        {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.full_name}
                      </span>
                    </p>
                    <p className="text-sm text-[#1B4332]/70">
                      {t.contact.email} <span className="font-medium text-[#1B4332]">{user.email}</span>
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-[#1B4332] hover:bg-[#1B4332]/90"
                >
                  {sending ? (
                    t.contact.sending
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {t.contact.sendMessage}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}