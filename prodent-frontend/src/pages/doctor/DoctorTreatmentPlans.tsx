import { DoctorLayout } from '@/components/doctor/DoctorLayout';

export default function DoctorTreatmentPlans() {
  return (
    <DoctorLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">План лечения</h1>
        <p className="text-muted-foreground">Планы лечения пациентов</p>
      </div>
    </DoctorLayout>
  );
}
