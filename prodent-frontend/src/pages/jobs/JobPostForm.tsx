import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { jobs } from "@/lib/jobs";
import { JOBS_ROUTES } from "@/lib/jobs-routes";
import { JobsLocationSelect } from "@/components/jobs/JobsLocationSelect";
import { MobileActionBar } from "@/components/system/MobileActionBar";
import {
  CATEGORY_OPTIONS, COOPERATION_OPTIONS, EMPLOYMENT_OPTIONS, SALARY_MODE_OPTIONS,
} from "@/lib/jobs-constants";

type FormValue = string | number | boolean | null | undefined;
type Form = Record<string, FormValue>;
type JobsApiError = { message?: string } | Error | unknown;

const errorMessage = (error: JobsApiError, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const RENTAL_PERIODS = [
  { value: "daily", label: "в день" },
  { value: "weekly", label: "в неделю" },
  { value: "monthly", label: "в месяц" },
];

export default function JobPostForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const [f, setF] = useState<Form>({
    listing_type: "vacancy",
    category: "dentist_therapist",
    employment_type: "full_time",
    cooperation_type: "staff_doctor",
    salary_mode: "percent",
    currency: "UZS",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const l = await jobs.getListing(id!);
        setF(l);
      } catch (e: JobsApiError) {
        toast.error(errorMessage(e, "Не удалось загрузить"));
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, id]);

  const set = (k: string, v: FormValue) => setF((p) => ({ ...p, [k]: v }));
  const isRental = f.listing_type === "chair_rental";

  const submit = async () => {
    if (!f.title?.trim()) { toast.error("Укажите заголовок"); return; }
    setSaving(true);
    // Keep only the fields relevant to the chosen type.
    const payload: Form = {
      listing_type: f.listing_type,
      category: isRental ? "chair_rental" : f.category,
      title: f.title,
      description: f.description,
      requirements: f.requirements,
      city: f.city,
      district: f.district,
      contact_name: f.contact_name,
      contact_phone: f.contact_phone,
      currency: f.currency || "UZS",
      status: f.status || "published",
    };
    if (isRental) {
      payload.cooperation_type = "chair_rental";
      payload.rental_fee = numOrNull(f.rental_fee);
      payload.rental_period = f.rental_period || "monthly";
    } else {
      payload.employment_type = f.employment_type;
      payload.cooperation_type = f.cooperation_type;
      if (f.cooperation_type === "chair_rental") {
        // A vacancy offered on chair-rental terms (common in dentistry).
        payload.rental_fee = numOrNull(f.rental_fee);
        payload.rental_period = f.rental_period || "monthly";
      } else {
        payload.salary_mode = f.salary_mode;
        if (f.salary_mode === "percent") payload.salary_percent = numOrNull(f.salary_percent);
        if (f.salary_mode === "fixed") {
          payload.salary_min = numOrNull(f.salary_min);
          payload.salary_max = numOrNull(f.salary_max);
        }
      }
    }
    try {
      const saved = editing ? await jobs.updateListing(id!, payload) : await jobs.createListing(payload);
      toast.success(editing ? "Вакансия обновлена" : "Вакансия опубликована");
      navigate(JOBS_ROUTES.listing(saved.id));
    } catch (e: JobsApiError) {
      toast.error(errorMessage(e, "Не удалось сохранить"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Загрузка…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">{editing ? "Редактировать объявление" : "Новое объявление"}</h1>

      <div className="space-y-5 rounded-prodent border border-border bg-card p-4 shadow-design-card sm:p-6">
        {/* Type toggle */}
        <div>
          <Label>Тип объявления</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[{ v: "vacancy", l: "Вакансия" }, { v: "chair_rental", l: "Аренда кресла" }].map((t) => (
              <button key={t.v} type="button" onClick={() => set("listing_type", t.v)}
                className={`rounded-prodent-input px-4 py-2 text-sm font-medium transition ${
                  f.listing_type === t.v ? "bg-brand text-white shadow-design-btn" : "bg-muted text-muted-foreground hover:bg-muted"}`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {!isRental && (
          <Field label="Специальность">
            <Select value={f.category} onChange={(v) => set("category", v)} options={CATEGORY_OPTIONS.filter((o) => o.value !== "chair_rental")} />
          </Field>
        )}

        <Field label="Заголовок *">
          <Input value={f.title || ""} onChange={(e) => set("title", e.target.value)} placeholder={isRental ? "Сдаётся стоматологическое кресло" : "Врач-стоматолог терапевт"} />
        </Field>

        <Field label="Описание">
          <Textarea rows={4} value={f.description || ""} onChange={(e) => set("description", e.target.value)} />
        </Field>

        {!isRental && (
          <Field label="Требования">
            <Textarea rows={3} value={f.requirements || ""} onChange={(e) => set("requirements", e.target.value)} />
          </Field>
        )}

        <JobsLocationSelect
          region={f.city}
          district={f.district}
          onRegionChange={(v) => set("city", v)}
          onDistrictChange={(v) => set("district", v)}
        />

        {/* Conditional terms */}
        {isRental ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Стоимость аренды"><Input type="number" value={f.rental_fee || ""} onChange={(e) => set("rental_fee", e.target.value)} placeholder="0 = бесплатно" /></Field>
            <Field label="Период"><Select value={f.rental_period || "monthly"} onChange={(v) => set("rental_period", v)} options={RENTAL_PERIODS} /></Field>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Занятость"><Select value={f.employment_type} onChange={(v) => set("employment_type", v)} options={EMPLOYMENT_OPTIONS} /></Field>
              <Field label="Тип сотрудничества"><Select value={f.cooperation_type} onChange={(v) => set("cooperation_type", v)} options={COOPERATION_OPTIONS} /></Field>
            </div>
            {f.cooperation_type === "chair_rental" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Стоимость аренды"><Input type="number" value={f.rental_fee || ""} onChange={(e) => set("rental_fee", e.target.value)} placeholder="0 = бесплатно" /></Field>
                <Field label="Период"><Select value={f.rental_period || "monthly"} onChange={(v) => set("rental_period", v)} options={RENTAL_PERIODS} /></Field>
              </div>
            ) : (
              <>
                <Field label="Оплата"><Select value={f.salary_mode} onChange={(v) => set("salary_mode", v)} options={SALARY_MODE_OPTIONS} /></Field>
                {f.salary_mode === "percent" && (
                  <Field label="Процент врачу, %"><Input type="number" value={f.salary_percent || ""} onChange={(e) => set("salary_percent", e.target.value)} /></Field>
                )}
                {f.salary_mode === "fixed" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Оклад от"><Input type="number" value={f.salary_min || ""} onChange={(e) => set("salary_min", e.target.value)} /></Field>
                    <Field label="Оклад до"><Input type="number" value={f.salary_max || ""} onChange={(e) => set("salary_max", e.target.value)} /></Field>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Контактное лицо"><Input value={f.contact_name || ""} onChange={(e) => set("contact_name", e.target.value)} /></Field>
          <Field label="Телефон"><Input value={f.contact_phone || ""} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+998…" /></Field>
        </div>

        <div className="hidden flex-wrap gap-3 pt-2 md:flex">
          <Button onClick={submit} disabled={saving}>{saving ? "Сохранение…" : editing ? "Сохранить" : "Опубликовать"}</Button>
          <Button variant="outline" onClick={() => navigate(JOBS_ROUTES.my())}>Отмена</Button>
        </div>
      </div>
      <MobileActionBar label="Действия объявления" className="[&>*]:flex-1">
        <Button onClick={submit} disabled={saving}>{saving ? "Сохранение…" : editing ? "Сохранить" : "Опубликовать"}</Button>
        <Button variant="outline" onClick={() => navigate(JOBS_ROUTES.my())}>Отмена</Button>
      </MobileActionBar>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block break-words text-sm font-medium leading-none">{label}</span>
      {children}
    </label>
  );
}
function Select({ value, onChange, options }: { value?: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-prodent-input border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function numOrNull(v: FormValue): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
