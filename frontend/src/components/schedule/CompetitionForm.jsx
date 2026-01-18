import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, MapPin, X, Plus } from 'lucide-react';

export default function CompetitionForm({ user, riders, competition, onCancel, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [stables, setStables] = useState([]);
  const [locationType, setLocationType] = useState(competition?.stable_id ? 'stable' : 'freetext');
  const [allHorses, setAllHorses] = useState({});
  
  const [formData, setFormData] = useState({
    name: competition?.name || '',
    competition_date: competition?.competition_date || '',
    location: competition?.location || '',
    stable_id: competition?.stable_id || '',
    notes: competition?.notes || '',
    riders: competition?.riders || []
  });

  useEffect(() => {
    const loadStables = async () => {
      const stablesList = await base44.entities.Stable.filter({ approval_status: 'approved' });
      setStables(stablesList);
    };
    loadStables();

    // Load horses for existing riders if editing
    if (competition?.riders) {
      const loadRiderHorses = async () => {
        const horsesMap = {};
        for (const rider of competition.riders) {
          const horses = await base44.entities.Horse.filter({ owner_email: rider.rider_email });
          horsesMap[rider.rider_email] = horses;
        }
        setAllHorses(horsesMap);
      };
      loadRiderHorses();
    }
  }, [competition]);

  const addRider = async (riderEmail) => {
    if (!riderEmail || formData.riders.some(r => r.rider_email === riderEmail)) return;
    
    const rider = riders.find(r => r.email === riderEmail);
    const horses = await base44.entities.Horse.filter({ owner_email: riderEmail });
    
    setAllHorses(prev => ({ ...prev, [riderEmail]: horses }));
    
    setFormData(prev => ({
      ...prev,
      riders: [...prev.riders, {
        rider_email: riderEmail,
        rider_name: rider?.name || riderEmail,
        horses: [],
        services: []
      }]
    }));
  };

  const removeRider = (riderEmail) => {
    setFormData(prev => ({
      ...prev,
      riders: prev.riders.filter(r => r.rider_email !== riderEmail)
    }));
  };

  const updateRiderHorses = (riderEmail, horses) => {
    setFormData(prev => ({
      ...prev,
      riders: prev.riders.map(r => 
        r.rider_email === riderEmail ? { ...r, horses } : r
      )
    }));
  };

  const toggleService = (riderEmail, service) => {
    setFormData(prev => ({
      ...prev,
      riders: prev.riders.map(r => {
        if (r.rider_email === riderEmail) {
          const services = r.services.includes(service)
            ? r.services.filter(s => s !== service)
            : [...r.services, service];
          return { ...r, services };
        }
        return r;
      })
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.competition_date || !formData.location || formData.riders.length === 0) {
      alert('Please fill in all required fields and add at least one rider');
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: formData.name,
        trainer_email: user.email,
        trainer_name: `${user.first_name} ${user.last_name}`.trim() || user.full_name,
        competition_date: formData.competition_date,
        location: formData.location,
        stable_id: locationType === 'stable' ? formData.stable_id : '',
        notes: formData.notes,
        riders: formData.riders,
        status: competition?.status || 'scheduled'
      };

      if (competition) {
        await base44.entities.Competition.update(competition.id, data);
      } else {
        await base44.entities.Competition.create(data);
      }
      onSuccess();
    } catch (error) {
      console.error(`Failed to ${competition ? 'update' : 'create'} competition:`, error);
      alert(`Failed to ${competition ? 'update' : 'create'} competition`);
    } finally {
      setLoading(false);
    }
  };

  const availableRiders = riders.filter(r => !formData.riders.some(fr => fr.rider_email === r.email));
  const serviceTypes = ['Horse Transport', 'Competition Prep', 'Training', 'Lesson', 'Horse Training', 'Evaluation'];

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-[#1B4332]">
            {competition ? 'Edit Competition Event' : 'New Competition Event'}
          </h3>
        </div>

        <div className="space-y-2">
          <Label>Competition Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Spring Championship 2026"
            className="border-[#1B4332]/20"
          />
        </div>

        <div className="space-y-2">
          <Label>Date & Time *</Label>
          <Input
            type="datetime-local"
            value={formData.competition_date}
            onChange={(e) => setFormData(prev => ({ ...prev, competition_date: e.target.value }))}
            className="border-[#1B4332]/20"
          />
        </div>

        <div className="space-y-2">
          <Label>Location Type *</Label>
          <Select value={locationType} onValueChange={setLocationType}>
            <SelectTrigger className="border-[#1B4332]/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stable">Registered Stable</SelectItem>
              <SelectItem value="freetext">Custom Location</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {locationType === 'stable' ? (
          <div className="space-y-2">
            <Label>Select Stable *</Label>
            <Select
              value={formData.stable_id}
              onValueChange={(value) => {
                const stable = stables.find(s => s.id === value);
                setFormData(prev => ({ 
                  ...prev, 
                  stable_id: value,
                  location: stable?.name || ''
                }));
              }}
            >
              <SelectTrigger className="border-[#1B4332]/20">
                <SelectValue placeholder="Choose a stable" />
              </SelectTrigger>
              <SelectContent>
                {stables.map(stable => (
                  <SelectItem key={stable.id} value={stable.id}>
                    {stable.name} - {stable.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Location *</Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Enter competition location"
              className="border-[#1B4332]/20"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional details..."
            className="border-[#1B4332]/20"
          />
        </div>
      </div>

      {/* Riders Section */}
      <div className="pt-6 border-t border-[#1B4332]/10">
        <h4 className="font-semibold text-[#1B4332] mb-4">Riders *</h4>
        
        <div className="space-y-2 mb-4">
          <Label>Add Rider</Label>
          <Select onValueChange={addRider}>
            <SelectTrigger className="border-[#1B4332]/20">
              <SelectValue placeholder="Select a rider to add" />
            </SelectTrigger>
            <SelectContent>
              {availableRiders.map(rider => (
                <SelectItem key={rider.email} value={rider.email}>
                  {rider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {formData.riders.length === 0 ? (
          <p className="text-sm text-[#1B4332]/60 text-center py-4">No riders added yet</p>
        ) : (
          <div className="space-y-4">
            {formData.riders.map((rider) => {
              const riderHorses = allHorses[rider.rider_email] || [];
              return (
                <div key={rider.rider_email} className="p-4 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10">
                  <div className="flex items-start justify-between mb-3">
                    <h5 className="font-medium text-[#1B4332]">{rider.rider_name}</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRider(rider.rider_email)}
                      className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Horse Selection */}
                  <div className="space-y-2 mb-3">
                   <Label className="text-sm">Horses (optional)</Label>
                   <div className="flex flex-wrap gap-1.5 sm:gap-2">
                     {riderHorses.map(horse => {
                       const isSelected = rider.horses.includes(horse.name);
                       return (
                         <button
                           key={horse.id}
                           type="button"
                           onClick={() => {
                             const newHorses = isSelected
                               ? rider.horses.filter(h => h !== horse.name)
                               : [...rider.horses, horse.name];
                             updateRiderHorses(rider.rider_email, newHorses);
                           }}
                           className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm transition-colors ${
                             isSelected
                               ? 'bg-[#1B4332] text-white'
                               : 'bg-white border border-[#1B4332]/20 text-[#1B4332] hover:bg-[#1B4332]/5'
                           }`}
                         >
                           🐴 {horse.name}
                         </button>
                       );
                     })}
                     {riderHorses.length === 0 && (
                       <span className="text-xs text-[#1B4332]/60">No horses registered</span>
                     )}
                   </div>
                  </div>

                  {/* Services Selection */}
                  <div className="space-y-2">
                   <Label className="text-sm">Services Included *</Label>
                   <div className="flex flex-wrap gap-1.5 sm:gap-2">
                     {serviceTypes.map(service => {
                       const isSelected = rider.services.includes(service);
                       return (
                         <button
                           key={service}
                           type="button"
                           onClick={() => toggleService(rider.rider_email, service)}
                           className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm transition-colors ${
                             isSelected
                               ? 'bg-[#8B5A2B] text-white'
                               : 'bg-white border border-[#1B4332]/20 text-[#1B4332] hover:bg-[#1B4332]/5'
                           }`}
                         >
                           {service}
                         </button>
                       );
                     })}
                   </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-[#1B4332]/10">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-[#1B4332]/20 w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
        >
          {loading ? (competition ? 'Updating...' : 'Creating...') : (competition ? 'Update Competition' : 'Create Competition')}
        </Button>
      </div>
    </div>
  );
}