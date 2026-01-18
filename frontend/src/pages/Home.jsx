import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { 
  ChevronRight, 
  Trophy, 
  Calendar, 
  Users, 
  Activity,
  Star,
  ArrowRight,
  Building2
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from '../components/translations';
import Logo from '../components/Logo';

export default function Home() {
  const t = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await base44.auth.isAuthenticated();
        setIsAuthenticated(authenticated);
        if (authenticated) {
          const userData = await base44.auth.me();
          setUser(userData);
        }
      } catch (error) {
        console.log('Not authenticated');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();

    // Set RTL for Home page specifically
    const savedLang = localStorage.getItem('language') || 'he';
    document.documentElement.dir = savedLang === 'he' ? 'rtl' : 'ltr';
    
    return () => {
      // Reset to LTR when leaving Home page
      document.documentElement.dir = 'ltr';
    };
  }, []);

  const handleLogin = () => {
    base44.auth.redirectToLogin(createPageUrl('Dashboard'));
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const features = [
    { icon: Trophy, ...t.features.items[0] },
    { icon: Calendar, ...t.features.items[1] },
    { icon: Users, ...t.features.items[2] },
    { icon: Activity, ...t.features.items[3] }
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF8]/80 backdrop-blur-lg border-b border-[#1B4332]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Logo />
          
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSelector />
            <a 
              href={createPageUrl('Stables')}
              className="text-xs sm:text-sm font-medium text-[#1B4332]/70 hover:text-[#1B4332] transition-colors"
            >
              {t.nav.stables}
            </a>
            <a 
              href={createPageUrl('ContactUs')}
              className="text-xs sm:text-sm font-medium text-[#1B4332]/70 hover:text-[#1B4332] transition-colors"
            >
              {t.nav.contact}
            </a>
            {isAuthenticated ? (
              <Button 
                onClick={() => window.location.href = createPageUrl('Dashboard')}
                size="sm"
                className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white rounded-full px-3 sm:px-6 text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{t.nav.dashboard}</span>
                <span className="sm:hidden">{t.nav.dashboardShort}</span>
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleLogin}
                size="sm"
                className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white rounded-full px-3 sm:px-6 text-xs sm:text-sm"
              >
                {t.nav.signIn}
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-[#1B4332]/10 rounded-full px-4 py-2 mb-6">
                <Star className="w-4 h-4 text-[#8B5A2B]" />
                <span className="text-sm font-medium text-[#1B4332]">
                  {t.hero.tagline}
                </span>
              </div>
              
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#1B4332] leading-[1.1] mb-4 sm:mb-6">
                {t.hero.title1}
                <br />
                <span className="text-[#8B5A2B]">{t.hero.title2}</span>
              </h1>

              <p className="text-base sm:text-lg text-[#1B4332]/70 mb-6 sm:mb-8 max-w-lg leading-relaxed">
                {t.hero.description}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button 
                  onClick={() => isAuthenticated ? window.location.href = createPageUrl('Dashboard') : handleLogin()}
                  size="lg"
                  className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white rounded-full px-6 sm:px-8 py-5 sm:py-6 text-sm sm:text-base"
                >
                  {t.hero.getStarted}
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>
                <Button 
                  variant="outline"
                  size="lg"
                  onClick={() => window.location.href = createPageUrl('RegisterStable')}
                  className="border-[#8B5A2B]/30 text-[#8B5A2B] hover:bg-[#8B5A2B]/5 rounded-full px-6 sm:px-8 py-5 sm:py-6 text-sm sm:text-base"
                >
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  {t.hero.registerStable}
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-[#1B4332]/10 to-[#8B5A2B]/10 p-8">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695a30cd5acccd6ba4aec705/3e2e755a0_jerttro.png"
                  alt="Brown horse with white mark"
                  className="w-full h-full object-cover rounded-2xl shadow-2xl"
                />
              </div>
              
              {/* Floating Stats Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="absolute -left-4 bottom-12 bg-white rounded-2xl shadow-xl p-5 border border-[#1B4332]/10"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-[#1B4332]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#1B4332]">{t.hero.healthTitle}</p>
                    <p className="text-sm text-[#1B4332]/60">{t.hero.healthDesc}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-[#1B4332]/[0.02]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1B4332] mb-3 sm:mb-4">
              {t.features.title}
            </h2>
            <p className="text-sm sm:text-base text-[#1B4332]/60 max-w-2xl mx-auto">
              {t.features.subtitle}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="bg-white border-[#1B4332]/10 hover:border-[#1B4332]/20 transition-all duration-300 hover:shadow-lg group h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#1B4332] transition-colors duration-300">
                      <feature.icon className="w-6 h-6 text-[#1B4332] group-hover:text-white transition-colors duration-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#1B4332] mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-[#1B4332]/60 leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-[#1B4332] rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#8B5A2B] rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
                {t.cta.title}
              </h2>
              <p className="text-sm sm:text-base text-white/70 mb-6 sm:mb-8 max-w-lg mx-auto">
                {t.cta.description}
              </p>
              <Button 
                onClick={handleLogin}
                size="lg"
                className="bg-white text-[#1B4332] hover:bg-white/90 rounded-full px-6 sm:px-8 py-5 sm:py-6 text-sm sm:text-base font-semibold"
              >
                {t.cta.button}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-4 sm:px-6 border-t border-[#1B4332]/10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs sm:text-sm text-[#1B4332]/60">
            {t.footer.copyright}
          </span>
          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-[#1B4332]/60">
            <a href="#" className="hover:text-[#1B4332] transition-colors">{t.footer.privacy}</a>
            <a href="#" className="hover:text-[#1B4332] transition-colors">{t.footer.terms}</a>
            <a href="#" className="hover:text-[#1B4332] transition-colors">{t.footer.contact}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}