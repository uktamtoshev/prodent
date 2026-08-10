import type { TranslationDictionary } from "../types";
import uzCyrlPatientPatientCore from "./uz_cyrl.patient-core";
import uzCyrlPatientPatientDashboard from "./uz_cyrl.patient-dashboard";
import uzCyrlPatientPatientAppointments from "./uz_cyrl.patient-appointments";
import uzCyrlPatientPatientDoctors from "./uz_cyrl.patient-doctors";
import uzCyrlPatientPatientFamily from "./uz_cyrl.patient-family";
import uzCyrlPatientPatientCommunication from "./uz_cyrl.patient-communication";
import uzCyrlPatientPatientFinance from "./uz_cyrl.patient-finance";
import uzCyrlPatientPatientFiles from "./uz_cyrl.patient-files";
import uzCyrlPatientPatientHistory from "./uz_cyrl.patient-history";
import uzCyrlPatientPatientAccess from "./uz_cyrl.patient-access";
import uzCyrlPatientPatientBook from "./uz_cyrl.patient-book";
import uzCyrlPatientPatientMedical from "./uz_cyrl.patient-medical";

const uzCyrlPatient = {
  ...uzCyrlPatientPatientCore,
  ...uzCyrlPatientPatientDashboard,
  ...uzCyrlPatientPatientAppointments,
  ...uzCyrlPatientPatientDoctors,
  ...uzCyrlPatientPatientFamily,
  ...uzCyrlPatientPatientCommunication,
  ...uzCyrlPatientPatientFinance,
  ...uzCyrlPatientPatientFiles,
  ...uzCyrlPatientPatientHistory,
  ...uzCyrlPatientPatientAccess,
  ...uzCyrlPatientPatientBook,
  ...uzCyrlPatientPatientMedical,
  patientCabinet: {
    ...uzCyrlPatientPatientCore.patientCabinet,
    ...uzCyrlPatientPatientDashboard.patientCabinet,
    ...uzCyrlPatientPatientAppointments.patientCabinet,
    ...uzCyrlPatientPatientDoctors.patientCabinet,
    ...uzCyrlPatientPatientFamily.patientCabinet,
    ...uzCyrlPatientPatientCommunication.patientCabinet,
    ...uzCyrlPatientPatientFinance.patientCabinet,
    ...uzCyrlPatientPatientFiles.patientCabinet,
    ...uzCyrlPatientPatientHistory.patientCabinet,
    ...uzCyrlPatientPatientAccess.patientCabinet,
    ...uzCyrlPatientPatientBook.patientCabinet,
    ...uzCyrlPatientPatientMedical.patientCabinet,
  },
} satisfies TranslationDictionary;

export default uzCyrlPatient;
