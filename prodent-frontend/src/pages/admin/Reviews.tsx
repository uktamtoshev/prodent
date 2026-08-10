import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';

// Map the active UI language to a date locale (no dictionary keys added).
const LOCALE_MAP: Record<string, string> = {
  ru: 'ru-RU',
  uz: 'uz-UZ',
  en: 'en-US',
};

interface ReviewRow {
  id: string;
  doctor_id?: string | null;
  clinic_id?: string | null;
  patient_id: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string | null;
}

interface AdminReview extends ReviewRow {
  verified: boolean;
  patient: { full_name: string | null };
  doctor: { specialty: string | null; profile: { full_name: string | null } };
}

interface ReviewProfile { id: string; full_name: string | null }
interface ReviewClinic { id: string; name: string | null }
interface ReviewDoctor { id: string; user_id: string | null; specialty: string | null }

export default function Reviews() {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'doctor' | 'clinic'>('doctor');
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const { isModerator } = useUserRole();
  const dateLocale = LOCALE_MAP[language] ?? 'ru-RU';

  // Which table the current tab moderates. clinic_reviews were previously invisible to
  // the admin entirely (and, defaulting to is_approved=false, stayed hidden forever).
  const reviewTable = source === 'doctor' ? 'doctor_reviews' : 'clinic_reviews';

  const { data: reviews, isLoading, isError } = useQuery({
    // Real reviews live in `doctor_reviews` / `clinic_reviews` (with the `is_approved`
    // moderation flag). We fetch the base rows then resolve patient + entity names with
    // flat queries (the shim can't do the depth-2 embed reliably) and merge client-side.
    // `verified` is kept as an alias of `is_approved` so the render stays unchanged.
    queryKey: ['admin-reviews', source, isModerator ? 'redacted' : 'full'],
    queryFn: async () => {
      const entityCol = source === 'doctor' ? 'doctor_id' : 'clinic_id';
      const { data: rows, error } = await supabase
        .from(reviewTable)
        .select(`id, ${entityCol}, patient_id, rating, comment, is_approved, created_at`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const reviewRows = (rows || []) as ReviewRow[];
      if (reviewRows.length === 0) return [] as AdminReview[];

      const patientIds = isModerator
        ? []
        : [...new Set(reviewRows.map((row) => row.patient_id).filter(Boolean))];
      const { data: patients } = patientIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', patientIds)
        : { data: [] as ReviewProfile[] };
      const patientName = new Map(((patients || []) as ReviewProfile[]).map((profile) => [profile.id, profile.full_name]));

      if (source === 'clinic') {
        const clinicIds = [...new Set(reviewRows.map((row) => row.clinic_id).filter((id): id is string => Boolean(id)))];
        const { data: clinicRows } = clinicIds.length
          ? await supabase.from('clinics').select('id, name').in('id', clinicIds)
          : { data: [] as ReviewClinic[] };
        const clinicName = new Map(((clinicRows || []) as ReviewClinic[]).map((clinic) => [clinic.id, clinic.name]));
        return reviewRows.map((row): AdminReview => ({
          ...row,
          verified: row.is_approved,
          patient: { full_name: patientName.get(row.patient_id) || null },
          doctor: { specialty: null, profile: { full_name: row.clinic_id ? clinicName.get(row.clinic_id) || null : null } },
        }));
      }

      const doctorIds = [...new Set(reviewRows.map((row) => row.doctor_id).filter((id): id is string => Boolean(id)))];
      const { data: doctorRows } = doctorIds.length
        ? await supabase.from('doctors').select('id, user_id, specialty').in('id', doctorIds)
        : { data: [] as ReviewDoctor[] };
      const typedDoctors = (doctorRows || []) as ReviewDoctor[];
      const docUserIds = [...new Set(typedDoctors.map((doctor) => doctor.user_id).filter((id): id is string => Boolean(id)))];
      const { data: doctorProfiles } = docUserIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', docUserIds)
        : { data: [] as ReviewProfile[] };

      const doctorById = new Map(typedDoctors.map((doctor) => [doctor.id, doctor]));
      const doctorNameByUserId = new Map(((doctorProfiles || []) as ReviewProfile[]).map((profile) => [profile.id, profile.full_name]));

      return reviewRows.map((row): AdminReview => {
        const doctor = row.doctor_id ? doctorById.get(row.doctor_id) : undefined;
        return {
          ...row,
          verified: row.is_approved,
          patient: { full_name: patientName.get(row.patient_id) || null },
          doctor: {
            specialty: doctor?.specialty || null,
            profile: { full_name: doctor?.user_id ? doctorNameByUserId.get(doctor.user_id) || null : null },
          },
        };
      });
    },
  });

  // Apply the search box client-side: match patient name, doctor name,
  // specialty or comment text. Previously `search` was wired into the query key
  // but never used as a filter, so the box did nothing.
  const filteredReviews = (() => {
    const q = search.trim().toLowerCase();
    if (!q || !reviews) return reviews;
    return reviews.filter((review) =>
      [
        review.patient?.full_name,
        review.doctor?.profile?.full_name,
        review.doctor?.specialty,
        review.comment,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  })();

  const toggleVerifiedMutation = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { error } = await supabase
        .from(reviewTable)
        .update({ is_approved: !verified })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success(t('adminReviews.statusChanged'));
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t('adminReviews.statusError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(reviewTable)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      toast.success(t('adminReviews.deleted'));
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t('adminReviews.deleteError'));
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('adminReviews.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('adminReviews.subtitle')}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={source === 'doctor' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSource('doctor')}
          >
            {t('adminReviews.tabDoctors')}
          </Button>
          <Button
            variant={source === 'clinic' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSource('clinic')}
          >
            {t('adminReviews.tabClinics')}
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('adminReviews.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border text-foreground"
          />
        </div>

        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t('adminReviews.colDate')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminReviews.colPatient')}</TableHead>
                <TableHead className="text-muted-foreground">
                  {source === 'clinic' ? t('adminReviews.colClinic') : t('adminReviews.colDoctor')}
                </TableHead>
                <TableHead className="text-muted-foreground">{t('adminReviews.colRating')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminReviews.colComment')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminReviews.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminReviews.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('admin.loading')}
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('adminReviews.loadError')}
                  </TableCell>
                </TableRow>
              ) : filteredReviews?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('adminReviews.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredReviews?.map((review) => (
                  <TableRow key={review.id} className="border-border hover:bg-accent/50">
                    <TableCell className="text-muted-foreground">
                      {new Date(review.created_at!).toLocaleDateString(dateLocale)}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {isModerator ? 'Скрыто' : review.patient?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-foreground">{review.doctor?.profile?.full_name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{review.doctor?.specialty || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span className="text-foreground">{review.rating}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {review.comment || t('adminReviews.noComment')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={review.verified ? 'default' : 'secondary'}>
                        {review.verified ? t('adminReviews.statusPublished') : t('adminReviews.statusHidden')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            toggleVerifiedMutation.mutate({
                              id: review.id,
                              verified: review.verified || false,
                            })
                          }
                        >
                          {review.verified ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('adminReviews.confirmDeleteTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('adminReviews.confirmDeleteBody')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(review.id)}
                              >
                                {t('admin.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
