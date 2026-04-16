import { PatientLayout } from "@/components/patient/PatientLayout";
import { PatientDashboard } from "@/components/patient/PatientDashboard";

const PatientDashboardPage = () => {
  return (
    <PatientLayout>
      <div className="p-6 lg:p-8">
        <PatientDashboard />
      </div>
    </PatientLayout>
  );
};

export default PatientDashboardPage;
