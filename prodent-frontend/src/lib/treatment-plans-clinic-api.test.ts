import { beforeEach, describe, expect, it, vi } from "vitest";

const dataMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: dataMocks.from,
  },
}));

import { getClinicPatientTreatmentPlans } from "./treatment-plans-api";

describe("getClinicPatientTreatmentPlans", () => {
  beforeEach(() => {
    dataMocks.from.mockReset();
  });

  it("maps canonical database columns and links items by treatment_plan_id", async () => {
    const planOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "plan-1",
          patient_id: "patient-1",
          doctor_id: "doctor-1",
          clinic_id: "clinic-1",
          title: "Implant treatment",
          description: "Two visits",
          status: "PLANNED",
          total_cost: "225",
          discount_type: "PERCENT",
          discount_value: "10",
          discount_amount: "25",
          discount_comment: "Loyal patient",
          patient_consent_confirmed_at: null,
          currency: "uzs",
          created_at: "2026-07-21T10:00:00Z",
        },
      ],
      error: null,
    });
    const planClinicFilter = vi.fn(() => ({ order: planOrder }));
    const planPatientFilter = vi.fn(() => ({ eq: planClinicFilter }));
    const planSelect = vi.fn(() => ({ eq: planPatientFilter }));

    const itemOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "item-1",
          treatment_plan_id: "plan-1",
          service_id: "service-1",
          tooth_number: 11,
          description: "Implant",
          quantity: "2",
          unit_price: "125",
          total_price: "250",
          status: "PLANNED",
          sort_order: 0,
          stage_name: "Stage 1",
          notes: null,
        },
      ],
      error: null,
    });
    const itemPlanFilter = vi.fn(() => ({ order: itemOrder }));
    const itemSelect = vi.fn(() => ({ in: itemPlanFilter }));

    const doctorFilter = vi.fn().mockResolvedValue({
      data: [{ id: "doctor-1", profiles: { full_name: "Dr Test" } }],
      error: null,
    });
    const doctorSelect = vi.fn(() => ({ in: doctorFilter }));

    const clinicSingle = vi.fn().mockResolvedValue({
      data: { id: "clinic-1", name: "Prodent Clinic" },
      error: null,
    });
    const clinicFilter = vi.fn(() => ({ maybeSingle: clinicSingle }));
    const clinicSelect = vi.fn(() => ({ eq: clinicFilter }));

    dataMocks.from.mockImplementation((table: string) => {
      if (table === "treatment_plans") return { select: planSelect };
      if (table === "treatment_plan_items") return { select: itemSelect };
      if (table === "doctors") return { select: doctorSelect };
      if (table === "clinics") return { select: clinicSelect };
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      getClinicPatientTreatmentPlans("patient-1", "clinic-1"),
    ).resolves.toEqual([
      {
        id: "plan-1",
        patientId: "patient-1",
        doctorName: "Dr Test",
        clinicName: "Prodent Clinic",
        title: "Implant treatment",
        description: "Two visits",
        status: "PLANNED",
        totalCost: 225,
        discountType: "PERCENT",
        discountValue: 10,
        discountAmount: 25,
        discountComment: "Loyal patient",
        patientConsentConfirmedAt: null,
        currency: "UZS",
        items: [
          {
            id: "item-1",
            serviceId: "service-1",
            toothNumber: 11,
            description: "Implant",
            quantity: 2,
            unitPrice: 125,
            totalPrice: 250,
            status: "PLANNED",
            stageName: "Stage 1",
            notes: null,
          },
        ],
        createdAt: "2026-07-21T10:00:00Z",
      },
    ]);

    expect(planPatientFilter).toHaveBeenCalledWith("patient_id", "patient-1");
    expect(planClinicFilter).toHaveBeenCalledWith("clinic_id", "clinic-1");
    expect(itemPlanFilter).toHaveBeenCalledWith("treatment_plan_id", ["plan-1"]);
  });
});
