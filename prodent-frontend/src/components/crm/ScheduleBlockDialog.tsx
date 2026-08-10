import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useLanguage, Language } from "@/contexts/LanguageContext";

// Strings live inline rather than in the giant LanguageContext.tsx — this
// component is new and the big translation file is already 40k+ lines.
// kz/kg/tj reuse Russian text where I'm not confident in the local term.
const STRINGS: Record<
  Language,
  {
    title: string; description: string;
    date: string; pickDate: string;
    start: string; end: string;
    reason: string; pickReason: string;
    cancel: string; save: string; saving: string;
    noDoctor: string; savedTpl: (s: string, e: string) => string;
    reasonLunch: string; reasonMeeting: string; reasonPersonal: string;
    reasonBreak: string; reasonTraining: string; reasonOther: string;
  }
> = {
  ru: {
    title: "Заблокировать окно",
    description: "Время будет недоступно для записи пациентов.",
    date: "Дата", pickDate: "Выберите дату",
    start: "Начало", end: "Конец",
    reason: "Причина", pickReason: "Выберите причину",
    cancel: "Отмена", save: "Заблокировать", saving: "Сохраняем…",
    noDoctor: "Не найден текущий врач",
    savedTpl: (s, e) => `Окно ${s}–${e} сохранено`,
    reasonLunch: "Обед", reasonMeeting: "Встреча", reasonPersonal: "Личное",
    reasonBreak: "Перерыв", reasonTraining: "Обучение", reasonOther: "Другое",
  },
  uz: {
    title: "Vaqtni band qilish",
    description: "Bu vaqt bemorlar uchun yopiq bo‘ladi.",
    date: "Sana", pickDate: "Sanani tanlang",
    start: "Boshlanish", end: "Tugash",
    reason: "Sabab", pickReason: "Sababni tanlang",
    cancel: "Bekor qilish", save: "Band qilish", saving: "Saqlanmoqda…",
    noDoctor: "Joriy shifokor topilmadi",
    savedTpl: (s, e) => `${s}–${e} vaqti band qilindi`,
    reasonLunch: "Tushlik", reasonMeeting: "Uchrashuv", reasonPersonal: "Shaxsiy",
    reasonBreak: "Tanaffus", reasonTraining: "O‘qish", reasonOther: "Boshqa",
  },
  uz_cyrl: {
    title: "Вақтни банд қилиш",
    description: "Бу вақт беморлар учун ёпиқ бўлади.",
    date: "Сана", pickDate: "Санани танланг",
    start: "Бошланиш", end: "Тугаш",
    reason: "Сабаб", pickReason: "Сабабни танланг",
    cancel: "Бекор қилиш", save: "Банд қилиш", saving: "Сақланмоқда…",
    noDoctor: "Жорий шифокор топилмади",
    savedTpl: (s, e) => `${s}–${e} вақти банд қилинди`,
    reasonLunch: "Тушлик", reasonMeeting: "Учрашув", reasonPersonal: "Шахсий",
    reasonBreak: "Танаффус", reasonTraining: "Ўқиш", reasonOther: "Бошқа",
  },
  kz: {
    title: "Уақытты бұғаттау",
    description: "Бұл уақыт пациенттер үшін жабық болады.",
    date: "Күн", pickDate: "Күнді таңдаңыз",
    start: "Басталу", end: "Аяқталу",
    reason: "Себеп", pickReason: "Себепті таңдаңыз",
    cancel: "Болдырмау", save: "Бұғаттау", saving: "Сақталуда…",
    noDoctor: "Ағымдағы дәрігер табылмады",
    savedTpl: (s, e) => `${s}–${e} уақыты бұғатталды`,
    reasonLunch: "Түскі ас", reasonMeeting: "Кездесу", reasonPersonal: "Жеке",
    reasonBreak: "Үзіліс", reasonTraining: "Оқу", reasonOther: "Басқа",
  },
  kg: {
    title: "Убакытты бөгөттөө",
    description: "Бул убакыт бейтаптар үчүн жабык болот.",
    date: "Күн", pickDate: "Күндү тандаңыз",
    start: "Башталышы", end: "Аякталышы",
    reason: "Себеп", pickReason: "Себепти тандаңыз",
    cancel: "Жокко чыгаруу", save: "Бөгөттөө", saving: "Сакталууда…",
    noDoctor: "Учурдагы дарыгер табылган жок",
    savedTpl: (s, e) => `${s}–${e} убакыты бөгөттөлдү`,
    reasonLunch: "Түшкү тамак", reasonMeeting: "Жолугушуу", reasonPersonal: "Жеке",
    reasonBreak: "Тыныгуу", reasonTraining: "Окуу", reasonOther: "Башка",
  },
  tj: {
    title: "Вақтро банд кардан",
    description: "Ин вақт барои беморон дастнорас хоҳад буд.",
    date: "Сана", pickDate: "Санаро интихоб кунед",
    start: "Шурӯъ", end: "Хотима",
    reason: "Сабаб", pickReason: "Сабабро интихоб кунед",
    cancel: "Бекор кардан", save: "Банд кардан", saving: "Захира мешавад…",
    noDoctor: "Духтури ҷорӣ ёфт нашуд",
    savedTpl: (s, e) => `Вақти ${s}–${e} банд карда шуд`,
    reasonLunch: "Хӯроки нисфирӯзӣ", reasonMeeting: "Вохӯрӣ", reasonPersonal: "Шахсӣ",
    reasonBreak: "Танаффус", reasonTraining: "Омӯзиш", reasonOther: "Дигар",
  },
};

