import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Building2,
  ChevronRight,
  Home,
  ArrowLeft,
  User,
  Calendar
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import Logo from '../components/Logo';

export default function StableDetails() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stable, setStable] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        console.log('Not authenticated');
      }

      // Get stable ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const stableId = urlParams.get('id');

      if (!stableId) {
        navigate(createPageUrl('Stables'));
        return;
      }

      try {
        const stableData = await base44.entities.Stable.get(stableId);
        if (stableData) {
          setStable(stableData);

          // Load trainers if available
          if (stableData.trainer_emails && stableData.trainer_emails.length > 0) {
            const users = await base44.entities.User.list();
            const stableTrainers = users.filter(u => 
              stableData.trainer_emails.includes(u.email)
            );
            setTrainers(stableTrainers);
          }

          // Load upcoming events
          const allEvents = await base44.entities.StableEvent.list(stableId);
          const now = new Date();
          const upcomingEvents = allEvents
            .filter(event => new Date(event.event_date) > now)
            .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
          setEvents(upcomingEvents);
        } else {
          navigate(createPageUrl('Stables'));
        }
      } catch (error) {
        console.error('Failed to load stable:', error);
        navigate(createPageUrl('Stables'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [navigate]);

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

  if (!stable) {
    return null;
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
            {user && (
              <Button 
                onClick={() => navigate(createPageUrl('Dashboard'))}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
              >
                Dashboard
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-6">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link to={createPageUrl('Stables')} className="hover:text-[#1B4332]">
            Stables
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{stable.name}</span>
        </div>

        <Button
          variant="outline"
          onClick={() => navigate(createPageUrl('Stables'))}
          className="mb-6 border-[#1B4332]/20 text-[#1B4332]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Stables
        </Button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start gap-4 mb-8">
            <div className="w-16 h-16 bg-[#1B4332]/10 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-8 h-8 text-[#1B4332]" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-[#1B4332] mb-2">
                {stable.name}
              </h1>
              {stable.description && (
                <p className="text-lg text-[#1B4332]/60">
                  {stable.description}
                </p>
              )}
            </div>
          </div>

          {/* Images */}
          <Card className="bg-white border-[#1B4332]/10 mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-[#1B4332] mb-4">Gallery</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, index) => {
                  const image = stable.images?.[index];
                  return image ? (
                    <div key={index} className="aspect-square rounded-lg overflow-hidden bg-[#1B4332]/5">
                      <img 
                        src={image} 
                        alt={`${stable.name} - Image ${index + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div 
                      key={index} 
                      className="aspect-square rounded-lg bg-[#1B4332]/5 flex items-center justify-center"
                    >
                      <Building2 className="w-8 h-8 text-[#1B4332]/20" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="bg-white border-[#1B4332]/10 mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-[#1B4332] mb-4">Contact Information</h2>
              <div className="space-y-4">
                {stable.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[#8B5A2B] mt-0.5 flex-shrink-0" />
                    <div className="text-[#1B4332]">
                      <p>{stable.address}</p>
                      {(stable.city || stable.state || stable.country) && (
                        <p className="text-[#1B4332]/60">
                          {[stable.city, stable.state, stable.country].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {stable.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-[#8B5A2B] flex-shrink-0" />
                    <a 
                      href={`tel:${stable.phone}`}
                      className="text-[#1B4332] hover:text-[#8B5A2B] transition-colors"
                    >
                      {stable.phone}
                    </a>
                  </div>
                )}
                {stable.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-[#8B5A2B] flex-shrink-0" />
                    <a 
                      href={`mailto:${stable.email}`}
                      className="text-[#1B4332] hover:text-[#8B5A2B] transition-colors"
                    >
                      {stable.email}
                    </a>
                  </div>
                )}
              </div>

              {/* Navigation */}
              {(stable.latitude && stable.longitude) && (
                <div className="mt-6 pt-6 border-t border-[#1B4332]/10">
                  <p className="text-sm text-[#1B4332]/60 mb-3">Navigate with:</p>
                  <div className="flex gap-4 justify-start">
                    <div className="flex flex-col items-center gap-1">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${stable.latitude},${stable.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-all hover:shadow-md"
                        title="Open in Google Maps"
                      >
                        <img 
                          src="https://cdn.worldvectorlogo.com/logos/google-maps-2020-icon.svg" 
                          alt="Google Maps"
                          className="w-6 h-6"
                        />
                      </a>
                      <span className="text-xs text-[#1B4332]/60">Google Maps</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <a
                        href={`https://maps.apple.com/?q=${stable.latitude},${stable.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-all hover:shadow-md"
                        title="Open in Apple Maps"
                      >
                        <svg className="w-6 h-6" viewBox="0 0 64 64" fill="none">
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
                      <span className="text-xs text-[#1B4332]/60">Apple Maps</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 ml-2">
                      <a
                        href={`https://waze.com/ul?ll=${stable.latitude},${stable.longitude}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 bg-[#33CCFF] hover:bg-[#2AB8E6] rounded-lg transition-all hover:shadow-md"
                        title="Open in Waze"
                      >
                        <svg className="w-7 h-7" viewBox="0 0 100 100" fill="none">
                          <path d="M50 10C32 10 20 22 20 35C20 38 20.5 41 21.5 43.5C22 45 23 46.5 24.5 48C25 48.5 25.5 49 26 49.5L50 90L74 49.5C74.5 49 75 48.5 75.5 48C77 46.5 78 45 78.5 43.5C79.5 41 80 38 80 35C80 22 68 10 50 10Z" fill="white"/>
                          <circle cx="42" cy="32" r="4" fill="black"/>
                          <circle cx="58" cy="32" r="4" fill="black"/>
                          <path d="M38 44C38 44 42 50 50 50C58 50 62 44 62 44" stroke="black" strokeWidth="3" strokeLinecap="round"/>
                          <ellipse cx="50" cy="70" rx="10" ry="4" fill="black"/>
                          <ellipse cx="40" cy="72" rx="5" ry="3" fill="black"/>
                          <ellipse cx="60" cy="72" rx="5" ry="3" fill="black"/>
                        </svg>
                      </a>
                      <span className="text-xs text-[#1B4332]/60">Waze</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trainers */}
          <Card className="bg-white border-[#1B4332]/10 mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-[#1B4332] mb-4">Trainers</h2>
              {trainers.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {trainers.map((trainer) => (
                    <div 
                      key={trainer.id}
                      className="flex flex-col items-center gap-2 p-4 bg-[#1B4332]/5 rounded-lg hover:bg-[#1B4332]/10 transition-colors"
                    >
                      <div className="w-12 h-12 bg-[#1B4332] rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-sm font-medium text-[#1B4332] text-center">
                        {trainer.first_name && trainer.last_name
                          ? `${trainer.first_name} ${trainer.last_name}`
                          : trainer.full_name || trainer.first_name || 'Trainer'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#1B4332]/60 text-center py-8">
                  No trainers connected to this stable yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card className="bg-white border-[#1B4332]/10">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-[#1B4332] mb-4">Upcoming Events</h2>
              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div 
                      key={event.id}
                      className="flex items-start gap-4 p-4 bg-[#1B4332]/5 rounded-lg hover:bg-[#1B4332]/10 transition-colors"
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
                          {event.location && <span>📍 {event.location}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#1B4332]/60 text-center py-8">
                  No upcoming events scheduled
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}