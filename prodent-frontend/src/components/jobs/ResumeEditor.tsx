import { useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { jobs } from "@/lib/jobs";
import {
  CATEGORY_OPTIONS, COOPERATION_OPTIONS, EMPLOYMENT_OPTIONS,
} from "@/lib/jobs-constants";
import { JobsLocationSelect } from "@/components/jobs/JobsLocationSelect";

type FormValue = string | number | boolean | string[] | null | undefined;
type Form = Record<string, FormValue>;

interface ResumeApiError {
  message?: string;
}

const errorMessage = (error: ResumeApiError, fallback: string) => error.message || fallback;

const VISIBILITY = [
  { value: "public", label: "Видно всем" },
  { value: "clinics_only", label: "Только клиникам" },
  { value: "hidden", label: "Скрыто" },
];

export default function ResumeEditor() {
  const [f, setF] = useState<Form>({
    category: "dentist_therapist",
    desired_cooperation_type: "staff_doctor",
    desired_employment_type: "full_time",
    visibility: "public",
    is_open_to_work: true,
    relocation: false,
    currency: "UZS",
  });
  const [skillsText, setSkillsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDraft, setIsDraft] = useState(false); // prefilled from the doctor profile, not yet saved
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await jobs.getMyResume();
        if (r) {
          setF(r);
          setIsDraft(!!r.is_draft);
          if (Array.isArray(r.skills)) setSkillsText(r.skills.join(", "));
        }
      } catch { /* none yet */ }
      finally { setLoading(false); }
    })();
  }, []);

  const set = (k: string, v: FormValue) => setF((p) => ({ ...p, [k]: v }));

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `resumes/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from("avatars").upload(fileName, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(data.path);
      set("photo_url", pub.publicUrl);
      toast.success("Фото загружено");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : undefined) || "Не удалось загрузить фото");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const payload: Form = {
      category: f.category,
      headline: f.headline,
      summary: f.summary,
      experience_years: numOrNull(f.experience_years),
      experience_text: f.experience_text,
      education_text: f.education_text,
      skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
      desired_employment_type: f.desired_employment_type,
      desired_cooperation_type: f.desired_cooperation_type,
      desired_salary: numOrNull(f.desired_salary),
      currency: f.currency || "UZS",
      city: f.city,
      district: f.district,
      relocation: !!f.relocation,
      photo_url: f.photo_url,
      contact_phone: f.contact_phone,
      visibility: f.visibility,
      is_open_to_work: !!f.is_open_to_work,
    };
    try {
      const saved = await jobs.upsertResume(payload);
      setF(saved);
      setIsDraft(false);
      toast.success("Резюме сохранено");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : undefined) || "Не удалось сохранить резюме");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Загрузка…</p>;

  return (
    <div className="max-w-2xl space-y-5 rounded-prodent border border-border bg-card p-4 shadow-design-card sm:p-6">
      {isDraft && (
        <div className="rounded-xl border border-brand/40 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Данные подставлены из вашего профиля врача. Проверьте, дополните job-поля (зарплата, формат, навыки) и нажмите «Сохранить», чтобы опубликовать резюме.
        </div>
      )}
      {/* Photo + open-to-work */}
      <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
        {f.photo_url
          ? <img src={f.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          : <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground/70"><UserRound className="h-8 w-8" /></div>}
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            <span className="ml-1.5">Загрузить фото</span>
          </Button>
        </div>
        <label className="flex w-full min-w-0 items-center gap-2 text-sm text-muted-foreground sm:ml-auto sm:w-auto">
          <Switch checked={!!f.is_open_to_work} onCheckedChange={(v) => set("is_open_to_work", v)} />
          Открыт к работе
        </label>
      </div>

      <Field label="Специальность"><Select value={f.category} onChange={(v) => set("category", v)} options={CATEGORY_OPTIONS} /></Field>
      <JobsLocationSelect
        region={f.city}
        district={f.district}
        onRegionChange={(v) => set("city", v)}
        onDistrictChange={(v) => set("district", v)}
      />

      <Field label="Заголовок резюме"><Input value={f.headline || ""} onChange={(e) => set("headline", e.target.value)} placeholder="Стоматолог-терапевт, 5 лет опыта" /></Field>
      <Field label="О себе"><Textarea rows={3} value={f.summary || ""} onChange={(e) => set("summary", e.target.value)} /></Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Опыт, лет"><Input type="number" value={f.experience_years ?? ""} onChange={(e) => set("experience_years", e.target.value)} /></Field>
        <Field label="Желаемая занятость"><Select value={f.desired_employment_type} onChange={(v) => set("desired_employment_type", v)} options={EMPLOYMENT_OPTIONS} /></Field>
      </div>

      <Field label="Опыт работы (текст)"><Textarea rows={3} value={f.experience_text || ""} onChange={(e) => set("experience_text", e.target.value)} /></Field>
      <Field label="Образование"><Textarea rows={2} value={f.education_text || ""} onChange={(e) => set("education_text", e.target.value)} /></Field>
      <Field label="Навыки (через запятую)"><Input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="эндодонтия, имплантация, …" /></Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Формат сотрудничества"><Select value={f.desired_cooperation_type} onChange={(v) => set("desired_cooperation_type", v)} options={COOPERATION_OPTIONS} /></Field>
        <Field label="Ожидания по з/п"><Input type="number" value={f.desired_salary ?? ""} onChange={(e) => set("desired_salary", e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Телефон для связи"><Input value={f.contact_phone || ""} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+998…" /></Field>
        <Field label="Видимость"><Select value={f.visibility} onChange={(v) => set("visibility", v)} options={VISIBILITY} /></Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={!!f.relocation} onCheckedChange={(v) => set("relocation", v)} />
        Готов к переезду
      </label>

      <Button onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить резюме"}</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><Label className="mb-1.5 block break-words">{label}</Label>{children}</div>;
}
function Select({ value, onChange, options }: { value?: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-prodent-input border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function numOrNull(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
