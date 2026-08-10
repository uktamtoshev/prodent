import { lazy, Suspense, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Calendar,
  Camera,
  Film,
  Images,
  LayoutGrid,
  Newspaper,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Settings,
  Share2,
  Star,
  User,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DoctorTimeline } from "@/components/doctor/profile/DoctorTimeline";
import { DoctorAbout } from "@/components/doctor/profile/DoctorAbout";
import { DoctorChat } from "@/components/doctor/profile/DoctorChat";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDoctorBoosts } from "@/hooks/useAdCampaigns";
import { BoostBadge } from "@/components/ads/BoostBadge";
import { useDoctorBadges } from "@/hooks/useBadgeAssignments";
import { AwardBadgeOverlay } from "@/components/badges/AwardBadgeOverlay";
import { cn } from "@/lib/utils";
import { defaultDoctorAvatar } from "@/lib/defaultAvatar";
import { PageMeta } from "@/components/PageMeta";
import { PhysicianSchema, BreadcrumbListSchema } from "@/components/StructuredData";
import type { DoctorPublicData } from "@/components/doctor/profile/doctor-profile-types";

const DoctorPortfolio = lazy(() =>
  import("@/components/doctor/profile/DoctorPortfolio").then((module) => ({ default: module.DoctorPortfolio })),
);
const DoctorReviews = lazy(() =>
  import("@/components/doctor/profile/DoctorReviews").then((module) => ({ default: module.DoctorReviews })),
);
const DoctorServices = lazy(() =>
  import("@/components/doctor/profile/DoctorServices").then((module) => ({ default: module.DoctorServices })),
);
const DoctorSettings = lazy(() =>
  import("@/components/doctor/profile/DoctorSettings").then((module) => ({ default: module.DoctorSettings })),
);
const ProfileReels = lazy(() =>
  import("@/components/profile/ProfileReels").then((module) => ({ default: module.ProfileReels })),
);
const ProfileArticles = lazy(() =>
  import("@/components/profile/ProfileArticles").then((module) => ({ default: module.ProfileArticles })),
);

const profileTabFallback = <div className="min-h-40 rounded-xl bg-card/60 animate-pulse" aria-label="Загрузка вкладки" />;

/* ──────────────────────────────────────────────────────────
   Profile header — Facebook-style, mirrors the clinic profile
   header (cover → overlapping avatar → name + inline stats →
   action buttons → location bar). Kept inline so it can reuse
   the page's existing data (boosts, award badges) without a
   second round of queries.
   ────────────────────────────────────────────────────────── */

