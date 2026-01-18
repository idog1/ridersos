import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Building2,
  ChevronRight,
  Home,
  Navigation
} from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from '../components/translations';
import Logo from '../components/Logo';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Stables() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        console.log('Not authenticated');
      }
    };
    loadUser();
  }, []);

  const { data: stables, isLoading } = useQuery({
    queryKey: ['stables'],
    queryFn: () => base44.entities.Stable.filter({ approval_status: 'approved' }),
    initialData: []
  });

  const handleGetLocation = () => {
    setGettingLocation(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please enable location permissions.');
        setGettingLocation(false);
      }
    );
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  // Get unique countries
  const countries = ['all', ...new Set(stables.filter(s => s.country).map(s => s.country))];

  // Filter and sort stables
  const filteredStables = stables
    .filter(stable => selectedCountry === 'all' || stable.country === selectedCountry)
    .map(stable => {
      if (userLocation && stable.latitude && stable.longitude) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          stable.latitude,
          stable.longitude
        );
        return { ...stable, distance };
      }
      return stable;
    })
    .sort((a, b) => {
      if (userLocation && a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return 0;
    });

  if (isLoading) {
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
            <LanguageSelector />
            <Link 
              to={createPageUrl('Home')}
              className="flex items-center gap-2 text-sm text-[#1B4332]/60 hover:text-[#1B4332] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{t.nav.home}</span>
            </Link>
            {user && (
              <Button 
                onClick={() => navigate(createPageUrl('Dashboard'))}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
              >
                {t.nav.dashboard}
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#1B4332]/60 mb-3 sm:mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-3 h-3 sm:w-4 sm:h-4" />
          </Link>
          <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
          <span>{t.stablesDirectory.breadcrumb}</span>
        </div>

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1B4332] mb-2 sm:mb-3">
            {t.stablesDirectory.title}
          </h1>
          <p className="text-[#1B4332]/60 text-sm sm:text-base md:text-lg">
            {t.stablesDirectory.subtitle}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex-1">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="border-[#1B4332]/20">
                <SelectValue placeholder={t.stablesDirectory.filterByCountry} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.stablesDirectory.allCountries}</SelectItem>
                {countries.filter(c => c !== 'all').map(country => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={handleGetLocation}
            disabled={gettingLocation}
            size="sm"
            className="border-[#1B4332]/20 text-[#1B4332] hover:bg-[#1B4332]/5 text-xs sm:text-sm"
          >
            <Navigation className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            {gettingLocation ? t.stablesDirectory.getting : userLocation ? t.stablesDirectory.locationSet : t.stablesDirectory.showNearby}
          </Button>
        </div>

        {/* Stables Grid */}
        {filteredStables.length === 0 ? (
          <Card className="bg-white border-[#1B4332]/10">
            <CardContent className="p-12 text-center">
              <Building2 className="w-16 h-16 text-[#1B4332]/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[#1B4332] mb-2">
                {t.stablesDirectory.noStablesYet}
              </h3>
              <p className="text-[#1B4332]/60">
                {t.stablesDirectory.checkBackSoon}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredStables.map((stable, index) => (
              <motion.div
                key={stable.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="bg-white border-[#1B4332]/10 hover:border-[#1B4332]/30 hover:shadow-lg transition-all duration-300 h-full">
                  <CardHeader className="border-b border-[#1B4332]/10 p-4 sm:p-6">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1B4332]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#1B4332]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <CardTitle 
                            className="text-base sm:text-lg md:text-xl text-[#1B4332] cursor-pointer hover:text-[#8B5A2B] transition-colors line-clamp-2"
                            onClick={() => navigate(createPageUrl('StableDetails') + '?id=' + stable.id)}
                          >
                            {stable.name}
                          </CardTitle>
                          {stable.distance !== undefined && (
                            <span className="text-xs font-semibold text-[#8B5A2B] bg-[#8B5A2B]/10 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                              {stable.distance < 1 
                                ? `${(stable.distance * 1000).toFixed(0)}${t.stablesDirectory.meters}`
                                : `${stable.distance.toFixed(1)}${t.stablesDirectory.km}`}
                            </span>
                          )}
                        </div>
                        {stable.description && (
                          <p className="text-xs sm:text-sm text-[#1B4332]/60 line-clamp-2">
                            {stable.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-2 sm:space-y-3">
                    {stable.address && (
                      <div className="flex items-start gap-2 sm:gap-3">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-[#8B5A2B] mt-0.5 flex-shrink-0" />
                        <div className="text-xs sm:text-sm text-[#1B4332] flex-1">
                          <p>{stable.address}</p>
                          {(stable.city || stable.state) && (
                            <p className="text-[#1B4332]/60">
                              {[stable.city, stable.state, stable.country].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {stable.phone && (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-[#8B5A2B] flex-shrink-0" />
                        <a 
                          href={`tel:${stable.phone}`}
                          className="text-xs sm:text-sm text-[#1B4332] hover:text-[#8B5A2B] transition-colors"
                        >
                          {stable.phone}
                        </a>
                      </div>
                    )}
                    {stable.email && (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-[#8B5A2B] flex-shrink-0" />
                        <a 
                          href={`mailto:${stable.email}`}
                          className="text-xs sm:text-sm text-[#1B4332] hover:text-[#8B5A2B] transition-colors truncate"
                        >
                          {stable.email}
                        </a>
                      </div>
                    )}

                    {/* Navigation Links */}
                    {(stable.latitude && stable.longitude) && (
                      <div className="pt-2 sm:pt-3 border-t border-[#1B4332]/10">
                        <p className="text-xs text-[#1B4332]/60 mb-2">{t.stablesDirectory.navigateWith}</p>
                        <div className="flex gap-3 sm:gap-4 justify-start">
                          <div className="flex flex-col items-center gap-1">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${stable.latitude},${stable.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-all hover:shadow-md"
                              title="Open in Google Maps"
                            >
                              <img 
                                src="https://cdn.worldvectorlogo.com/logos/google-maps-2020-icon.svg" 
                                alt="Google Maps"
                                className="w-5 h-5 sm:w-6 sm:h-6"
                              />
                            </a>
                            <span className="text-[10px] sm:text-xs text-[#1B4332]/60">{t.stablesDirectory.google}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <a
                              href={`https://maps.apple.com/?q=${stable.latitude},${stable.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-all hover:shadow-md"
                              title="Open in Apple Maps"
                            >
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 64 64" fill="none">
                                <rect width="64" height="64" rx="14" fill="white"/>
                                <path d="M8 16 L20 8 L20 32 L12 40 Z" fill="#34C759"/>
                                <path d="M20 8 L32 4 L32 32 L20 32 Z" fill="#007AFF"/>
                                <path d="M32 4 L52 12 L48 32 L32 32 Z" fill="#34C759"/>
                                <path d="M12 40 L20 32 L32 32 L32 56 L16 52 Z" fill="#FF2D55"/>
                                <path d="M32 32 L48 32 L52 52 L32 56 Z" fill="#FFCC00"/>
                                <circle cx="32" cy="32" r="14" fill="#007AFF"/>
                                <path d="M32 22 L28 34 L32 44 L36 34 Z" fill="white"/>
                              </svg>
                            </a>
                            <span className="text-[10px] sm:text-xs text-[#1B4332]/60">{t.stablesDirectory.apple}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <a
                              href={`https://waze.com/ul?ll=${stable.latitude},${stable.longitude}&navigate=yes`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-[#33CCFF] hover:bg-[#2AB8E6] rounded-lg transition-all hover:shadow-md"
                              title="Open in Waze"
                            >
                              <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 100 100" fill="none">
                                <path d="M50 10C32 10 20 22 20 35C20 38 20.5 41 21.5 43.5C22 45 23 46.5 24.5 48C25 48.5 25.5 49 26 49.5L50 90L74 49.5C74.5 49 75 48.5 75.5 48C77 46.5 78 45 78.5 43.5C79.5 41 80 38 80 35C80 22 68 10 50 10Z" fill="white"/>
                                <circle cx="42" cy="32" r="4" fill="black"/>
                                <circle cx="58" cy="32" r="4" fill="black"/>
                                <path d="M38 44C38 44 42 50 50 50C58 50 62 44 62 44" stroke="black" strokeWidth="3" strokeLinecap="round"/>
                                <ellipse cx="50" cy="70" rx="10" ry="4" fill="black"/>
                                <ellipse cx="40" cy="72" rx="5" ry="3" fill="black"/>
                                <ellipse cx="60" cy="72" rx="5" ry="3" fill="black"/>
                              </svg>
                            </a>
                            <span className="text-[10px] sm:text-xs text-[#1B4332]/60">{t.stablesDirectory.waze}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}