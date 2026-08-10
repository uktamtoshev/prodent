import type { TranslationDictionary } from "../types";
import tjPatientPatientCore from "./tj.patient-core";
import tjPatientPatientDashboard from "./tj.patient-dashboard";
import tjPatientPatientAppointments from "./tj.patient-appointments";
import tjPatientPatientDoctors from "./tj.patient-doctors";
import tjPatientPatientFamily from "./tj.patient-family";
import tjPatientPatientCommunication from "./tj.patient-communication";
import tjPatientPatientFinance from "./tj.patient-finance";
import tjPatientPatientFiles from "./tj.patient-files";
import tjPatientPatientHistory from "./tj.patient-history";
import tjPatientPatientAccess from "./tj.patient-access";
import tjPatientPatientBook from "./tj.patient-book";
import tjPatientPatientMedical from "./tj.patient-medical";

const tjPatient = {
  ...tjPatientPatientCore,
  ...tjPatientPatientDashboard,
  ...tjPatientPatientAppointments,
  ...tjPatientPatientDoctors,
  ...tjPatientPatientFamily,
  ...tjPatientPatientCommunication,
  ...tjPatientPatientFinance,
  ...tjPatientPatientFiles,
  ...tjPatientPatientHistory,
  ...tjPatientPatientAccess,
  ...tjPatientPatientBook,
  ...tjPatientPatientMedical,
  patientCabinet: {
    ...tjPatientPatientCore.patientCabinet,
    ...tjPatientPatientDashboard.patientCabinet,
    ...tjPatientPatientAppointments.patientCabinet,
    ...tjPatientPatientDoctors.patientCabinet,
    ...tjPatientPatientFamily.patientCabinet,
    ...tjPatientPatientCommunication.patientCabinet,
    ...tjPatientPatientFinance.patientCabinet,
    ...tjPatientPatientFiles.patientCabinet,
    ...tjPatientPatientHistory.patientCabinet,
    ...tjPatientPatientAccess.patientCabinet,
    ...tjPatientPatientBook.patientCabinet,
    ...tjPatientPatientMedical.patientCabinet,
  },
} satisfies TranslationDictionary;

export default tjPatient;
