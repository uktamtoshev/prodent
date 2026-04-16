import { DoctorLayout } from '@/components/doctor/DoctorLayout';

export default function DoctorCalendar() {
  return (
    <DoctorLayout>
      <div className="p-8">
        <h1 className="font-heading text-foreground">Мой календарь</h1>
        <p className="text-muted-foreground">Личное расписание врача</p>
      </div>
    </DoctorLayout>
  );
}
