import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { loadTreatmentPlanPdfDependencies } from "@/lib/treatment-plan-pdf-dependencies";

type TreatmentStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface TreatmentPlanPrintRow {
  id: string;
  title: string;
  description: string | null;
  status: TreatmentStatus;
  total_cost: number | null;
  discount_type: "PERCENT" | "FIXED";
  discount_value: number;
  discount_amount: number;
  discount_comment: string | null;
  patient_consent_confirmed_at: string | null;
  currency: string | null;
  approved_at: string | null;
  created_at: string;
  patient?: { full_name?: string | null; phone?: string | null } | null;
  doctor?: { profiles?: { full_name?: string | null } | null } | null;
  clinic?: { name?: string | null; address?: string | null; phone?: string | null } | null;
}

interface TreatmentPlanPrintItemRow {
  id: string;
  treatment_plan_id: string;
  tooth_number: number | null;
  description: string;
  quantity: number | null;
  unit_price: number;
  total_price: number;
  status: TreatmentStatus;
  completed_at: string | null;
  sort_order: number | null;
  stage_name: string | null;
  notes: string | null;
}

interface TreatmentPlanPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  byStages?: boolean;
}

export function TreatmentPlanPrintDialog({
  open,
  onOpenChange,
  planId,
  byStages = false,
}: TreatmentPlanPrintDialogProps) {
  const { t } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["treatment-plan-print", planId],
    queryFn: async () => {
      const { data: plan, error: planError } = await supabase
        .from("treatment_plans")
        .select(`
          id, title, description, status, total_cost,
          discount_type, discount_value, discount_amount, discount_comment,
          patient_consent_confirmed_at, currency, approved_at, created_at,
          patient:profiles!patient_id(full_name, phone),
          doctor:doctors!doctor_id(
            id,
            profiles:user_id(full_name)
          ),
          clinic:clinics!clinic_id(name, address, phone)
        `)
        .eq("id", planId)
        .single();
      if (planError) throw new Error(planError.message);

      const { data: items, error: itemsError } = await supabase
        .from("treatment_plan_items")
        .select("id,treatment_plan_id,tooth_number,description,quantity,unit_price,total_price,status,completed_at,sort_order,stage_name,notes")
        .eq("treatment_plan_id", planId)
        .order("sort_order")
        .order("id");
      if (itemsError) throw new Error(itemsError.message);

      return {
        plan: plan as TreatmentPlanPrintRow,
        items: (items || []) as TreatmentPlanPrintItemRow[],
      };
    },
    enabled: open && !!planId,
  });

  const formatPrice = (price: number | null | undefined) =>
    new Intl.NumberFormat("uz-UZ").format(price || 0);

  const printStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      padding: 16mm 20mm;
      color: #1a1a2e;
      line-height: 1.6;
      background: #fff;
    }

    /* ── Header ── */
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      margin-bottom: 24px;
      border-bottom: 3px solid #0d9488;
    }
    .clinic-logo-area {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .clinic-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: bold;
      flex-shrink: 0;
    }
    .clinic-name {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .clinic-details {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .plan-meta {
      text-align: right;
    }
    .plan-number {
      font-size: 13px;
      font-weight: 700;
      color: #0d9488;
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-radius: 6px;
      padding: 4px 12px;
      display: inline-block;
    }
    .plan-date {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 6px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 20px;
      margin-top: 6px;
    }
    .status-approved {
      background: #dcfce7;
      color: #15803d;
    }
    .status-draft {
      background: #fef3c7;
      color: #92400e;
    }

    /* ── Title ── */
    .print-title {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #0f172a;
      margin-bottom: 24px;
      padding: 12px 0;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
    }

    /* ── Info Cards ── */
    .info-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 28px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 18px;
    }
    .info-card-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .info-card-value {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
    }
    .info-card-sub {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }

    /* ── Section ── */
    .section-label {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0d9488;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }

    /* ── Table ── */
    .services-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .services-table th {
      background: #0d9488;
      color: white;
      padding: 10px 14px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .services-table th:last-child,
    .services-table td:last-child {
      text-align: right;
    }
    .services-table th.center,
    .services-table td.center {
      text-align: center;
    }
    .services-table td {
      padding: 10px 14px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    .services-table tr:last-child td {
      border-bottom: none;
    }
    .services-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .services-table .row-num {
      color: #94a3b8;
      font-weight: 500;
      width: 36px;
    }
    .services-table .tooth-col {
      width: 60px;
      text-align: center;
    }
    .services-table .tooth-badge {
      display: inline-block;
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 600;
      color: #0d9488;
    }
    .services-table .general-badge {
      display: inline-block;
      color: #94a3b8;
      font-size: 12px;
    }
    .services-table .service-name {
      font-weight: 500;
    }
    .services-table .price-col {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* ── Stage Header ── */
    .stage-row td {
      background: #f0fdfa !important;
      font-weight: 700;
      color: #0d9488;
      font-size: 13px;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #99f6e4 !important;
      padding: 10px 14px;
    }

    /* ── Totals ── */
    .totals-block {
      margin-top: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .total-line {
      display: flex;
      justify-content: space-between;
      padding: 10px 20px;
      font-size: 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .total-line:last-child {
      border-bottom: none;
    }
    .total-line .label {
      color: #64748b;
    }
    .total-line .value {
      font-weight: 600;
      color: #1e293b;
      font-variant-numeric: tabular-nums;
    }
    .total-line.discount .value {
      color: #16a34a;
    }
    .total-final {
      display: flex;
      justify-content: space-between;
      padding: 14px 20px;
      background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
      color: white;
      font-size: 18px;
      font-weight: 700;
    }

    /* ── Signatures ── */
    .signatures-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      margin-top: 40px;
      padding-top: 20px;
    }
    .sig-item {
      text-align: center;
    }
    .sig-role {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 28px;
    }
    .sig-line {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #1e293b;
    }

    /* ── Footer ── */
    .print-footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }

    /* ── Consent ── */
    .consent-block {
      margin-top: 20px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 12px;
      color: #92400e;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .consent-check {
      width: 16px;
      height: 16px;
      border: 2px solid #f59e0b;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    @page {
      size: A4;
      margin: 10mm 12mm;
    }
    @media print {
      html, body {
        width: 210mm;
        padding: 0;
        margin: 0;
        font-size: 11px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print { display: none !important; }
      .print-header { margin-bottom: 16px; padding-bottom: 12px; }
      .clinic-name { font-size: 18px; }
      .print-title { font-size: 14px; margin-bottom: 16px; padding: 8px 0; }
      .info-cards { gap: 10px; margin-bottom: 18px; }
      .info-card { padding: 10px 14px; }
      .info-card-value { font-size: 13px; }
      .services-table th { padding: 6px 10px; font-size: 10px; }
      .services-table td { padding: 6px 10px; font-size: 11px; }
      .totals-block { margin-top: 12px; }
      .total-line { padding: 6px 16px; font-size: 12px; }
      .total-final { padding: 10px 16px; font-size: 15px; }
      .signatures-block { margin-top: 24px; gap: 32px; }
      .print-footer { margin-top: 20px; }
    }
  `;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title></title>
          <style>${printStyles}</style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.document.title = `${t('crmTreatmentPrint.treatmentPlan')} ${data?.plan?.title || ""}`;
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleDownloadPDF = async () => {
    const el = printRef.current;
    if (!el) return;
    setIsDownloading(true);
    try {
      const { html2canvas, JsPDF } = await loadTreatmentPlanPdfDependencies();
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new JsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      if (imgHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, margin, contentWidth, imgHeight);
      } else {
        // Scale to fit single page
        const scale = (pageHeight - margin * 2) / imgHeight;
        const scaledWidth = contentWidth * scale;
        const scaledHeight = imgHeight * scale;
        const xOffset = margin + (contentWidth - scaledWidth) / 2;
        pdf.addImage(imgData, "PNG", xOffset, margin, scaledWidth, scaledHeight);
      }

      const safeTitle = (data?.plan?.title || t('crmTreatmentPrint.planFallback'))
        .replace(/[\\/:*?"<>|]+/g, "_")
        .slice(0, 80);
      const fileName = `${t('crmTreatmentPrint.fileNamePrefix')}_${safeTitle}.pdf`;
      pdf.save(fileName);
    } catch (e) {
      console.error("PDF generation error:", e);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatStatus = (status: TreatmentStatus) => status.replace("_", " ");

  const itemsByStage = data?.items?.reduce<Record<string, TreatmentPlanPrintItemRow[]>>((acc, item) => {
    const stage = item.stage_name?.trim() || t('crmTreatmentForm.stagePrefix');
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(item);
    return acc;
  }, {});

  const isCompleted = data?.plan?.status === "COMPLETED";
  const hasConsent = Boolean(data?.plan?.patient_consent_confirmed_at);
  const subtotal = data?.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) ?? 0;
  const totalCost = data?.plan?.total_cost ?? subtotal;
  const discountAmount = data?.plan?.discount_amount
    ?? Math.max(0, subtotal - totalCost);
  const currency = data?.plan?.currency || "UZS";
  const clinicInitial = data?.plan?.clinic?.name?.charAt(0)?.toUpperCase() || t('crmTreatmentPrint.clinicInitial');

  const stageEntries = Object.entries(itemsByStage || {});

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <Skeleton className="h-[600px] w-full" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('crmTreatmentPrint.printPreview')}
          </DialogTitle>
        </DialogHeader>

        {/* Print Preview */}
        <div
          ref={printRef}
          className="bg-card text-black rounded-lg border"
          style={{ padding: "32px", minHeight: "600px", fontSize: "14px", fontFamily: "'Segoe UI', sans-serif" }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: "20px", marginBottom: "24px", borderBottom: "3px solid #0d9488" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "48px", height: "48px", background: "linear-gradient(135deg, #0d9488, #14b8a6)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "24px", fontWeight: "bold" }}>
                {clinicInitial}
              </div>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>{data?.plan?.clinic?.name}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  {data?.plan?.clinic?.address}{data?.plan?.clinic?.phone && ` • ${t('crmTreatmentPrint.phoneLabel')}: ${data.plan.clinic.phone}`}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0d9488", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "6px", padding: "4px 12px", display: "inline-block" }}>
                {data?.plan?.title || t('crmTreatmentPrint.treatmentPlan')}
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>
                {data?.plan?.created_at && format(new Date(data.plan.created_at), "dd MMMM yyyy", { locale: ru })}
              </div>
              <div style={{ marginTop: "6px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "20px", background: isCompleted ? "#dcfce7" : "#fef3c7", color: isCompleted ? "#15803d" : "#92400e" }}>
                  {formatStatus(data?.plan?.status || "PLANNED")}
                </span>
              </div>
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: "center", fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#0f172a", marginBottom: "24px", padding: "12px 0", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
            {data?.plan?.title || t('crmTreatmentPrint.treatmentPlan')}
          </div>

          {data?.plan?.description && (
            <div style={{ margin: "-12px 0 24px", color: "#64748b", textAlign: "center", whiteSpace: "pre-wrap" }}>
              {data.plan.description}
            </div>
          )}

          {/* Info Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 18px" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", marginBottom: "6px" }}>{t('crmTreatmentPrint.patient')}</div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a" }}>{data?.plan?.patient?.full_name || "—"}</div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{data?.plan?.patient?.phone || ""}</div>
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 18px" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", marginBottom: "6px" }}>{t('crmTreatmentPrint.attendingDoctor')}</div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a" }}>{data?.plan?.doctor?.profiles?.full_name || "—"}</div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                {data?.plan?.approved_at
                  ? `${t('crmTreatmentPrint.approvedOn')}: ${format(new Date(data.plan.approved_at), "dd.MM.yyyy", { locale: ru })}`
                  : ""}
              </div>
            </div>
          </div>

          {/* Section Label */}
          <div style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#0d9488", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{t('crmTreatmentPrint.servicesAndProcedures')}</span>
            <span style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
          </div>

          {/* Table */}
          {byStages && stageEntries.length > 0 ? (
            stageEntries.map(([stage, stageItems], stageIdx) => {
              const stageTotal = stageItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
              return (
                <div key={stage} style={{ marginBottom: stageIdx < stageEntries.length - 1 ? "16px" : "0" }}>
                  <table className="services-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", marginBottom: "4px" }}>
                    <thead>
                      <tr>
                        <th colSpan={6} style={{ background: "#f0fdfa", color: "#0d9488", padding: "10px 14px", fontWeight: 700, fontSize: "13px", letterSpacing: "0.3px", borderBottom: "2px solid #99f6e4", textAlign: "left" }}>
                          {stage}
                        </th>
                      </tr>
                      <tr>
                        <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", width: "36px" }}>№</th>
                        <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", width: "60px", textAlign: "center" }}>{t('crmTreatmentPrint.tooth')}</th>
                        <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>{t('crmTreatmentPrint.service')}</th>
                        <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", textAlign: "center", width: "50px" }}>{t('crmTreatmentPrint.qty')}</th>
                        <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", textAlign: "right", width: "100px" }}>{t('crmTreatmentPrint.price')}</th>
                        <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", textAlign: "right", width: "110px" }}>{t('crmTreatmentPrint.sum')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stageItems.map((item, idx) => (
                        <tr key={item.id || idx} style={{ background: idx % 2 === 1 ? "#f8fafc" : "white" }}>
                          <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontWeight: 500 }}>{idx + 1}</td>
                          <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                            {item.tooth_number
                              ? <span style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "6px", padding: "2px 8px", fontSize: "12px", fontWeight: 600, color: "#0d9488" }}>{item.tooth_number}</span>
                              : <span style={{ color: "#94a3b8" }}>—</span>
                            }
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", fontWeight: 500 }}>
                            <div>{item.description || "—"}</div>
                            {item.notes && (
                              <div style={{ marginTop: "3px", color: "#64748b", fontSize: "11px", fontWeight: 400, whiteSpace: "pre-wrap" }}>
                                {item.notes}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>{item.quantity || 1}</td>
                          <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatPrice(item.unit_price)}</td>
                          <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatPrice(item.total_price)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={5} style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: "#64748b", fontSize: "13px" }}>{t('crmTreatmentPrint.stageTotal')}:</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#0f172a", fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>{formatPrice(stageTotal)} {currency}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })
          ) : (
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
              <thead>
                <tr>
                  <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", width: "36px" }}>№</th>
                  <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", width: "60px", textAlign: "center" }}>{t('crmTreatmentPrint.tooth')}</th>
                  <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>{t('crmTreatmentPrint.service')}</th>
                  <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", textAlign: "center", width: "50px" }}>{t('crmTreatmentPrint.qty')}</th>
                  <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", textAlign: "right", width: "100px" }}>{t('crmTreatmentPrint.price')}</th>
                  <th style={{ background: "#0d9488", color: "white", padding: "10px 14px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", textAlign: "right", width: "110px" }}>{t('crmTreatmentPrint.sum')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((item, idx) => (
                  <tr key={item.id || idx} style={{ background: idx % 2 === 1 ? "#f8fafc" : "white" }}>
                    <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontWeight: 500 }}>{idx + 1}</td>
                    <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                      {item.tooth_number
                        ? <span style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "6px", padding: "2px 8px", fontSize: "12px", fontWeight: 600, color: "#0d9488" }}>{item.tooth_number}</span>
                        : <span style={{ color: "#94a3b8" }}>—</span>
                      }
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", fontWeight: 500 }}>
                      <div>{item.description || "—"}</div>
                      {item.notes && (
                        <div style={{ marginTop: "3px", color: "#64748b", fontSize: "11px", fontWeight: 400, whiteSpace: "pre-wrap" }}>
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>{item.quantity || 1}</td>
                    <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatPrice(item.unit_price)}</td>
                    <td style={{ padding: "10px 14px", fontSize: "13px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatPrice(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div style={{ marginTop: "20px", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 20px", fontSize: "14px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: "#64748b" }}>{t('crmTreatmentPrint.servicesTotal')}</span>
              <span style={{ fontWeight: 600, color: "#1e293b", fontVariantNumeric: "tabular-nums" }}>{formatPrice(subtotal)} {currency}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", padding: "10px 20px", fontSize: "14px", borderBottom: "1px solid #f1f5f9", color: "#15803d" }}>
                <span>
                  {t('crmTreatmentForm.discount')}
                  {data?.plan?.discount_type === "PERCENT"
                    ? ` (${formatPrice(data.plan.discount_value)}%)`
                    : ` (${formatPrice(data?.plan?.discount_value)} ${currency})`}
                  {data?.plan?.discount_comment && (
                    <span style={{ display: "block", marginTop: "2px", color: "#64748b", fontSize: "11px", whiteSpace: "pre-wrap" }}>
                      {data.plan.discount_comment}
                    </span>
                  )}
                </span>
                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>−{formatPrice(discountAmount)} {currency}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", background: "linear-gradient(135deg, #0d9488, #14b8a6)", color: "white", fontSize: "18px", fontWeight: 700 }}>
              <span>{t('crmTreatmentPrint.toPayLabel')}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatPrice(totalCost)} {currency}</span>
            </div>
          </div>

          {/* Consent */}
          {hasConsent && (
            <div style={{ marginTop: "20px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px 16px", fontSize: "12px", color: "#166534", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🛡️</span>
              <span>
                {t('crmTreatmentPrint.consentText')}
                {data?.plan?.patient_consent_confirmed_at && (
                  <> · {format(new Date(data.plan.patient_consent_confirmed_at), "dd.MM.yyyy HH:mm", { locale: ru })}</>
                )}
              </span>
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", marginTop: "40px", paddingTop: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "28px" }}>{t('crmTreatmentPrint.attendingDoctor')}</div>
              <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: "8px", fontSize: "13px", fontWeight: 500, color: "#1e293b" }}>
                {data?.plan?.doctor?.profiles?.full_name || "___________________"}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "28px" }}>{t('crmTreatmentPrint.patient')}</div>
              <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: "8px", fontSize: "13px", fontWeight: 500, color: "#1e293b" }}>
                {data?.plan?.patient?.full_name || "___________________"}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: "32px", paddingTop: "12px", borderTop: "1px solid #e2e8f0", textAlign: "center", fontSize: "10px", color: "#94a3b8" }}>
            {t('crmTreatmentPrint.autoGenerated')} • {data?.plan?.clinic?.name} • {format(new Date(), "dd.MM.yyyy HH:mm", { locale: ru })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('crmTreatmentPrint.close')}
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF} disabled={isDownloading}>
            <Download className="w-4 h-4 mr-2" />
            {isDownloading ? t('crmTreatmentPrint.generating') : t('crmTreatmentPrint.downloadPdf')}
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            {t('crmTreatmentPrint.print')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
