import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { motion } from 'framer-motion';
import { DollarSign, Home, ChevronRight, Save, Calendar as CalendarIcon, Trophy, ChevronLeft } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LanguageSelector from '../components/LanguageSelector';
import Logo from '../components/Logo';
import { useTranslation } from '../components/translations';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';

const SESSION_TYPES = ["Lesson", "Training", "Horse Training", "Horse Transport", "Competition Prep", "Evaluation", "Other"];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "ILS"];

export default function Billing() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const queryClient = useQueryClient();

  // Calculate date range based on selected month
  const dateRange = showCustomRange ? customDateRange : {
    from: startOfMonth(selectedMonth),
    to: endOfMonth(selectedMonth)
  };

  const isCurrentMonth = !showCustomRange &&
    selectedMonth.getMonth() === new Date().getMonth() &&
    selectedMonth.getFullYear() === new Date().getFullYear();

  const goToPreviousMonth = () => {
    setShowCustomRange(false);
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setShowCustomRange(false);
    const nextMonth = subMonths(selectedMonth, -1);
    // Don't go beyond current month
    if (nextMonth <= new Date()) {
      setSelectedMonth(nextMonth);
    }
  };

  const goToCurrentMonth = () => {
    setShowCustomRange(false);
    setSelectedMonth(new Date());
  };

  // Generate monthly summaries on mount
  useEffect(() => {
    if (!user?.email) return;
    
    const generateMonthlySummaries = async () => {
      const now = new Date();
      const lastMonth = subMonths(now, 1);
      const lastMonthStart = startOfMonth(lastMonth);
      const lastMonthEnd = endOfMonth(lastMonth);
      
      // Check if we're in a new month and need to generate last month's summary
      if (now.getDate() <= 5) { // Generate in first 5 days of new month
        const monthKey = format(lastMonth, 'yyyy-MM');
        
        // Check if summary already exists
        const existingSummaries = await base44.entities.MonthlyBillingSummary.filter({
          trainer_email: user.email,
          month: monthKey
        });
        
        if (existingSummaries.length === 0) {
          // Generate summaries for last month
          const lastMonthSessions = await base44.entities.TrainingSession.filter({
            trainer_email: user.email
          });
          
          const relevantSessions = lastMonthSessions.filter(s => {
            const sDate = new Date(s.session_date);
            return sDate >= lastMonthStart && sDate <= lastMonthEnd && s.rider_verified;
          });
          
          const lastMonthComps = await base44.entities.Competition.filter({
            trainer_email: user.email
          });
          
          const relevantComps = lastMonthComps.filter(c => {
            const cDate = new Date(c.competition_date);
            return cDate >= lastMonthStart && cDate <= lastMonthEnd;
          });
          
          // Group by rider
          const riderSummaries = {};
          
          relevantSessions.forEach(session => {
            const riderEmail = session.rider_email;
            if (!riderSummaries[riderEmail]) {
              riderSummaries[riderEmail] = {
                sessions_revenue: 0,
                competitions_revenue: 0,
                session_count: 0
              };
            }
            
            const rate = rates[session.session_type];
            if (rate?.rate) {
              riderSummaries[riderEmail].sessions_revenue += parseFloat(rate.rate);
              riderSummaries[riderEmail].session_count++;
            }
          });
          
          relevantComps.forEach(comp => {
            comp.riders?.forEach(rider => {
              if (rider.payment_status === 'paid') {
                const riderEmail = rider.rider_email;
                if (!riderSummaries[riderEmail]) {
                  riderSummaries[riderEmail] = {
                    sessions_revenue: 0,
                    competitions_revenue: 0,
                    session_count: 0
                  };
                }
                
                rider.services?.forEach(service => {
                  const rate = rates[service];
                  if (rate?.rate) {
                    riderSummaries[riderEmail].competitions_revenue += parseFloat(rate.rate);
                  }
                });
              }
            });
          });
          
          // Create summaries and payment requests
          const allUsers = await base44.entities.User.list();
          
          for (const [riderEmail, summary] of Object.entries(riderSummaries)) {
            const total = summary.sessions_revenue + summary.competitions_revenue;
            if (total > 0) {
              await base44.entities.MonthlyBillingSummary.create({
                trainer_email: user.email,
                rider_email: riderEmail,
                month: monthKey,
                sessions_revenue: summary.sessions_revenue,
                competitions_revenue: summary.competitions_revenue,
                total_revenue: total,
                currency: getCurrency(),
                session_count: summary.session_count,
                payment_requested: true,
                payment_status: 'pending'
              });
              
              // Send payment request notification
              const rider = allUsers.find(u => u.email === riderEmail);
              const trainerName = user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`
                : user.full_name || user.email;
              
              // If rider is minor, send to guardian
              let notificationEmail = riderEmail;
              if (rider?.birthday) {
                const birthDate = new Date(rider.birthday);
                const age = now.getFullYear() - birthDate.getFullYear();
                if (age < 18 && rider.parent_email) {
                  notificationEmail = rider.parent_email;
                }
              }
              
              await base44.entities.Notification.create({
                user_email: notificationEmail,
                type: 'payment_request',
                title: `Payment Request from ${trainerName}`,
                message: `Monthly payment for ${format(lastMonth, 'MMMM yyyy')}: ${getCurrency()} ${total.toFixed(2)} (${summary.session_count} sessions)`,
                related_entity_type: 'MonthlyBillingSummary',
                related_entity_id: monthKey
              });
            }
          }
        }
      }
    };
    
    generateMonthlySummaries();
  }, [user, rates]);

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

        // Load existing rates
        const existingRates = await base44.entities.BillingRate.filter({ 
          trainer_email: userData.email 
        });
        
        const ratesMap = {};
        existingRates.forEach(rate => {
          ratesMap[rate.session_type] = {
            id: rate.id,
            rate: rate.rate,
            currency: rate.currency
          };
        });
        setRates(ratesMap);
      } catch (error) {
        base44.auth.redirectToLogin(createPageUrl('Billing'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const saveRateMutation = useMutation({
    mutationFn: async () => {
      const promises = [];

      for (const [sessionType, rateData] of Object.entries(rates)) {
        if (rateData?.rate && rateData.rate > 0) {
          if (rateData.id) {
            // Update existing
            promises.push(
              base44.entities.BillingRate.update(rateData.id, {
                rate: parseFloat(rateData.rate),
                currency: rateData.currency || 'ILS'
              })
            );
          } else {
            // Create new
            promises.push(
              base44.entities.BillingRate.create({
                trainer_email: user.email,
                session_type: sessionType,
                rate: parseFloat(rateData.rate),
                currency: rateData.currency || 'ILS'
              })
            );
          }
        }
      }

      return Promise.all(promises);
    },
    onSuccess: async () => {
      // Reload rates
      const existingRates = await base44.entities.BillingRate.filter({ 
        trainer_email: user.email 
      });
      const ratesMap = {};
      existingRates.forEach(rate => {
        ratesMap[rate.session_type] = {
          id: rate.id,
          rate: rate.rate,
          currency: rate.currency
        };
      });
      setRates(ratesMap);
      queryClient.invalidateQueries({ queryKey: ['billing-rates'] });
    }
  });

  const handleSaveAllRates = async () => {
    await saveRateMutation.mutateAsync();
  };

  const handleRateChange = (sessionType, field, value) => {
    setRates(prev => ({
      ...prev,
      [sessionType]: {
        ...prev[sessionType],
        [field]: value
      }
    }));
  };

  const { data: sessions } = useQuery({
    queryKey: ['trainer-sessions', user?.email, dateRange],
    queryFn: async () => {
      if (!user?.email) return [];
      const allSessions = await base44.entities.TrainingSession.filter({
        trainer_email: user.email
      });
      // Filter by date range
      return allSessions.filter(session => {
        const sessionDate = new Date(session.session_date);
        return sessionDate >= dateRange.from && sessionDate <= dateRange.to;
      });
    },
    enabled: !!user?.email,
    initialData: []
  });

  const { data: competitions = [] } = useQuery({
    queryKey: ['trainer-competitions', user?.email, dateRange],
    queryFn: async () => {
      if (!user?.email) return [];
      const allComps = await base44.entities.Competition.filter({
        trainer_email: user.email
      });
      return allComps.filter(comp => {
        const compDate = new Date(comp.competition_date);
        return compDate >= dateRange.from && compDate <= dateRange.to;
      });
    },
    enabled: !!user?.email,
    initialData: []
  });

  const { data: monthlySummaries = [] } = useQuery({
    queryKey: ['monthly-summaries', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.MonthlyBillingSummary.filter({
        trainer_email: user.email
      }, '-month');
    },
    enabled: !!user?.email,
    initialData: []
  });

  const calculateSessionRevenue = () => {
    let total = 0;
    
    sessions?.forEach(session => {
      if (session.rider_verified) {
        const rate = rates[session.session_type];
        if (rate?.rate) {
          total += parseFloat(rate.rate);
        }
      }
    });

    return total;
  };

  const calculateCompetitionRevenue = () => {
    let total = 0;
    
    competitions?.forEach(comp => {
      comp.riders?.forEach(rider => {
        if (rider.payment_status === 'paid') {
          rider.services?.forEach(service => {
            const rate = rates[service];
            if (rate?.rate) {
              total += parseFloat(rate.rate);
            }
          });
        }
      });
    });

    return total;
  };

  const calculateRevenue = () => {
    return calculateSessionRevenue() + calculateCompetitionRevenue();
  };

  const getCurrency = () => {
    // Get currency from first available rate
    const firstRate = Object.values(rates).find(r => r?.currency);
    return firstRate?.currency || 'ILS';
  };

  const getRiderBreakdown = () => {
    const riderMap = {};

    // Regular sessions
    sessions?.forEach(session => {
      if (!session.rider_verified) return;

      const riderName = session.rider_name || session.rider_email;
      const rate = rates[session.session_type];

      if (!riderMap[riderName]) {
        riderMap[riderName] = {
          name: riderName,
          sessions: {},
          competitions: [],
          total: 0
        };
      }

      if (!riderMap[riderName].sessions[session.session_type]) {
        riderMap[riderName].sessions[session.session_type] = {
          count: 0,
          revenue: 0
        };
      }

      riderMap[riderName].sessions[session.session_type].count++;

      if (rate?.rate) {
        const sessionRevenue = parseFloat(rate.rate);
        riderMap[riderName].sessions[session.session_type].revenue += sessionRevenue;
        riderMap[riderName].total += sessionRevenue;
      }
    });

    // Competitions
    competitions?.forEach(comp => {
      comp.riders?.forEach(rider => {
        if (rider.payment_status !== 'paid') return;

        const riderName = rider.rider_name || rider.rider_email;
        
        if (!riderMap[riderName]) {
          riderMap[riderName] = {
            name: riderName,
            sessions: {},
            competitions: [],
            total: 0
          };
        }

        let compTotal = 0;
        const compServices = {};

        rider.services?.forEach(service => {
          const rate = rates[service];
          if (rate?.rate) {
            const serviceRevenue = parseFloat(rate.rate);
            compTotal += serviceRevenue;
            riderMap[riderName].total += serviceRevenue;
            
            if (!compServices[service]) {
              compServices[service] = 0;
            }
            compServices[service] += serviceRevenue;
          }
        });

        if (compTotal > 0) {
          riderMap[riderName].competitions.push({
            name: comp.name,
            date: comp.competition_date,
            services: compServices,
            total: compTotal
          });
        }
      });
    });

    return Object.values(riderMap).sort((a, b) => b.total - a.total);
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-[#1B4332]/60 mb-4">
          <Link to={createPageUrl('Dashboard')} className="hover:text-[#1B4332] transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>{t.billing.title}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1B4332] mb-2">{t.billing.title}</h1>
          <p className="text-[#1B4332]/60">{t.quickActions.manageRatesRevenue}</p>
        </div>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="account">{t.billing.account}</TabsTrigger>
            <TabsTrigger value="rates">{t.billing.sessionRates}</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card className="bg-white border-[#1B4332]/10 shadow-sm">
              <CardHeader className="border-b border-[#1B4332]/10">
                <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-[#1B4332]" />
                  </div>
                  {t.billing.totalRevenue}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousMonth}
                      className="border-[#1B4332]/20"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      {format(subMonths(selectedMonth, 1), 'MMM')}
                    </Button>

                    <div className="text-center">
                      <h3 className="text-xl font-bold text-[#1B4332]">
                        {showCustomRange ? t.billing.customRange : format(selectedMonth, 'MMMM yyyy')}
                      </h3>
                      {!isCurrentMonth && !showCustomRange && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={goToCurrentMonth}
                          className="text-[#1B4332]/60 text-xs p-0 h-auto"
                        >
                          {t.billing.backToCurrentMonth}
                        </Button>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextMonth}
                      disabled={isCurrentMonth}
                      className="border-[#1B4332]/20"
                    >
                      {format(subMonths(selectedMonth, -1), 'MMM')}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>

                  {/* Custom Range Toggle */}
                  <div className="flex justify-center">
                    <Button
                      variant={showCustomRange ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowCustomRange(!showCustomRange)}
                      className={showCustomRange ? 'bg-[#1B4332]' : 'border-[#1B4332]/20'}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {t.billing.customRange}
                    </Button>
                  </div>

                  {showCustomRange && (
                    <div className="flex gap-2 justify-center">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="justify-start text-left border-[#1B4332]/20">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDateRange.from ? format(customDateRange.from, 'MMM dd, yyyy') : 'From'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={customDateRange.from}
                            onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="justify-start text-left border-[#1B4332]/20">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDateRange.to ? format(customDateRange.to, 'MMM dd, yyyy') : 'To'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={customDateRange.to}
                            onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-6 bg-gradient-to-br from-[#1B4332] to-[#8B5A2B] rounded-xl text-white">
                      <p className="text-sm opacity-90 mb-2">{t.billing.totalRevenue}</p>
                      <p className="text-3xl font-bold">
                        {getCurrency()} {calculateRevenue().toFixed(2)}
                      </p>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl text-white">
                      <p className="text-sm opacity-90 mb-2">{t.billing.sessions}</p>
...
                      <p className="text-xs opacity-75 mt-2">
                        {sessions?.filter(s => s.rider_verified).length || 0} {t.guardian.verifiedSessions}
                      </p>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl text-white">
                      <p className="text-sm opacity-90 mb-2">{t.billing.competitions}</p>
                      <p className="text-3xl font-bold">
                        {getCurrency()} {calculateCompetitionRevenue().toFixed(2)}
                      </p>
                      <p className="text-xs opacity-75 mt-2">
                        {(() => {
                          let paidCount = 0;
                          competitions?.forEach(c => {
                            c.riders?.forEach(r => {
                              if (r.payment_status === 'paid') paidCount++;
                            });
                          });
                          return paidCount;
                        })()} {t.billing.paidRiders}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-[#1B4332] font-medium mb-3 block">{t.billing.revenueBreakdown}</Label>
                    <div className="space-y-3">
                      {getRiderBreakdown().length === 0 ? (
                        <p className="text-[#1B4332]/60 text-sm">{t.guardian.noSessionsPeriod}</p>
                      ) : (
                        getRiderBreakdown().map((rider) => (
                          <div 
                            key={rider.name}
                            className="p-4 bg-white border border-[#1B4332]/10 rounded-lg"
                          >
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-semibold text-[#1B4332]">{rider.name}</h3>
                              <span className="text-lg font-bold text-[#1B4332]">
                                {getCurrency()} {rider.total.toFixed(2)}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {Object.entries(rider.sessions).map(([sessionType, data]) => (
                                <div 
                                  key={sessionType}
                                  className="flex justify-between text-sm"
                                >
                                  <span className="text-[#1B4332]/70">
                                    {sessionType} ({data.count} session{data.count > 1 ? 's' : ''})
                                  </span>
                                  <span className="text-[#1B4332] font-medium">
                                    {getCurrency()} {data.revenue.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              {rider.competitions?.map((comp, idx) => (
                                <div key={idx} className="pt-2 border-t border-[#1B4332]/10">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Trophy className="w-3 h-3 text-amber-600" />
                                    <span className="text-sm font-medium text-amber-700">{comp.name}</span>
                                  </div>
                                  {Object.entries(comp.services).map(([service, amount]) => (
                                    <div key={service} className="flex justify-between text-xs ml-5">
                                      <span className="text-[#1B4332]/60">{service}</span>
                                      <span className="text-[#1B4332] font-medium">
                                        {getCurrency()} {amount.toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rates">
            <Card className="bg-white border-[#1B4332]/10 shadow-sm">
              <CardHeader className="border-b border-[#1B4332]/10">
                <CardTitle className="text-xl text-[#1B4332] flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1B4332]/10 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-[#1B4332]" />
                  </div>
                  {t.billing.sessionRates}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
            <div className="space-y-6">
              {SESSION_TYPES.map((sessionType) => (
                <div 
                  key={sessionType}
                  className="p-4 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10"
                >
                  <Label className="text-[#1B4332] font-medium mb-3 block">
                    {sessionType}
                  </Label>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Select
                        value={rates[sessionType]?.currency || 'ILS'}
                        onValueChange={(value) => handleRateChange(sessionType, 'currency', value)}
                      >
                        <SelectTrigger className="border-[#1B4332]/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map(currency => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={rates[sessionType]?.rate || ''}
                        onChange={(e) => handleRateChange(sessionType, 'rate', e.target.value)}
                        className="border-[#1B4332]/20"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <Button
                onClick={handleSaveAllRates}
                disabled={saveRateMutation.isPending}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90 px-8"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveRateMutation.isPending ? t.billing.saving : t.billing.saveRates}
              </Button>
            </div>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}