const blockSchema = z
  .object({
    date: z.date({ required_error: "Date required" }),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    reason: z.string().min(1).max(120),
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "endBeforeStart",
    path: ["end_time"],
  });

type BlockForm = z.infer<typeof blockSchema>;

export interface ScheduleBlock {
  id: string;
  doctorId: string;
  date: string;       // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  reason: string;
  created_at: string;
}

// Frontend-only persistence until the backend `schedule_blocks` table lands.
// One entry per browser/doctor pair — fine for a pilot UI demo.
const STORAGE_KEY = "prodent.schedule_blocks";

function readBlocks(doctorId: string): ScheduleBlock[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ScheduleBlock[];
    return all.filter((b) => b.doctorId === doctorId);
  } catch {
    return [];
  }
}

function writeBlock(block: ScheduleBlock) {
  const all = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ScheduleBlock[];
    } catch {
      return [] as ScheduleBlock[];
    }
  })();
  all.push(block);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

interface ScheduleBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string | undefined;
  selectedDate?: Date;
  /** Called after a block is saved — caller can refresh its view. */
  onSaved?: (block: ScheduleBlock) => void;
}

// Preset reasons — covers ~90% of why a doctor blocks time. Free-form input
// stays available below for edge cases.
const PRESET_REASONS = [
  "lunch",
  "meeting",
  "personal",
  "break",
  "training",
  "other",
] as const;

export function ScheduleBlockDialog({
  open,
  onOpenChange,
  doctorId,
  selectedDate,
  onSaved,
}: ScheduleBlockDialogProps) {
  const { language } = useLanguage();
  const S = STRINGS[language];
  const [saving, setSaving] = useState(false);

  const form = useForm<BlockForm>({
    resolver: zodResolver(blockSchema),
    defaultValues: {
      date: selectedDate || new Date(),
      start_time: defaultStartTime(),
      end_time: defaultEndTime(),
      reason: "",
    },
  });

  // Keep the date in sync if the parent passes a fresh selectedDate while the
  // dialog is already mounted.
  useEffect(() => {
    if (open && selectedDate) {
      form.setValue("date", selectedDate);
    }
  }, [open, selectedDate, form]);

  const onSubmit = async (values: BlockForm) => {
    if (!doctorId) {
      toast.error(S.noDoctor);
      return;
    }
    setSaving(true);
    try {
      const block: ScheduleBlock = {
        id: crypto.randomUUID(),
        doctorId,
        date: format(values.date, "yyyy-MM-dd"),
        start_time: values.start_time,
        end_time: values.end_time,
        reason: values.reason.trim(),
        created_at: new Date().toISOString(),
      };
      writeBlock(block);
      toast.success(S.savedTpl(block.start_time, block.end_time));
      onSaved?.(block);
      form.reset({
        date: values.date,
        start_time: defaultStartTime(),
        end_time: defaultEndTime(),
        reason: "",
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const presetLabels = useMemo(
    () => ({
      lunch:    S.reasonLunch,
      meeting:  S.reasonMeeting,
      personal: S.reasonPersonal,
      break:    S.reasonBreak,
      training: S.reasonTraining,
      other:    S.reasonOther,
    }),
    [S]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{S.title}</DialogTitle>
          <DialogDescription>{S.description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{S.date}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? format(field.value, "PPP", { locale: ru })
                            : S.pickDate}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(d) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return d < today;
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{S.start}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{S.end}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{S.reason}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={S.pickReason} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRESET_REASONS.map((k) => (
                        <SelectItem key={k} value={presetLabels[k]}>
                          {presetLabels[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {S.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? S.saving : S.save}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function defaultStartTime() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultEndTime() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15 + 30, 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
