import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Star, MapPin, Award, ChevronRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveBannerCampaigns, useTrackAdEvent, AdCampaign } from "@/hooks/useAdCampaigns";

// Fallback data when no campaigns
const fallbackDoctors = [
  {
    id: "demo-1",
    name: "Камолиддин Хакимов",
    specialty: "Имплантолог · Ортопед",
    image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=300&fit=crop",
    rating: 5.0,
    experience: 15,
    price_from: 100000,
  },
];

const fallbackClinics = [
  {
    id: "demo-1",
    name: "Smile Clinic",
    city: "Ташкент",
    address: "Юнусабадский район",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=225&fit=crop",
  },
];

export const DoctorAdBanner = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data: campaigns } = useActiveBannerCampaigns('doctor');
  const trackEvent = useTrackAdEvent();

  const bannerCampaigns = campaigns?.filter(c => c.package?.package_type === 'banner') || [];
  const hasCampaigns = bannerCampaigns.length > 0;

  useEffect(() => {
    if (!hasCampaigns) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerCampaigns.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [hasCampaigns, bannerCampaigns.length]);

  // Track impression
  useEffect(() => {
    if (hasCampaigns && bannerCampaigns[currentIndex]) {
      trackEvent.mutate({
        campaign_id: bannerCampaigns[currentIndex].id,
        event_type: 'impression',
      });
    }
  }, [currentIndex, hasCampaigns]);

  const handleClick = (campaign: AdCampaign) => {
    trackEvent.mutate({
      campaign_id: campaign.id,
      event_type: 'banner_click',
    });
  };

  const currentCampaign = hasCampaigns ? bannerCampaigns[currentIndex] : null;
  const currentDoctor = currentCampaign?.doctor;
  const fallback = fallbackDoctors[0];
  
  const doctorName = currentDoctor?.profiles?.full_name || fallback.name;
  const doctorImage = currentDoctor?.profiles?.avatar_url || fallback.image;
  const doctorRating = currentDoctor?.rating || fallback.rating;
  const doctorExperience = currentDoctor?.experience_years || fallback.experience;
  const doctorId = currentDoctor?.id || fallback.id;
  const doctorSpecialty = currentDoctor?.specialty || fallback.specialty;

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-lg">
      {/* Brand gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600" />
      <div className="absolute inset-0 bg-gradient-to-t from-teal-700/50 via-transparent to-cyan-400/20" />
      
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10" style={{ 
        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
        backgroundSize: '20px 20px'
      }} />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-300" />
      
      {/* Floating glow */}
      <div className="absolute top-1/4 right-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-0 w-24 h-24 bg-teal-300/20 rounded-full blur-2xl" />

      <div className="relative p-5" key={doctorId}>
        {/* Header */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <Award className="w-3.5 h-3.5" />
            <span>Рекомендуем</span>
          </div>
        </div>

        {/* Doctor photo */}
        <div className="relative mb-4">
          <div className="w-full aspect-[4/3] rounded-xl overflow-hidden ring-2 ring-white/30 shadow-xl">
            <img 
              src={doctorImage}
              alt={doctorName}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            
            {/* Rating on image */}
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg shadow-md">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span className="text-sm font-bold text-slate-900">{doctorRating}</span>
            </div>
          </div>
        </div>

        {/* Doctor info */}
        <div className="text-center mb-4">
          <h3 className="text-white font-bold text-lg mb-1">
            {doctorName}
          </h3>
          <p className="text-teal-100 text-sm mb-2">{doctorSpecialty}</p>
          <span className="inline-flex items-center gap-1.5 text-xs text-white/80 bg-white/10 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-cyan-300 rounded-full" />
            {doctorExperience}+ лет опыта
          </span>
        </div>

        {/* Pagination dots */}
        {hasCampaigns && bannerCampaigns.length > 1 && (
          <div className="flex justify-center gap-1.5 mb-3">
            {bannerCampaigns.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex 
                    ? 'bg-white w-5' 
                    : 'bg-white/40 w-1.5 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {/* CTA Button */}
        <Link 
          to={`/doctor/${doctorId}`}
          onClick={() => currentCampaign && handleClick(currentCampaign)}
        >
          <Button 
            className="w-full bg-white hover:bg-white/95 text-teal-700 font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            Записаться на приём
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export const ClinicAdBanner = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data: campaigns } = useActiveBannerCampaigns('clinic');
  const trackEvent = useTrackAdEvent();

  const bannerCampaigns = campaigns?.filter(c => c.package?.package_type === 'banner') || [];
  const hasCampaigns = bannerCampaigns.length > 0;

  useEffect(() => {
    if (!hasCampaigns) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerCampaigns.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [hasCampaigns, bannerCampaigns.length]);

  // Track impression
  useEffect(() => {
    if (hasCampaigns && bannerCampaigns[currentIndex]) {
      trackEvent.mutate({
        campaign_id: bannerCampaigns[currentIndex].id,
        event_type: 'impression',
      });
    }
  }, [currentIndex, hasCampaigns]);

  const handleClick = (campaign: AdCampaign) => {
    trackEvent.mutate({
      campaign_id: campaign.id,
      event_type: 'banner_click',
    });
  };

  const currentCampaign = hasCampaigns ? bannerCampaigns[currentIndex] : null;
  const currentClinic = currentCampaign?.clinic;
  const fallback = fallbackClinics[0];
  const clinicName = currentClinic?.name || fallback.name;
  const clinicCity = currentClinic?.city || fallback.city;
  const clinicAddress = currentClinic?.address || fallback.address;
  const clinicId = currentClinic?.id || fallback.id;
  const clinicImage = (currentClinic as any)?.cover_image || "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=225&fit=crop";

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-lg">
      {/* Brand gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600" />
      <div className="absolute inset-0 bg-gradient-to-t from-emerald-700/50 via-transparent to-cyan-400/20" />
      
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10" style={{ 
        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
        backgroundSize: '20px 20px'
      }} />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300" />
      
      {/* Floating glow */}
      <div className="absolute top-1/4 right-0 w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl" />

      <div className="relative p-5" key={clinicId}>
        {/* Header */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <Crown className="w-3.5 h-3.5" />
            <span>Топ клиника</span>
          </div>
        </div>

        {/* Clinic image */}
        <div className="relative mb-4">
          <div className="w-full aspect-video rounded-xl overflow-hidden ring-2 ring-white/30 shadow-xl">
            <img 
              src={clinicImage}
              alt={clinicName}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        </div>

        {/* Clinic info */}
        <div className="text-center mb-4">
          <h3 className="text-white font-bold text-lg mb-1.5">
            {clinicName}
          </h3>
          <div className="flex items-center justify-center gap-1.5 text-sm text-teal-100">
            <MapPin className="w-3.5 h-3.5" />
            <span>{clinicCity}, {clinicAddress}</span>
          </div>
        </div>

        {/* Pagination dots */}
        {hasCampaigns && bannerCampaigns.length > 1 && (
          <div className="flex justify-center gap-1.5 mb-3">
            {bannerCampaigns.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex 
                    ? 'bg-white w-5' 
                    : 'bg-white/40 w-1.5 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {/* CTA Button */}
        <Link 
          to={`/clinic/${clinicId}`}
          onClick={() => currentCampaign && handleClick(currentCampaign)}
        >
          <Button 
            className="w-full bg-white hover:bg-white/95 text-teal-700 font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            Подробнее о клинике
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export const AdBannersSidebar = ({ clinicFirst = false }: { clinicFirst?: boolean }) => {
  return (
    <div className="space-y-5">
      {clinicFirst ? (
        <>
          <ClinicAdBanner />
          <DoctorAdBanner />
        </>
      ) : (
        <>
          <DoctorAdBanner />
          <ClinicAdBanner />
        </>
      )}
    </div>
  );
};
