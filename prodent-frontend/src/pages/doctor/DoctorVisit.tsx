import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DoctorLayout } from "@/components/doctor/DoctorLayout";
import { SmartDentalChart } from "@/components/crm/SmartDentalChart";
import { DoctorTreatmentPlanCreateFlow } from "@/components/crm/treatment/DoctorTreatmentPlanCreateFlow";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { cn, formatPrice } from "@/lib/utils";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import {
  clearPersistentClientRequestId,
  createClinicInvoice,
  getPersistentClientRequestId,
} from "@/lib/crm-operations-api";
import {
  buildMedicalRecordNotes,
  canEditDoctorVisitDraft,
  canFinishDoctorVisit,
  clearDoctorVisitDraft,
  createEmptyDoctorVisitDraft,
  hasDoctorVisitDraftContent,
  loadDoctorVisitDraft,
  parseMedicalRecordNotes,
  reconcileDoctorVisitDrafts,
  saveDoctorVisitDraft,
  shouldClearDoctorVisitDraftForAccessStatus,
  type DoctorVisitDraft,
} from "@/lib/doctor-visit-draft";
import {
  addVisitFile,
  DoctorVisitApiError,
  getVisitDocument,
  getVisitHistory,
  saveVisitDraft,
  type VisitDocument,
} from "@/lib/doctor-visit-api";
import { buildDoctorLabOrderPath } from "@/lib/lab-order-links";
import { formatDate, formatTime } from "@/lib/localization";
import { formatPatientCardId } from "@/lib/accountId";
import {
  Banknote,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ClipboardList,
  Edit2,
  FlaskConical,
  Loader2,
  Mic,
  Pause,
  Play,
  Printer,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Appointment {
  id: string;
  appointment_date: string;
  service: string | null;
  service_id: string | null;
  /** Set by the server when the appointment completes; invoices must equal it. */
  total_price: number | null;
  status: string;
  notes: string | null;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
}

interface PrevVisit {
  id: string;
  appointment_date: string;
  service: string | null;
  status: string;
}

const ChipTag = ({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "rose" | "amber" | "teal" | "slate";
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
      tone === "rose" && "bg-status-danger-bg text-status-danger",
      tone === "amber" && "bg-status-warning-bg text-status-warning",
      tone === "teal" &&
        "bg-primary/10 text-primary",
      tone === "slate" && "bg-muted text-muted-foreground"
    )}
  >
    {children}
  </span>
);

