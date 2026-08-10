import type { TranslationDictionary } from "../types";
import kzPatientPatientCore from "./kz.patient-core";
import kzPatientPatientDashboard from "./kz.patient-dashboard";
import kzPatientPatientAppointments from "./kz.patient-appointments";
import kzPatientPatientDoctors from "./kz.patient-doctors";
import kzPatientPatientFamily from "./kz.patient-family";
import kzPatientPatientCommunication from "./kz.patient-communication";
import kzPatientPatientFinance from "./kz.patient-finance";
import kzPatientPatientFiles from "./kz.patient-files";
import kzPatientPatientHistory from "./kz.patient-history";
import kzPatientPatientAccess from "./kz.patient-access";
import kzPatientPatientBook from "./kz.patient-book";
import kzPatientPatientMedical from "./kz.patient-medical";

const kzPatient = {
  ...kzPatientPatientCore,
  ...kzPatientPatientDashboard,
  ...kzPatientPatientAppointments,
  ...kzPatientPatientDoctors,
  ...kzPatientPatientFamily,
  ...kzPatientPatientCommunication,
  ...kzPatientPatientFinance,
  ...kzPatientPatientFiles,
  ...kzPatientPatientHistory,
  ...kzPatientPatientAccess,
  ...kzPatientPatientBook,
  ...kzPatientPatientMedical,
  patientCabinet: {
    ...kzPatientPatientCore.patientCabinet,
    ...kzPatientPatientDashboard.patientCabinet,
    ...kzPatientPatientAppointments.patientCabinet,
    ...kzPatientPatientDoctors.patientCabinet,
    ...kzPatientPatientFamily.patientCabinet,
    ...kzPatientPatientCommunication.patientCabinet,
    ...kzPatientPatientFinance.patientCabinet,
    ...kzPatientPatientFiles.patientCabinet,
    ...kzPatientPatientHistory.patientCabinet,
    ...kzPatientPatientAccess.patientCabinet,
    ...kzPatientPatientBook.patientCabinet,
    ...kzPatientPatientMedical.patientCabinet,
  },
} satisfies TranslationDictionary;

export default kzPatient;