function ProfileHeader({
  doctor,
  isFollowing,
  onFollow,
  onMessage,
  followersCount,
  isOwner,
  boost,
  awardBadge,
}: {
  doctor: DoctorPublicData;
  isFollowing: boolean;
  onFollow: () => void;
  onMessage: () => void;
  followersCount: number;
  isOwner: boolean;
  boost?: import("@/hooks/useAdCampaigns").BoostInfo;
  awardBadge?: import("@/hooks/useBadgeAssignments").ActiveBadge;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const name =
    doctor.profile?.full_name || doctor.specialty || t("doctorPublicProfile.defaultDoctorName");
  const clinic = doctor.clinic;
  const avatarSrc = defaultDoctorAvatar(doctor.profile?.avatar_url, doctor.profile?.gender);
  const coverImage = doctor.cover_url || "/doctor-cover-default.jpg";
  const phone = doctor.profile?.phone ?? undefined;
  const rating = Number(doctor.rating || 0);
  const reviewsCount = doctor.reviews_count || 0;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: t("doctorProfileHeader.linkCopied") });
    } catch {
      /* clipboard not available — nothing actionable */
    }
  };

  const uploadCover = async (file: File) => {
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${doctor.id}/cover_${Date.now()}.${ext}`;
      const { data, error: uploadError } = await supabase.storage
        .from("doctor-media")
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("doctor-media").getPublicUrl(data.path);
      const { error: updateError } = await supabase
        .from("doctors")
        .update({ cover_url: publicUrl.publicUrl })
        .eq("id", doctor.id);
      if (updateError) throw updateError;
      toast({ title: t("doctorEditProfile.saved") });
      queryClient.invalidateQueries({ queryKey: ["doctor-public-profile"] });
    } catch (error: unknown) {
      toast({ title: t("doctorEditProfile.saveError"), description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${doctor.user_id}/${Date.now()}.${ext}`;
      const { data, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(data.path);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl.publicUrl })
        .eq("id", doctor.user_id);
      if (updateError) throw updateError;
      toast({ title: t("doctorEditProfile.avatarUploaded") });
      queryClient.invalidateQueries({ queryKey: ["doctor-public-profile"] });
    } catch (error: unknown) {
      toast({ title: t("doctorEditProfile.avatarError"), description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="bg-card shadow-sm">
      {/* Cover */}
      <div className="h-[200px] sm:h-[280px] md:h-[350px] relative overflow-hidden">
        <img src={coverImage} alt="" className="w-full h-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {isOwner && (
          <>
            <input
              id="public-doctor-cover-upload"
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-4 right-4 min-h-11 max-w-[calc(100%-2rem)] gap-2 bg-card/95 text-foreground shadow-lg hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              aria-label={uploadingCover ? t("doctorMediaUploader.uploading") : t("doctorProfileHeader.editProfile")}
            >
              <Camera className="w-4 h-4" />
              {uploadingCover ? t("doctorMediaUploader.uploading") : t("doctorProfileHeader.editProfile")}
            </Button>
          </>
        )}
      </div>

      {/* Profile info */}
      <div className="px-6 lg:px-8">
        <div className="relative pb-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar — overlapping the cover */}
            <div className="relative -mt-[84px] sm:-mt-[96px] self-center sm:self-auto z-10">
              <div className="relative">
                <Avatar className="w-[148px] h-[148px] sm:w-[168px] sm:h-[168px] border-4 border-card shadow-xl rounded-xl">
                  <AvatarImage src={avatarSrc} className="object-cover rounded-lg bg-background" />
                  <AvatarFallback className="text-5xl bg-primary text-primary-foreground rounded-lg font-bold">
                    {name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {/* Promoted-doctor ribbon + admin award badge (monetization / awards) */}
                <BoostBadge boost={boost} size="lg" />
                <AwardBadgeOverlay badge={awardBadge} size="lg" className="!top-0 !left-0" />
                {isOwner && (
                  <>
                    <input
                      id="public-doctor-avatar-upload"
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      aria-label={uploadingAvatar ? t("doctorMediaUploader.uploading") : t("doctorEditProfile.avatarPhoto")}
                    >
                      {uploadingAvatar ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5 text-current" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Name & info */}
            <div className="flex-1 text-center sm:text-left sm:pb-4 sm:pt-2">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="min-w-0 break-words text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                  {name}
                </h1>
              </div>

              <p className="text-lg text-muted-foreground mb-2">{doctor.specialty}</p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 text-base text-muted-foreground">
                <span className="font-semibold text-foreground">{followersCount}</span>
                <span>{t("doctorPublicProfile.followers")}</span>
                {reviewsCount > 0 && (
                  <>
                    <span className="mx-1.5">•</span>
                    <Star className="w-4 h-4 text-rating fill-rating" />
                    <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
                    <span>({reviewsCount})</span>
                  </>
                )}
                {doctor.experience_years != null && (
                  <>
                    <span className="mx-1.5">•</span>
                    <Briefcase className="w-4 h-4" />
                    <span>
                      {doctor.experience_years} {t("doctorPublicProfile.yearsExp")}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Action buttons — clinic style */}
            <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 pb-4 sm:w-auto sm:justify-end">
              {!isOwner && (
                <>
                  <Button
                    variant={isFollowing ? "secondary" : "default"}
                    onClick={onFollow}
                    className={cn(
                      "min-h-11 min-w-0 flex-1 gap-2 px-4 font-semibold focus-visible:ring-2 focus-visible:ring-ring sm:flex-none sm:px-6",
                      isFollowing && "bg-accent text-accent-foreground hover:bg-accent/80",
                    )}
                  >
                    {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {isFollowing ? t("doctorPublicProfile.unfollow") : t("doctorPublicProfile.follow")}
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-11 min-w-11 gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={onMessage}
                    aria-label={t("doctorPublicProfile.write")}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("doctorPublicProfile.write")}</span>
                  </Button>
                </>
              )}
              {phone &&
                (showPhone ? (
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md bg-primary/10 px-4 py-2 font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Phone className="w-4 h-4" />
                    {phone}
                  </a>
                ) : (
                  <Button
                    variant="secondary"
                    className="min-h-11 min-w-11 gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setShowPhone(true)}
                    aria-label={t("doctorPublicProfile.showPhone")}
                  >
                    <Phone className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("doctorPublicProfile.showPhone")}</span>
                  </Button>
                ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 shrink-0 bg-accent text-accent-foreground hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("doctorProfileTabs.moreLabel")}
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleShare} className="min-h-11 focus:bg-accent focus:text-accent-foreground">
                    <Share2 className="w-4 h-4 mr-2" />
                    {t("doctorPublicProfile.share")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Location bar */}
          {clinic && (
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-4 mt-4 border-t border-border text-base text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-primary font-medium">{clinic.name}</span>
              {clinic.city && (
                <>
                  <span className="mx-1">•</span>
                  <span className="text-foreground">{clinic.city}</span>
                </>
              )}
              {clinic.address && (
                <>
                  <span className="mx-1">•</span>
                  <span className="text-foreground">{clinic.address}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Tabs — clinic style (active underline + "Ещё" overflow menu)
   ────────────────────────────────────────────────────────── */

export function ProfileTabs({
  active,
  onChange,
  isOwner,
}: {
  active: string;
  onChange: (k: string) => void;
  isOwner: boolean;
}) {
  const { t } = useLanguage();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mainTabs = [
    { id: "timeline", label: t("doctorPublicProfile.tabTimeline"), icon: LayoutGrid },
    { id: "reels", label: "Рилсы", icon: Film },
    { id: "articles", label: "Статьи", icon: Newspaper },
    { id: "portfolio", label: t("doctorPublicProfile.tabPortfolio"), icon: Images },
    { id: "reviews", label: t("doctorPublicProfile.tabReviews"), icon: Star },
    { id: "about", label: t("doctorPublicProfile.tabAbout"), icon: User },
  ];
  const moreTabs = [
    { id: "services", label: t("doctorPublicProfile.tabServices"), icon: Briefcase },
    ...(isOwner ? [{ id: "settings", label: t("doctorPublicProfile.tabSettings"), icon: Settings }] : []),
  ];
  const allTabs = [...mainTabs, ...moreTabs];
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % allTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + allTabs.length) % allTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = allTabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = allTabs[nextIndex];
    onChange(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="bg-card border-t border-border shadow-sm">
      <div className="min-w-0 px-2 sm:px-6 lg:px-8">
        <nav
          className="flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar -mb-px"
          aria-label={`${t("doctorPublicProfile.defaultDoctorName")}: ${t("doctorPublicProfile.tabAbout")}`}
        >
          <div role="tablist" className="flex min-w-max items-center gap-1">
          {allTabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`doctor-profile-tab-${tab.id}`}
              aria-controls={`doctor-profile-panel-${tab.id}`}
              aria-selected={active === tab.id}
              tabIndex={active === tab.id ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={cn(
                "relative flex min-h-11 items-center gap-2 px-3 py-2 text-base font-semibold whitespace-nowrap transition-colors border-b-[3px] -mb-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4",
                active === tab.id
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:bg-muted/50 rounded-t-lg",
              )}
            >
              <tab.icon className="w-5 h-5 sm:hidden" />
              <span>{tab.label}</span>
            </button>
          ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────── */

export default function DoctorPublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("timeline");
  const [showChat, setShowChat] = useState(false);

  const { data: doctor, isLoading, isError, refetch } = useQuery({
    queryKey: ["doctor-public-profile", id, user?.id],
    queryFn: async () => {
      const token =
        typeof window === "undefined"
          ? null
          : localStorage.getItem("prodent_access_token");
      const privacyResponse = await fetch(
        `/api/v1/public/doctors/${encodeURIComponent(id!)}/profile-privacy`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      if (privacyResponse.status === 404) return null;
      if (!privacyResponse.ok) {
        throw new Error("Doctor privacy settings could not be loaded");
      }
      const privacy = (await privacyResponse.json()) as {
        phone?: string | null;
        email?: string | null;
      };
      const { data: doc, error } = await supabase
        .from("doctors")
        .select(`
          id, user_id, clinic_id, specialty, bio, education,
          certificates, experience_years, cooperation_type,
          video_url, cover_url, address, latitude, longitude, rating,
          reviews_count
        `)
        .eq("id", id!)
        .eq("is_verified", true)
        .eq("is_accepting_patients", true)
        .maybeSingle();
      if (error) throw error;
      if (!doc) return null;

      // Fetch profile and clinic in parallel — they're independent.
      const [profileRes, clinicRes] = await Promise.all([
        doc.user_id
          ? supabase
              .from("profiles")
              .select("full_name, avatar_url, gender")
              .eq("id", doc.user_id)
              .eq("is_active", true)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        doc.clinic_id
          ? supabase
              .from("clinics")
              .select("id, name, address, phone, city, latitude, longitude")
              .eq("id", doc.clinic_id)
              .eq("is_verified", true)
              .eq("is_active", true)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (doc.user_id && !profileRes.data) return null;

      return {
        ...doc,
        profile: profileRes.data
          ? {
              ...profileRes.data,
              phone: privacy.phone ?? null,
              email: privacy.email ?? null,
            }
          : null,
        clinic: clinicRes.data ?? null,
      };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: currentUserDoctor } = useQuery({
    queryKey: ["current-user-doctor", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000, // doesn't change during a session
  });

  const { data: isFollowing, refetch: refetchFollowing } = useQuery({
    queryKey: ["doctor-following", id, user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("doctor_followers")
        .select("id")
        .eq("doctor_id", id!)
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!id && !!user?.id,
    staleTime: 60 * 1000,
  });

  const { data: followersCount } = useQuery({
    queryKey: ["doctor-followers-count", id],
    queryFn: async () => {
      const { count } = await supabase
        .from("doctor_followers")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", id!);
      return count || 0;
    },
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const isOwner = !!user?.id && user.id === doctor?.user_id;

  // Look up the active ad-campaign boost (if any) for the badge overlay.
  const { data: boosts } = useDoctorBoosts(doctor?.id ? [doctor.id] : []);
  const doctorBadges = useDoctorBadges(doctor?.id);

  const requireAuth = (action: string) => {
    toast({
      title: t("doctorPublicProfile.authRequired"),
      description: `${t("doctorPublicProfile.authPrefix")} ${action}${t("doctorPublicProfile.authSuffix")}`,
      action: (
        <button
          type="button"
          onClick={() => navigate("/auth")}
          className="min-h-11 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("doctorPublicProfile.login")}
        </button>
      ),
    });
  };

  const handleFollow = async () => {
    if (!user?.id) return requireAuth(t("doctorPublicProfile.authToFollow"));
    if (isFollowing) {
      await supabase
        .from("doctor_followers")
        .delete()
        .eq("doctor_id", id!)
        .eq("user_id", user.id);
    } else {
      await supabase.from("doctor_followers").insert({ doctor_id: id!, user_id: user.id });
    }
    refetchFollowing();
  };

  const handleMessage = () => {
    if (!user?.id) return requireAuth(t("doctorPublicProfile.authToWrite"));
    if (isOwner) return; // can't message yourself
    setShowChat(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("doctorPublicProfile.loadingProfile")}</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold mb-2 font-display">Не удалось загрузить врача</h1>
          <p className="text-muted-foreground mb-6">Проверьте соединение и попробуйте ещё раз.</p>
          <Button onClick={() => refetch()}>Повторить</Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div className="w-24 h-24 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center text-4xl">
            👨‍⚕️
          </div>
          <h1 className="text-2xl font-bold mb-2 font-display">{t("doctorPublicProfile.doctorNotFound")}</h1>
          <p className="text-muted-foreground">{t("doctorPublicProfile.maybeRemoved")}</p>
        </div>
        <Footer />
      </div>
    );
  }

  // ── SEO ──────────────────────────────────────────────────
  const doctorName =
    doctor.profile?.full_name || doctor.specialty || t("doctorPublicProfile.defaultDoctorName");
  const canonicalUrl = `https://prodent.uz/doctor/${doctor.id}`;
  const seoTitle = doctor.specialty
    ? `${doctorName} — ${doctor.specialty} | PRODENT`
    : `${doctorName} | PRODENT`;
  const seoDescription = [
    doctorName,
    doctor.specialty,
    doctor.clinic?.name,
    doctor.clinic?.city,
    doctor.experience_years != null
      ? `${doctor.experience_years} ${t("doctorPublicProfile.yearsExp")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <PageMeta
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        ogType="profile"
        ogImage={doctor.profile?.avatar_url || undefined}
      />
      <PhysicianSchema
        name={doctorName}
        specialty={doctor.specialty}
        image={doctor.profile?.avatar_url || undefined}
        rating={(doctor.reviews_count || 0) > 0 ? Number(doctor.rating) : undefined}
        reviewCount={doctor.reviews_count || undefined}
        clinicName={doctor.clinic?.name || undefined}
        clinicAddress={doctor.clinic?.address || undefined}
        city={doctor.clinic?.city || undefined}
        url={canonicalUrl}
      />
      <BreadcrumbListSchema
        items={[
          { name: t("nav.home"), url: "https://prodent.uz/" },
          { name: t("nav.search"), url: "https://prodent.uz/search" },
          { name: doctorName, url: canonicalUrl },
        ]}
      />
      <Header />
      <main className="max-w-[1280px] mx-auto bg-card border-x border-border min-h-[calc(100vh-64px)]">
        <ProfileHeader
          doctor={doctor}
          isFollowing={!!isFollowing}
          onFollow={handleFollow}
          onMessage={handleMessage}
          followersCount={followersCount || 0}
          isOwner={isOwner}
          boost={boosts?.[doctor.id]}
          awardBadge={doctorBadges[0]}
        />
        <ProfileTabs active={activeTab} onChange={setActiveTab} isOwner={isOwner} />
        <div
          id={`doctor-profile-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`doctor-profile-tab-${activeTab}`}
          tabIndex={0}
          className="px-4 py-7 pb-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6 lg:px-8"
        >
          {activeTab === "timeline" && <DoctorTimeline doctorId={doctor.id} isOwner={isOwner} />}
          <Suspense fallback={profileTabFallback}>
            {activeTab === "reels" && <ProfileReels ownerType="doctor" ownerId={doctor.id} authorId={user?.id} isOwner={isOwner} />}
            {activeTab === "articles" && <ProfileArticles ownerType="doctor" ownerId={doctor.id} authorId={user?.id} isOwner={isOwner} />}
            {activeTab === "portfolio" && <DoctorPortfolio doctorId={doctor.id} isOwner={isOwner} />}
            {activeTab === "reviews" && <DoctorReviews doctorId={doctor.id} />}
          </Suspense>
          {activeTab === "about" && <DoctorAbout doctor={doctor} isOwner={isOwner} />}
          <Suspense fallback={profileTabFallback}>
            {activeTab === "services" && <DoctorServices doctorId={doctor.id} />}
            {activeTab === "settings" && isOwner && <DoctorSettings />}
          </Suspense>
        </div>
      </main>

      {/* Sticky booking CTA — hidden when the doctor is viewing their own
          profile (no point messaging/booking yourself). Booking lives here
          now that the header buttons mirror the clinic (follow/write/phone). */}
      {!isOwner && doctor.clinic?.id && (
        <>
          {/* Desktop: rich card */}
          <div
            className="fixed bottom-5 right-5 z-40 hidden md:flex items-center gap-2 p-2 pl-4 rounded-[16px] bg-card border border-border"
            style={{ boxShadow: "0 10px 32px -8px rgba(15,23,42,0.18)" }}
          >
            <div className="text-xs">
              <div className="text-muted-foreground">{t("doctorPublicProfile.nearestWindow")}</div>
              <div className="font-semibold text-foreground tabular-nums">{t("doctorPublicProfile.soon")}</div>
            </div>
            <button
              type="button"
              onClick={handleMessage}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquare className="w-4 h-4" /> {t("doctorPublicProfile.chat")}
            </button>
            <Link
              to={`/book/${doctor.id}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Calendar className="w-4 h-4" /> {t("doctorPublicProfile.book")}
            </Link>
          </div>

          {/* Mobile: compact booking pill (the header no longer carries a book
              button, so keep booking reachable on small screens). */}
          <Link
            to={`/book/${doctor.id}`}
            className="fixed bottom-5 right-5 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            style={{
              boxShadow: "0 10px 32px -8px rgba(15,23,42,0.35)",
            }}
          >
            <Calendar className="w-4 h-4" /> {t("doctorPublicProfile.book")}
          </Link>
        </>
      )}

      {showChat && user && (
        <DoctorChat
          doctorId={doctor.id}
          patientId={user.id}
          onClose={() => setShowChat(false)}
          senderDoctorId={currentUserDoctor?.id}
        />
      )}

      <Footer />
    </div>
  );
}