const SectionTitle = ({
  children,
  subtitle,
  right,
  className,
}: {
  children: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
    <div>
      <div className="font-heading text-base font-semibold text-foreground">
        {children}
      </div>
      {subtitle && (
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      )}
    </div>
    {right}
  </div>
);

function visitDocumentToDraft(document: VisitDocument): DoctorVisitDraft {
  return {
    ...createEmptyDoctorVisitDraft(),
    ...parseMedicalRecordNotes(document.notes),
    diagnosis: document.diagnosis ?? "",
    anesthesia: document.anesthesia ?? "",
    procedures: document.treatment ?? "",
    privateNotes: document.privateNotes ?? "",
    serverVersion: document.version,
    updatedAt: document.updatedAt,
  };
}

function serverDraftBody(draft: DoctorVisitDraft, expectedVersion: number) {
  return {
    expectedVersion,
    diagnosis: draft.diagnosis.trim() || null,
    treatment: draft.procedures.trim() || null,
    anesthesia: draft.anesthesia.trim() || null,
    notes: buildMedicalRecordNotes(draft),
    privateNotes: draft.privateNotes.trim() || null,
  };
}

function serverDraftFingerprint(draft: DoctorVisitDraft): string {
  const { expectedVersion: _expectedVersion, ...content } = serverDraftBody(draft, 0);
  return JSON.stringify(content);
}

function isAccessError(error: unknown): error is DoctorVisitApiError {
  return error instanceof DoctorVisitApiError
    && shouldClearDoctorVisitDraftForAccessStatus(error.status);
}

export default function DoctorVisit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  /**
   * The five stages of a visit. Each step points at the place on the screen
   * where that stage is RECORDED — clicking a chip scrolls there and puts the
   * cursor into the field. `field` names the protocol textarea a step focuses;
   * steps 2 and 5 target whole cards (the dental chart, the payment block).
   */
  const VISIT_STEPS = [
    { id: 1, name: t("doctorVisit.stepAnamnesis"), field: "complaints" as const },
    { id: 2, name: t("doctorVisit.stepExam"), field: "examination" as const },
    { id: 3, name: t("doctorVisit.stepProcedure"), field: "procedures" as const },
    { id: 4, name: t("doctorVisit.stepNotes"), field: "recommendations" as const },
    { id: 5, name: t("doctorVisit.stepPayment"), field: null },
  ];
  const [activeStep, setActiveStep] = useState(1);
  const protocolFieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const chartCardRef = useRef<HTMLDivElement | null>(null);
  const paymentCardRef = useRef<HTMLDivElement | null>(null);
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState<DoctorVisitDraft>(
    createEmptyDoctorVisitDraft,
  );
  const [draftReady, setDraftReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [serverRecordId, setServerRecordId] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<"DRAFT" | "FINAL">("DRAFT");
  const [syncState, setSyncState] = useState<
    "loading" | "saved" | "saving" | "offline" | "conflict" | "error"
  >("loading");
  const [conflictDocument, setConflictDocument] =
    useState<VisitDocument | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<"xray" | "photo" | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const serverVersionRef = useRef(0);
  const lastServerPayloadRef = useRef("");
  const serverSavePromiseRef = useRef<Promise<VisitDocument> | null>(null);
  const visitGenerationRef = useRef(0);
  const finishLockRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const doctorUserId = user?.id ?? null;
  const setDraftField = (
    field: keyof Pick<
      DoctorVisitDraft,
      | "complaints"
      | "examination"
      | "diagnosis"
      | "anesthesia"
      | "procedures"
      | "recommendations"
      | "privateNotes"
    >,
    value: React.SetStateAction<string>,
  ) => {
    if (!canEditDoctorVisitDraft(finishLockRef.current)) return;
    setDraft((current) => ({
      ...current,
      [field]: typeof value === "function" ? value(current[field]) : value,
    }));
  };
  const { diagnosis, anesthesia } = draft;
  const notes = draft.privateNotes;
  const setDiagnosis = (value: React.SetStateAction<string>) =>
    setDraftField("diagnosis", value);
  const setAnesthesia = (value: React.SetStateAction<string>) =>
    setDraftField("anesthesia", value);
  const setNotes = (value: React.SetStateAction<string>) =>
    setDraftField("privateNotes", value);

  // Click → opens the hidden file picker. The choice of bucket affects only
  // the on-disk folder; both X-ray and clinical photo go through the same
  // storage endpoint with size + per-day limits already enforced server-side.
  const triggerUpload = (kind: "xray" | "photo") => {
    setUploadKind(kind);
    // Defer to next tick so the input's accept attribute (re-rendered below)
    // is the right one before we open the dialog.
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file || !appt?.patient_id) return;
    if (!serverRecordId) {
      toast.error(t("doctorVisit.waitForDraftSave"));
      return;
    }
    const kind = uploadKind ?? "photo";
    try {
      const authenticated = await supabase.auth.getUser();
      const userId = authenticated.data.user?.id;
      if (!userId) throw new Error("AUTH_REQUIRED");
      const ext = file.name.split(".").pop() || (kind === "xray" ? "jpg" : "png");
      const path = `${userId}/patients/${appt.patient_id}/visits/${id}/${kind}-${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (error) {
        toast.error(error.message || t("doctorVisit.uploadFailed"));
        return;
      }
      const storagePath = data?.path || path;
      try {
        await addVisitFile(serverRecordId, {
          file_name: file.name,
          storage_key: storagePath,
          content_type: file.type || null,
          size_bytes: file.size,
        });
      } catch (metadataError) {
        await supabase.storage.from("documents").remove([storagePath]);
        throw metadataError;
      }
      toast.success(
        kind === "xray"
          ? t("doctorVisit.xrayUploaded")
          : t("doctorVisit.photoUploaded")
      );
    } catch {
      toast.error(t("doctorVisit.uploadFailed"));
    } finally {
      setUploadKind(null);
    }
  };

  const { data: appt, isLoading } = useQuery({
    queryKey: ["doctor-visit-appt", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, appointment_date, service, service_id, total_price, status, notes, patient_id, doctor_id, clinic_id"
        )
        .eq("id", id!)
        .maybeSingle();
      return (data || null) as Appointment | null;
    },
    enabled: !!id,
  });

  const { data: patient } = useQuery({
    queryKey: ["visit-patient", appt?.patient_id],
    queryFn: async () => {
      if (!appt?.patient_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email, account_number")
        .eq("id", appt.patient_id)
        .maybeSingle();
      return data as {
        id: string;
        full_name: string | null;
        phone: string | null;
        email: string | null;
        account_number: string | null;
      } | null;
    },
    enabled: !!appt?.patient_id,
  });

  const { data: prevVisits } = useQuery({
    queryKey: ["visit-prev", appt?.patient_id, id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, service, status")
        .eq("patient_id", appt!.patient_id)
        .neq("id", id!)
        .order("appointment_date", { ascending: false })
        .limit(5);
      return (data || []) as PrevVisit[];
    },
    enabled: !!appt?.patient_id && !!id,
  });

  const { data: visitHistory = [] } = useQuery({
    queryKey: ["doctor-visit-history", serverRecordId],
    queryFn: () => getVisitHistory(serverRecordId!),
    enabled: !!serverRecordId,
  });

  const clearUnauthorizedDraft = useCallback((expectedGeneration: number) => {
    if (visitGenerationRef.current !== expectedGeneration) return;
    if (id && doctorUserId) {
      clearDoctorVisitDraft(window.sessionStorage, doctorUserId, id);
    }
    setDraft(createEmptyDoctorVisitDraft());
    setDraftReady(false);
    setConflictDocument(null);
    setServerRecordId(null);
    setServerStatus("DRAFT");
    serverVersionRef.current = 0;
    lastServerPayloadRef.current = "";
    setSyncState("error");
  }, [doctorUserId, id]);

  const pushDraft = useCallback(
    async (snapshot: DoctorVisitDraft): Promise<VisitDocument | null> => {
      const generation = visitGenerationRef.current;
      if (!id || !doctorUserId || !navigator.onLine || serverStatus === "FINAL") {
        return null;
      }
      if (serverSavePromiseRef.current) {
        await serverSavePromiseRef.current;
        if (visitGenerationRef.current !== generation) return null;
      }
      const fingerprint = serverDraftFingerprint(snapshot);
      if (fingerprint === lastServerPayloadRef.current) {
        setSyncState("saved");
        return null;
      }
      setSyncState("saving");
      const pending = saveVisitDraft(
        id,
        serverDraftBody(snapshot, serverVersionRef.current),
      );
      serverSavePromiseRef.current = pending;
      try {
        const saved = await pending;
        if (visitGenerationRef.current !== generation) return saved;
        serverVersionRef.current = saved.version;
        lastServerPayloadRef.current = fingerprint;
        setServerRecordId(saved.id);
        setServerStatus(saved.status);
        setSyncState("saved");
        setConflictDocument(null);
        saveDoctorVisitDraft(
          window.sessionStorage,
          doctorUserId,
          id,
          draftRef.current,
          saved.version,
        );
        return saved;
      } finally {
        if (serverSavePromiseRef.current === pending) {
          serverSavePromiseRef.current = null;
        }
      }
    },
    [doctorUserId, id, serverStatus],
  );

  useEffect(() => {
    if (authLoading) return;
    const generation = ++visitGenerationRef.current;
    serverSavePromiseRef.current = null;
    serverVersionRef.current = 0;
    lastServerPayloadRef.current = "";
    setServerRecordId(null);
    setServerStatus("DRAFT");
    setConflictDocument(null);
    setDraftReady(false);
    if (!id) {
      setDraft(createEmptyDoctorVisitDraft());
      return;
    }
    if (!doctorUserId) {
      setDraft(createEmptyDoctorVisitDraft());
      return;
    }
    let active = true;
    let accessDenied = false;
    const localDraft = loadDoctorVisitDraft(
      window.sessionStorage,
      doctorUserId,
      id,
    );
    serverVersionRef.current = localDraft.serverVersion ?? 0;
    setSyncState(navigator.onLine ? "loading" : "offline");

    if (!navigator.onLine) {
      setDraft(localDraft);
      setDraftReady(true);
      return () => {
        if (visitGenerationRef.current === generation) {
          visitGenerationRef.current += 1;
        }
      };
    }
    // Do not reveal device PHI until the server confirms this doctor may open
    // the appointment.
    setDraft(createEmptyDoctorVisitDraft());

    void getVisitDocument(id)
      .then((document) => {
        if (!active || visitGenerationRef.current !== generation) return;
        const remoteDraft = visitDocumentToDraft(document);
        const resolution = document.status === "FINAL"
          ? { kind: "server" as const, draft: remoteDraft }
          : reconcileDoctorVisitDrafts(remoteDraft, localDraft, document.version);
        serverVersionRef.current = document.version;
        lastServerPayloadRef.current = serverDraftFingerprint(remoteDraft);
        setServerRecordId(document.id);
        setServerStatus(document.status);
        setDraft(resolution.draft);
        if (resolution.kind === "conflict") {
          setConflictDocument(document);
          setSyncState("conflict");
        } else {
          setConflictDocument(null);
          saveDoctorVisitDraft(
            window.sessionStorage,
            doctorUserId,
            id,
            resolution.draft,
            document.version,
          );
          setSyncState("saved");
        }
      })
      .catch((error: unknown) => {
        if (!active || visitGenerationRef.current !== generation) return;
        if (isAccessError(error)) {
          accessDenied = true;
          clearUnauthorizedDraft(generation);
        } else if (error instanceof DoctorVisitApiError && error.status === 404) {
          serverVersionRef.current = 0;
          lastServerPayloadRef.current = serverDraftFingerprint(
            createEmptyDoctorVisitDraft(),
          );
          setDraft(localDraft);
          setSyncState("saved");
        } else {
          setDraft(localDraft);
          setSyncState("error");
        }
      })
      .finally(() => {
        if (
          active
          && !accessDenied
          && visitGenerationRef.current === generation
        ) {
          setDraftReady(true);
        }
      });
    return () => {
      active = false;
      if (visitGenerationRef.current === generation) {
        visitGenerationRef.current += 1;
      }
    };
  }, [authLoading, clearUnauthorizedDraft, doctorUserId, id]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    if (!id || !doctorUserId || !draftReady) return;
    const generation = visitGenerationRef.current;
    const localTimeout = window.setTimeout(() => {
      if (visitGenerationRef.current !== generation) return;
      saveDoctorVisitDraft(
        window.sessionStorage,
        doctorUserId,
        id,
        draft,
        conflictDocument ? draft.serverVersion : serverVersionRef.current,
      );
    }, 500);
    if (!isOnline || serverStatus === "FINAL" || conflictDocument) {
      if (!isOnline) setSyncState("offline");
      return () => window.clearTimeout(localTimeout);
    }
    const serverTimeout = window.setTimeout(() => {
      void pushDraft(draft).catch(async (error: unknown) => {
        if (visitGenerationRef.current !== generation) return;
        if (isAccessError(error)) {
          clearUnauthorizedDraft(generation);
        } else if (error instanceof DoctorVisitApiError && error.status === 409) {
          try {
            const current = await getVisitDocument(id);
            if (visitGenerationRef.current !== generation) return;
            serverVersionRef.current = current.version;
            setConflictDocument(current);
            setSyncState("conflict");
          } catch (refreshError: unknown) {
            if (visitGenerationRef.current !== generation) return;
            if (isAccessError(refreshError)) {
              clearUnauthorizedDraft(generation);
            }
            else setSyncState("error");
          }
        } else {
          setSyncState("error");
        }
      });
    }, 900);
    return () => {
      window.clearTimeout(localTimeout);
      window.clearTimeout(serverTimeout);
    };
  }, [
    conflictDocument,
    clearUnauthorizedDraft,
    draft,
    draftReady,
    doctorUserId,
    id,
    isOnline,
    pushDraft,
    serverStatus,
  ]);

  // One server transaction completes the appointment and saves its clinical
  /**
   * Step 5 — payment. Roles are asymmetric BY DESIGN and the UI must not lie
   * about them: the backend admits only CLINIC_ADMIN / CLINIC_MANAGER /
   * ACCOUNTANT (and the clinic owner) to `finance` writes, and explicit
   * member-permission rows cannot widen that — so a plain doctor can never
   * issue the invoice, and showing them a button would be a dead control.
   * With rights, an invoice tied to the appointment is only accepted once the
   * appointment is COMPLETED and with subtotal exactly equal to the
   * server-computed total_price; guests (no users.id) cannot be invoiced at
   * all. Each of those server rules is a distinct, honest UI state below.
   */
  const { canEdit: canEditModule } = useModulePermissions();
  const canIssueInvoice = canEditModule("finance");
  const [issuedInvoice, setIssuedInvoice] = useState<{
    id: string;
    number: string;
  } | null>(null);

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      if (!appt?.patient_id) throw new Error("guest appointment");
      const subtotal = Number(appt.total_price);
      if (!Number.isFinite(subtotal) || subtotal <= 0) {
        throw new Error("no billable total");
      }
      const actionKey = `visit-invoice:${appt.id}`;
      const actor = user?.id ?? "anonymous";
      const clientRequestId = getPersistentClientRequestId(
        actor,
        appt.clinic_id,
        actionKey,
      );
      const row = await createClinicInvoice(appt.clinic_id, {
        clientRequestId,
        patientId: appt.patient_id,
        appointmentId: appt.id,
        subtotal,
        notes: appt.service || undefined,
      });
      clearPersistentClientRequestId(actor, appt.clinic_id, actionKey);
      return row;
    },
    onSuccess: (row) => {
      setIssuedInvoice({
        id: String(row.id ?? ""),
        number: String(row.invoice_number ?? ""),
      });
      toast.success(t("doctorVisit.paymentIssued"));
    },
    onError: (error: Error) => {
      toast.error(`${t("doctorVisit.paymentError")}: ${error.message}`);
    },
  });

  /**
   * Step completion is derived from the DATA, not from which chip was clicked
   * last. The previous stepper marked a step "done" merely because a later
   * chip was active — a progress indicator that reflected nothing.
   */
  const stepDone: Record<number, boolean> = {
    1: Boolean(draft.complaints.trim()),
    2: Boolean(draft.examination.trim()),
    3: Boolean(draft.procedures.trim()),
    4: Boolean(draft.recommendations.trim() || draft.privateNotes.trim()),
    5: issuedInvoice !== null,
  };

  const goToStep = (step: (typeof VISIT_STEPS)[number]) => {
    setActiveStep(step.id);
    if (step.field) {
      const el = protocolFieldRefs.current[step.field];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    const card = step.id === 2 ? chartCardRef.current : paymentCardRef.current;
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // content. Patient, doctor, clinic, status and timestamps are taken from the
  // locked appointment on the server, never from browser-controlled fields.
  const finishMutation = useMutation({
    mutationFn: async () => {
      const generation = visitGenerationRef.current;
      const submittedFingerprint = serverDraftFingerprint(draft);
      finishLockRef.current = true;
      if (!appt) throw new Error("no appointment");
      if (conflictDocument) throw new Error("VISIT_CONFLICT_UNRESOLVED");

      if (navigator.onLine && serverStatus !== "FINAL") {
        try {
          await pushDraft(draft);
          if (visitGenerationRef.current !== generation) {
            throw new Error("STALE_VISIT_CONTEXT");
          }
          if (
            serverDraftFingerprint(draftRef.current) !== submittedFingerprint
          ) {
            throw new Error("VISIT_CHANGED_DURING_FINISH");
          }
        } catch (error) {
          if (isAccessError(error)) {
            clearUnauthorizedDraft(generation);
            throw error;
          }
          if (
            error instanceof DoctorVisitApiError &&
            error.status === 409 &&
            id
          ) {
            try {
              const current = await getVisitDocument(id);
              if (visitGenerationRef.current !== generation) {
                throw new Error("STALE_VISIT_CONTEXT");
              }
              serverVersionRef.current = current.version;
              setConflictDocument(current);
              setSyncState("conflict");
            } catch (refreshError: unknown) {
              if (isAccessError(refreshError)) {
                clearUnauthorizedDraft(generation);
              }
              throw refreshError;
            }
          }
          throw error;
        }
      }
      const medicalNotes = buildMedicalRecordNotes(draft);
      const { data, error } = await supabase.functions.invoke("finish-visit", {
        body: {
          appointmentId: appt.id,
          expectedVersion: serverVersionRef.current,
          diagnosis: diagnosis.trim() || null,
          treatment: draft.procedures.trim() || null,
          anesthesia: anesthesia.trim() || null,
          notes: medicalNotes,
        },
      });
      if (visitGenerationRef.current !== generation) {
        throw new Error("STALE_VISIT_CONTEXT");
      }
      if (error) {
        const status = "status" in error && typeof error.status === "number"
          ? error.status
          : null;
        const apiError = status === null
          ? new Error(error.message)
          : new DoctorVisitApiError(error.message, status);
        if (isAccessError(apiError)) {
          clearUnauthorizedDraft(generation);
        } else if (apiError instanceof DoctorVisitApiError
          && apiError.status === 409
          && id) {
          try {
            const current = await getVisitDocument(id);
            if (visitGenerationRef.current !== generation) {
              throw new Error("STALE_VISIT_CONTEXT");
            }
            serverVersionRef.current = current.version;
            setConflictDocument(current);
            setSyncState("conflict");
          } catch (refreshError: unknown) {
            if (isAccessError(refreshError)) {
              clearUnauthorizedDraft(generation);
            }
          }
        }
        throw apiError;
      }
      return data;
    },
    onSuccess: () => {
      if (id && doctorUserId) {
        clearDoctorVisitDraft(window.sessionStorage, doctorUserId, id);
      }
      queryClient.invalidateQueries({ queryKey: ["doctor-visit-appt", id] });
      queryClient.invalidateQueries({ queryKey: ["patient-medical-records", appt?.patient_id] });
      queryClient.invalidateQueries({ queryKey: ["medical-records", appt?.patient_id] });
      queryClient.invalidateQueries({ queryKey: ["visit-prev", appt?.patient_id] });
      toast.success(t("doctorVisit.visitCompleted"));
      setTimeout(() => navigate("/doctor/calendar"), 800);
    },
    onError: (error) => {
      toast.error(
        error instanceof DoctorVisitApiError && error.status === 409
          ? t("doctorVisit.finishConflict")
          : t("doctorVisit.finishError"),
      );
    },
    onSettled: () => {
      finishLockRef.current = false;
    },
  });

  // Timer
  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running]);

  // Track whether there is unsaved clinical content. Nothing is persisted while
  // typing — the visit is written only on "Завершить" — so we no longer fake a
  // "saved N sec ago" indicator and instead show an honest draft state.
  const hasDraftContent = hasDoctorVisitDraftContent(draft);
  const useServerConflictVersion = () => {
    if (!id || !doctorUserId || !conflictDocument) return;
    const remoteDraft = visitDocumentToDraft(conflictDocument);
    serverVersionRef.current = conflictDocument.version;
    lastServerPayloadRef.current = serverDraftFingerprint(remoteDraft);
    setServerRecordId(conflictDocument.id);
    setServerStatus(conflictDocument.status);
    setDraft(remoteDraft);
    saveDoctorVisitDraft(
      window.sessionStorage,
      doctorUserId,
      id,
      remoteDraft,
      conflictDocument.version,
    );
    setConflictDocument(null);
    setSyncState("saved");
  };
  const keepLocalConflictVersion = () => {
    if (!conflictDocument) return;
    serverVersionRef.current = conflictDocument.version;
    lastServerPayloadRef.current = serverDraftFingerprint(
      visitDocumentToDraft(conflictDocument),
    );
    setConflictDocument(null);
    setSyncState("saving");
  };
  const handleFinish = () => {
    if (conflictDocument) {
      toast.error(t("doctorVisit.draftConflict"));
      return;
    }
    if (!diagnosis.trim() && !buildMedicalRecordNotes(draft)) {
      toast.error(t("doctorVisit.clinicalEntryRequired"));
      return;
    }
    finishLockRef.current = true;
    finishMutation.mutate();
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const ageYears = useMemo(() => {
    return null; // birth_date not available on profiles
  }, []);

  if (isLoading) {
    return (
      <DoctorLayout>
        <div className="flex h-cabinet items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DoctorLayout>
    );
  }

  if (!appt) {
    return (
      <DoctorLayout>
        <div className="flex h-cabinet items-center justify-center">
          <div className="text-center">
            <div className="font-heading text-base font-bold text-foreground">
              {t("doctorVisit.visitNotFound")}
            </div>
            <button
              onClick={() => navigate("/doctor/calendar")}
              className="mt-3 text-sm text-primary hover:underline"
            >
              {t("doctorVisit.toCalendar")}
            </button>
          </div>
        </div>
      </DoctorLayout>
    );
  }

  const patientName = patient?.full_name || t("doctor.patient");

  return (
    <DoctorLayout>
      <div className="grid h-cabinet grid-rows-[auto_1fr] bg-muted/50">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4 lg:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="grid h-9 w-9 place-items-center rounded-prodent-input border border-border text-muted-foreground hover:bg-muted/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Avatar name={patientName} size={48} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
                  {patientName}
                </h1>
                {ageYears && (
                  <span className="text-sm text-muted-foreground">
                    · {ageYears} {t("doctor.yearsShort")}
                  </span>
                )}
                {/* Allergy chip removed: it was hardcoded to "Лидокаин"
                    regardless of patient, which is clinically dangerous.
                    Allergies are shown honestly ("не указаны") in the left
                    column until a real allergy source is wired in. */}
                <ChipTag tone="teal">
                  {(prevVisits?.length || 0) + 1}{t("doctorVisit.visitNumber")}
                </ChipTag>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t("doctorVisit.cardLabel")} #P-{formatPatientCardId(patient?.account_number, appt.patient_id)} ·{" "}
                {patient?.phone || "—"}
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-3">
              {/* Timer */}
              <div className="inline-flex items-center gap-2 rounded-prodent-input border border-primary/50 bg-primary/10 px-3 py-2 text-primary">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    running
                      ? "animate-pulse bg-primary"
                      : "bg-status-neutral"
                  )}
                />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {t("doctorVisit.visit")}
                </span>
                <span className="font-heading text-base font-bold tabular-nums">
                  {mm}:{ss}
                </span>
                <button
                  onClick={() => setRunning((r) => !r)}
                  className="grid h-6 w-6 place-items-center rounded-full border border-primary/30 bg-card text-primary hover:bg-primary/20"
                >
                  {running ? (
                    <Pause className="h-3 w-3" strokeWidth={2.5} />
                  ) : (
                    <Play className="h-3 w-3" strokeWidth={2.5} />
                  )}
                </button>
              </div>

              <button
                onClick={() => toast.info(t("doctorVisit.dictationSoon"))}
                className="inline-flex items-center gap-1.5 rounded-prodent-input border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
              >
                <Mic className="h-3.5 w-3.5" />
                {t("doctorVisit.dictation")}
              </button>
              <button
                data-testid="visit-finish"
                onClick={handleFinish}
                disabled={!canFinishDoctorVisit(
                  Boolean(conflictDocument),
                  finishMutation.isPending,
                )}
                className="inline-flex items-center gap-1.5 rounded-prodent-input bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {finishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {t("doctorVisit.finish")}
              </button>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {VISIT_STEPS.map((s, i) => {
              // Done = the stage's data actually exists; active = where the
              // last click sent the cursor. Both are announced, not just shown.
              const done = stepDone[s.id];
              const active = s.id === activeStep;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToStep(s)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      done
                        ? "bg-status-success-bg text-status-success"
                        : active
                        ? "bg-primary/10 text-primary ring-1 ring-primary/40"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-5 w-5 place-items-center rounded-full text-xs font-bold",
                        done
                          ? "bg-status-success text-primary-foreground"
                          : active
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-muted-foreground"
                      )}
                    >
                      {done ? (
                        <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                      ) : (
                        s.id
                      )}
                    </span>
                    <span>{s.name}</span>
                  </button>
                  {i < VISIT_STEPS.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={cn("h-px w-6", done ? "bg-status-success/40" : "bg-muted")}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body — 3 columns */}
        <div className="overflow-auto">
          <div className="grid grid-cols-12 gap-5 p-6">
            {/* Left column */}
            <div className="col-span-12 space-y-4 xl:col-span-3">
              <div className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <SectionTitle>{t("doctorVisit.summary")}</SectionTitle>
                <dl className="space-y-1.5 text-sm">
                  {[
                    [t("doctorVisit.phone"), patient?.phone || "—"],
                    [t("doctorVisit.email"), patient?.email || "—"],
                    [t("doctorVisit.cardLabel"), `#P-${formatPatientCardId(patient?.account_number, appt.patient_id)}`],
                    [t("doctorVisit.service"), appt.service || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-start gap-3">
                      <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <SectionTitle>{t("doctorVisit.allergiesContraindications")}</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  <ChipTag tone="rose">{t("doctorVisit.notSpecified")}</ChipTag>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {t("doctorVisit.clarifyAllergies")}
                </div>
              </div>

              <div className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <SectionTitle subtitle={t("doctorVisit.clickToView")}>
                  {t("doctorVisit.visitsHistory")}
                </SectionTitle>
                {prevVisits && prevVisits.length > 0 ? (
                  <ul className="space-y-2.5">
                    {prevVisits.map((v) => (
                      <li key={v.id} className="flex gap-3 text-xs">
                        <div className="w-[58px] shrink-0 tabular-nums text-muted-foreground">
                          {formatDate(v.appointment_date, language, {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">
                            {v.service || t("doctorVisit.visit")}
                          </div>
                          <div className="truncate text-muted-foreground">
                            {v.status}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {t("doctorVisit.firstVisitWithDoctor")}
                  </div>
                )}
              </div>

              {visitHistory.length > 0 && (
                <div className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <SectionTitle>{t("doctorVisit.draftVersionHistory")}</SectionTitle>
                  <ul className="space-y-2 text-xs">
                    {visitHistory.slice(0, 4).map((version) => (
                      <li
                        key={`${version.id}-${version.version}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="font-medium text-foreground">
                          v{version.version} · {version.status}
                        </span>
                        <time className="text-muted-foreground">
                          {formatDate(version.createdAt, language, {
                            day: "2-digit",
                            month: "2-digit",
                          })}{" "}
                          {formatTime(version.createdAt, language)}
                        </time>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Middle column */}
            <div className="col-span-12 space-y-5 xl:col-span-6">
              <div ref={chartCardRef} className="rounded-prodent border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <SectionTitle subtitle={t("doctorVisit.fdiSubtitle")}>
                  {t("doctorVisit.toothFormula")}
                </SectionTitle>
                <SmartDentalChart
                  patientId={appt.patient_id}
                  doctorId={appt.doctor_id}
                  clinicId={appt.clinic_id}
                  readOnly={false}
                />
              </div>

              <div className="rounded-prodent border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <SectionTitle subtitle={t("doctorVisit.protocolSubtitle")}>
                  {t("doctorVisit.procedureProtocol")}
                </SectionTitle>
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  {([
                    ["complaints", t("doctorVisit.complaints"), 3],
                    ["examination", t("doctorVisit.examination"), 3],
                    ["procedures", t("doctorVisit.procedures"), 3],
                    ["recommendations", t("doctorVisit.recommendations"), 3],
                  ] as const).map(([field, label, rows]) => (
                    <label className="block" key={field}>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </div>
                      <textarea
                        ref={(el) => {
                          protocolFieldRefs.current[field] = el;
                        }}
                        data-testid={`visit-field-${field}`}
                        rows={rows}
                        value={draft[field]}
                        disabled={finishMutation.isPending}
                        onChange={(event) =>
                          setDraftField(field, event.target.value)
                        }
                        className="w-full resize-y rounded-prodent-input border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </label>
                  ))}
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("doctorVisit.diagnosis")}
                    </div>
                    <select
                      value={diagnosis}
                      disabled={finishMutation.isPending}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      className="h-10 w-full rounded-prodent-input border border-border bg-card px-3 text-sm"
                    >
                      <option value="">{t("doctorVisit.selectPlaceholder")}</option>
                      <option>{t("doctorVisit.diagPulpitis")}</option>
                      <option>{t("doctorVisit.diagCariesDentin")}</option>
                      <option>{t("doctorVisit.diagPeriodontitis")}</option>
                      <option>{t("doctorVisit.diagParadontitis")}</option>
                    </select>
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("doctorVisit.anesthesia")}
                    </div>
                    <select
                      value={anesthesia}
                      disabled={finishMutation.isPending}
                      onChange={(e) => setAnesthesia(e.target.value)}
                      className="h-10 w-full rounded-prodent-input border border-border bg-card px-3 text-sm"
                    >
                      <option value="">{t("doctorVisit.selectPlaceholder")}</option>
                      <option>{t("doctorVisit.anestArticaine")}</option>
                      <option>{t("doctorVisit.anestMepivacaine")}</option>
                      <option>{t("doctorVisit.anestNone")}</option>
                    </select>
                  </label>
                  <label className="col-span-1 block md:col-span-2">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("doctorVisit.privateNotes")}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <Sparkles className="h-3 w-3" />
                            {t("doctorVisit.template")}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[280px]">
                          {[
                            {
                              t: t("doctorVisit.templateTherapeuticExam"),
                              v: t("doctorVisit.templateTherapeuticExamBody"),
                            },
                            {
                              t: t("doctorVisit.templateEndo"),
                              v: t("doctorVisit.templateEndoBody"),
                            },
                            {
                              t: t("doctorVisit.templateProhygiene"),
                              v: t("doctorVisit.templateProhygieneBody"),
                            },
                            {
                              t: t("doctorVisit.templateExtraction"),
                              v: t("doctorVisit.templateExtractionBody"),
                            },
                          ].map((tpl) => (
                            <DropdownMenuItem
                              key={tpl.t}
                              onClick={() =>
                                setNotes((prev) => (prev ? prev + "\n\n" : "") + tpl.v)
                              }
                            >
                              <Sparkles className="mr-2 h-3.5 w-3.5 text-primary" />
                              {tpl.t}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <textarea
                      rows={5}
                      value={notes}
                      disabled={finishMutation.isPending}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("doctorVisit.notesPlaceholder")}
                      className="w-full resize-none rounded-prodent-input border border-border bg-card px-3 py-2.5 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={uploadKind === "xray" ? "image/*,.dcm" : "image/*"}
                    className="hidden"
                    onChange={handleFilePicked}
                  />
                  <ToolbarButton
                    icon={<Upload className="h-3.5 w-3.5" />}
                    disabled={!serverRecordId}
                    onClick={() => triggerUpload("xray")}
                  >
                    {t("doctorVisit.xrayUpload")}
                  </ToolbarButton>
                  <ToolbarButton
                    icon={<Camera className="h-3.5 w-3.5" />}
                    disabled={!serverRecordId}
                    onClick={() => triggerUpload("photo")}
                  >
                    {t("doctorVisit.photo")}
                  </ToolbarButton>
                  <ToolbarButton
                    icon={<FlaskConical className="h-3.5 w-3.5" />}
                    onClick={() =>
                      navigate(
                        buildDoctorLabOrderPath({
                          patientId: appt.patient_id,
                          medicalRecordId: serverRecordId,
                        }),
                      )
                    }
                  >
                    {t("doctorVisit.toLab")}
                  </ToolbarButton>
                  <span
                    className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        syncState === "offline"
                          ? "bg-status-warning"
                          : syncState === "error" || syncState === "conflict"
                            ? "bg-status-danger"
                            : syncState === "saving" ||
                                syncState === "loading"
                              ? "bg-status-info"
                              : hasDraftContent
                            ? "bg-status-success"
                            : "bg-status-neutral"
                      )}
                    />
                    {syncState === "offline"
                      ? t("doctorVisit.draftOffline")
                      : syncState === "saving" || syncState === "loading"
                        ? t("doctorVisit.draftSaving")
                        : syncState === "error"
                          ? t("doctorVisit.draftSyncError")
                          : syncState === "conflict"
                            ? t("doctorVisit.draftConflict")
                            : hasDraftContent
                              ? t("doctorVisit.draftSaved")
                              : t("doctorVisit.noChanges")}
                  </span>
                </div>
                {conflictDocument && (
                  <div
                    role="alert"
                    className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-status-warning/30 bg-status-warning-bg p-3 text-xs text-status-warning"
                  >
                    <span className="mr-auto">{t("doctorVisit.draftConflict")}</span>
                    <button
                      type="button"
                      onClick={useServerConflictVersion}
                      className="rounded-md border border-status-warning/40 bg-card px-2.5 py-1.5 font-medium"
                    >
                      {t("doctorVisit.useServerVersion")}
                    </button>
                    <button
                      type="button"
                      onClick={keepLocalConflictVersion}
                      className="rounded-md border border-status-warning/60 bg-status-warning-bg px-2.5 py-1.5 font-medium text-status-warning"
                    >
                      {t("doctorVisit.keepMyVersion")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="col-span-12 space-y-4 xl:col-span-3">
              {/* Step 5 — payment. One honest state per server rule; no
                  controls that the viewer's role cannot actually perform. */}
              <div
                ref={paymentCardRef}
                className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              >
                <SectionTitle>{t("doctorVisit.stepPayment")}</SectionTitle>
                {Number(appt.total_price) > 0 && (
                  <div className="mb-2 flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">{t("doctorVisit.visitTotal")}</span>
                    <span className="font-heading font-semibold tabular-nums">
                      {formatPrice(Number(appt.total_price), "UZS", false)}
                    </span>
                  </div>
                )}
                {!appt.patient_id ? (
                  <p className="text-xs text-muted-foreground">
                    {t("doctorVisit.paymentGuest")}
                  </p>
                ) : !canIssueInvoice ? (
                  <p className="text-xs text-muted-foreground">
                    {t("doctorVisit.paymentHandoff")}
                  </p>
                ) : issuedInvoice ? (
                  <div className="space-y-2" role="status">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-status-success-bg px-2 py-0.5 text-xs font-semibold text-status-success">
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      {t("doctorVisit.paymentIssued")}
                      {issuedInvoice.number ? ` · ${issuedInvoice.number}` : ""}
                    </div>
                    <a
                      href={`/crm/finance?tab=payments&invoice=${issuedInvoice.id}`}
                      className="block text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {t("doctorVisit.paymentOpenFinance")}
                    </a>
                  </div>
                ) : appt.status !== "COMPLETED" ? (
                  <p className="text-xs text-muted-foreground">
                    {t("doctorVisit.paymentAfterFinish")}
                  </p>
                ) : !(Number(appt.total_price) > 0) ? (
                  <p className="text-xs text-muted-foreground">
                    {t("doctorVisit.paymentNoTotal")}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={invoiceMutation.isPending}
                    onClick={() => invoiceMutation.mutate()}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-prodent-btn bg-primary text-sm font-medium text-primary-foreground shadow-design-btn transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {invoiceMutation.isPending ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote aria-hidden="true" className="h-4 w-4" />
                    )}
                    {t("doctorVisit.paymentIssue")}
                  </button>
                )}
              </div>
              {/* Per-visit billing line items are not yet captured (no real
                  source), so the previous hardcoded list and "460 000" total
                   were fake. Until visit billing is wired (treatment plan items
                   / services), show an honest empty state instead of fabricated
                   amounts. */}
              <div className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <SectionTitle>{t("doctorVisit.doneInVisit")}</SectionTitle>
                <div className="rounded-prodent-input border border-dashed border-border px-3 py-6 text-center">
                   <div className="text-xs text-muted-foreground">
                    {t("doctorVisit.visitItemsEmpty")}
                   </div>
                   <div className="mt-0.5 text-xs text-muted-foreground">
                    {t("doctorVisit.visitCostFromPlan")}
                   </div>
                </div>
              </div>

              <div className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <SectionTitle>{t("doctorVisit.quickActions")}</SectionTitle>
                <div className="space-y-2">
                  <QuickAction
                    icon={<ClipboardList className="h-4 w-4" />}
                    onClick={() => setPlanOpen(true)}
                    primary
                  >
                    {t("doctorVisit.openTreatmentPlan")}
                  </QuickAction>
                  {/* P3: this action used to be labelled "Прописать рецепт",
                      implying a working prescriptions feature — but it only
                      navigates to the medical card and nothing writes an Rx.
                      Relabelled to an honest "Назначения / лечение" (the real
                      free-text capture lives in the notes textarea above, saved
                      atomically with the visit on finish). */}
                  <QuickAction
                    icon={<Edit2 className="h-4 w-4" />}
                    onClick={() =>
                      navigate(`/doctor/medical-records?id=${appt.patient_id}`)
                    }
                  >
                    {t("doctorVisit.medicalCardHistory")}
                  </QuickAction>
                  <QuickAction
                    icon={<Calendar className="h-4 w-4" />}
                    onClick={() =>
                      navigate(`/doctor/calendar?patient=${appt.patient_id}&action=add`)
                    }
                  >
                    {t("doctorVisit.nextVisit")}
                  </QuickAction>
                  <QuickAction
                    icon={<Send className="h-4 w-4" />}
                    onClick={() =>
                      navigate(`/doctor/messages?patient=${appt.patient_id}`)
                    }
                  >
                    {t("doctorVisit.sendMemo")}
                  </QuickAction>
                  <QuickAction
                    icon={<Printer className="h-4 w-4" />}
                    onClick={() => window.print()}
                  >
                    {t("doctorVisit.print")}
                  </QuickAction>
                </div>
              </div>

              <div className="rounded-prodent border border-primary/20 bg-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-prodent-input bg-card text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-heading font-semibold text-primary">
                      {t("doctorVisit.hint")}
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      {t("doctorVisit.hintBody")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DoctorTreatmentPlanCreateFlow
        open={planOpen}
        onOpenChange={setPlanOpen}
        doctorId={appt.doctor_id}
        clinics={[{
          id: appt.clinic_id,
          name: t("doctorVisit.visitClinic"),
        }]}
        initialClinicId={appt.clinic_id}
        initialPatient={{
          id: appt.patient_id,
          fullName: patientName,
          phone: patient?.phone ?? null,
        }}
        onSuccess={(plan) => {
          setPlanOpen(false);
          navigate(`/doctor/treatment-plans/${plan.id}`);
        }}
      />
    </DoctorLayout>
  );
}

const ToolbarButton = ({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-1.5 rounded-prodent-input border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {icon}
    {children}
  </button>
);

const QuickAction = ({
  icon,
  children,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-2 rounded-prodent-input px-3 py-2 text-left text-sm font-medium transition",
      primary
        ? "bg-primary/10 text-primary hover:bg-primary/20"
        : "border border-border bg-card text-foreground hover:bg-muted/50"
    )}
  >
    {icon}
    {children}
  </button>
);
