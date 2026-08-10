import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { openPrivatePatientFile } from "@/lib/patient-cabinet";
import { lab, type LabOrderFile } from "@/lib/lab";
import { getErrorMessage } from "@/lib/edge-function-error";
import { Button } from "@/components/ui/button";
import { DesignCard, SectionTitle } from "@/components/design";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.stl,.ply,.obj,.3mf,.dcm,.dicom";

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function LabOrderFilesPanel({
  orderId,
  readOnly = false,
}: {
  orderId: string;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [files, setFiles] = useState<LabOrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFiles(await lab.listOrderFiles(orderId));
    } catch (loadError: unknown) {
      setFiles([]);
      setError(getErrorMessage(loadError, language === "uz" ? "Fayllar yuklanmadi" : "Не удалось загрузить файлы"));
    } finally {
      setLoading(false);
    }
  }, [language, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    if (!user?.id || busy) return;
    if (!navigator.onLine) {
      toast({ title: language === "uz" ? "Internet aloqasini tekshiring" : "Проверьте подключение к интернету", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast({ title: language === "uz" ? "Fayl 50 MB dan katta" : "Файл больше 50 МБ", variant: "destructive" });
      return;
    }

    setBusy(true);
    const storageKey = `${user.id}/lab-orders/${orderId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    try {
      const uploaded = await supabase.storage.from("documents").upload(storageKey, file);
      if (uploaded.error || !uploaded.data?.path) {
        throw new Error(uploaded.error?.message || "upload_failed");
      }
      try {
        await lab.registerOrderFile(orderId, {
          file_name: file.name,
          storage_key: uploaded.data.path,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        });
      } catch (metadataError) {
        await supabase.storage.from("documents").remove([uploaded.data.path]);
        throw metadataError;
      }
      await load();
      toast({ title: language === "uz" ? "Fayl qo‘shildi" : "Файл добавлен" });
    } catch (uploadError: unknown) {
      toast({
        title: language === "uz" ? "Fayl yuklanmadi" : "Файл не загружен",
        description: getErrorMessage(uploadError, ""),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const open = async (file: LabOrderFile) => {
    try {
      await openPrivatePatientFile(`/api/v1/storage/documents/${file.storage_key}`);
    } catch (openError: unknown) {
      toast({
        title: language === "uz" ? "Fayl ochilmadi" : "Файл не открылся",
        description: getErrorMessage(openError, ""),
        variant: "destructive",
      });
    }
  };

  const remove = async (file: LabOrderFile) => {
    setBusy(true);
    try {
      await lab.deleteOrderFile(orderId, file.id);
      await load();
    } catch (removeError: unknown) {
      toast({
        title: language === "uz" ? "Fayl o‘chirilmadi" : "Файл не удалён",
        description: getErrorMessage(removeError, ""),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DesignCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle subtitle={language === "uz" ? "skanlar va hujjatlar" : "сканы и документы"}>
          {language === "uz" ? "Fayllar" : "Файлы"}
        </SectionTitle>
        {!readOnly && (
          <Button asChild size="sm" disabled={busy}>
            <label className="cursor-pointer">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {language === "uz" ? "Fayl qo‘shish" : "Добавить файл"}
              <input
                className="sr-only"
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {language === "uz" ? "Fayllar yuklanmoqda…" : "Загрузка файлов…"}
          </div>
        ) : error ? (
          <div className="space-y-2 py-5 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              {language === "uz" ? "Qayta urinish" : "Повторить"}
            </Button>
          </div>
        ) : files.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 h-5 w-5" />
            {language === "uz" ? "Hozircha fayllar yo‘q." : "Файлов пока нет."}
          </div>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm" title={file.file_name}>{file.file_name}</span>
                <Button variant="ghost" size="icon" onClick={() => void open(file)} aria-label={language === "uz" ? "Faylni ochish" : "Открыть файл"}>
                  <Download className="h-4 w-4" />
                </Button>
                {!readOnly && (
                  <Button variant="ghost" size="icon" disabled={busy} onClick={() => void remove(file)} aria-label={language === "uz" ? "Faylni o‘chirish" : "Удалить файл"}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DesignCard>
  );
}
