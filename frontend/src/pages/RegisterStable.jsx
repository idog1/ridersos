import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from 'framer-motion';
import { Building2, Home, ChevronRight, CheckCircle2, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import LanguageSelector from '../components/LanguageSelector';
import Logo from '../components/Logo';
import { useTranslation } from '../components/translations';

export default function RegisterStable() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    latitude: null,
    longitude: null,
    phone: '',
    email: '',
    description: ''
  });
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        setFormData(prev => ({ ...prev, email: userData.email }));
      } catch (error) {
        base44.auth.redirectToLogin(createPageUrl('RegisterStable'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleGetLocation = () => {
    setGettingLocation(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please enter coordinates manually or skip.');
        setGettingLocation(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await base44.entities.Stable.create({
        ...formData,
        manager_email: user.email,
        approval_status: 'pending'
      });

      // Add StableManager role if not already present
      if (!user.roles?.includes('StableManager')) {
        await base44.auth.updateMe({
          roles: [...(user.roles || []), 'StableManager']
        });
      }

      setSuccess(true);
      setTimeout(() => {
        navigate(createPageUrl('Dashboard'));
      }, 2000);
    } catch (error) {
      console.error('Failed to register stable:', error);
      alert('Failed to register stable. Please try again.');
    } finally {
      setSubmitting(false);
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

  if (success) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#1B4332] mb-2">
            {t.registerStable.registrationSubmitted}
          </h2>
          <p className="text-[#1B4332]/60">
            {t.registerStable.pendingApproval}
          </p>
        </motion.div>
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

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{t.registerStable.breadcrumb}</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1B4332] mb-2">
              {t.registerStable.title}
            </h1>
            <p className="text-[#1B4332]/60">
              {t.registerStable.subtitle}
            </p>
          </div>

          <Card className="bg-white border-[#1B4332]/10 shadow-sm">
            <CardHeader className="border-b border-[#1B4332]/10">
              <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#1B4332]" />
                </div>
                {t.registerStable.stableInfo}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[#1B4332] font-medium">
                    {t.registerStable.stableName} *
                  </Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="border-[#1B4332]/20 focus:border-[#1B4332]"
                    placeholder={t.registerStable.enterStableName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-[#1B4332] font-medium">
                    {t.registerStable.description}
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="border-[#1B4332]/20 focus:border-[#1B4332] h-24"
                    placeholder={t.registerStable.tellUs}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-[#1B4332] font-medium">
                    {t.registerStable.address}
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="border-[#1B4332]/20 focus:border-[#1B4332]"
                    placeholder={t.registerStable.streetAddress}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-[#1B4332] font-medium">
                      {t.registerStable.city}
                    </Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      className="border-[#1B4332]/20 focus:border-[#1B4332]"
                      placeholder={t.registerStable.city}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-[#1B4332] font-medium">
                      {t.registerStable.state}
                    </Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                      className="border-[#1B4332]/20 focus:border-[#1B4332]"
                      placeholder={t.registerStable.state}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-[#1B4332] font-medium">
                      {t.registerStable.country}
                    </Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                      className="border-[#1B4332]/20 focus:border-[#1B4332]"
                      placeholder={t.registerStable.country}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[#1B4332] font-medium">
                      {t.registerStable.phoneNumber}
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="border-[#1B4332]/20 focus:border-[#1B4332]"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[#1B4332] font-medium">
                      {t.registerStable.contactEmail}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="border-[#1B4332]/20 focus:border-[#1B4332]"
                      placeholder="stable@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[#1B4332] font-medium">
                    {t.registerStable.locationCoords}
                  </Label>
                  <p className="text-xs text-[#1B4332]/60 mb-2">
                    {t.registerStable.helpUsers}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGetLocation}
                      disabled={gettingLocation}
                      className="border-[#1B4332]/20 text-[#1B4332]"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {gettingLocation ? t.registerStable.gettingLocation : t.registerStable.useMyLocation}
                    </Button>
                    {formData.latitude && formData.longitude && (
                      <span className="text-sm text-green-600 flex items-center gap-1 px-3 py-2 bg-green-50 rounded-lg">
                        <MapPin className="w-4 h-4" />
                        {t.registerStable.locationSet}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Input
                      type="number"
                      step="any"
                      value={formData.latitude || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="border-[#1B4332]/20 focus:border-[#1B4332]"
                      placeholder={t.registerStable.latitude}
                    />
                    <Input
                      type="number"
                      step="any"
                      value={formData.longitude || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="border-[#1B4332]/20 focus:border-[#1B4332]"
                      placeholder={t.registerStable.longitude}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(createPageUrl('Dashboard'))}
                    className="border-[#1B4332]/20 text-[#1B4332]"
                  >
                    {t.registerStable.cancel}
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                  >
                    {submitting ? t.registerStable.submitting : t.registerStable.submitForApproval}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}