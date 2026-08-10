import type { TranslationDictionary } from "../types";
import uzPatientPatientCore from "./uz.patient-core";
import uzPatientPatientDashboard from "./uz.patient-dashboard";
import uzPatientPatientAppointments from "./uz.patient-appointments";
import uzPatientPatientDoctors from "./uz.patient-doctors";
import uzPatientPatientFamily from "./uz.patient-family";
import uzPatientPatientCommunication from "./uz.patient-communication";
import uzPatientPatientFinance from "./uz.patient-finance";
import uzPatientPatientFiles from "./uz.patient-files";
import uzPatientPatientHistory from "./uz.patient-history";
import uzPatientPatientAccess from "./uz.patient-access";
import uzPatientPatientBook from "./uz.patient-book";
import uzPatientPatientMedical from "./uz.patient-medical";

const uzPatient = {
  ...uzPatientPatientCore,
  ...uzPatientPatientDashboard,
  ...uzPatientPatientAppointments,
  ...uzPatientPatientDoctors,
  ...uzPatientPatientFamily,
  ...uzPatientPatientCommunication,
  ...uzPatientPatientFinance,
  ...uzPatientPatientFiles,
  ...uzPatientPatientHistory,
  ...uzPatientPatientAccess,
  ...uzPatientPatientBook,
  ...uzPatientPatientMedical,
  patientCabinet: {
    ...uzPatientPatientCore.patientCabinet,
    ...uzPatientPatientDashboard.patientCabinet,
    ...uzPatientPatientAppointments.patientCabinet,
    ...uzPatientPatientDoctors.patientCabinet,
    ...uzPatientPatientFamily.patientCabinet,
    ...uzPatientPatientCommunication.patientCabinet,
    ...uzPatientPatientFinance.patientCabinet,
    ...uzPatientPatientFiles.patientCabinet,
    ...uzPatientPatientHistory.patientCabinet,
    ...uzPatientPatientAccess.patientCabinet,
    ...uzPatientPatientBook.patientCabinet,
    ...uzPatientPatientMedical.patientCabinet,
  },
} satisfies TranslationDictionary;

export default uzPatient;
