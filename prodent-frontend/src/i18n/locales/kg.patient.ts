import type { TranslationDictionary } from "../types";
import kgPatientPatientCore from "./kg.patient-core";
import kgPatientPatientDashboard from "./kg.patient-dashboard";
import kgPatientPatientAppointments from "./kg.patient-appointments";
import kgPatientPatientDoctors from "./kg.patient-doctors";
import kgPatientPatientFamily from "./kg.patient-family";
import kgPatientPatientCommunication from "./kg.patient-communication";
import kgPatientPatientFinance from "./kg.patient-finance";
import kgPatientPatientFiles from "./kg.patient-files";
import kgPatientPatientHistory from "./kg.patient-history";
import kgPatientPatientAccess from "./kg.patient-access";
import kgPatientPatientBook from "./kg.patient-book";
import kgPatientPatientMedical from "./kg.patient-medical";

const kgPatient = {
  ...kgPatientPatientCore,
  ...kgPatientPatientDashboard,
  ...kgPatientPatientAppointments,
  ...kgPatientPatientDoctors,
  ...kgPatientPatientFamily,
  ...kgPatientPatientCommunication,
  ...kgPatientPatientFinance,
  ...kgPatientPatientFiles,
  ...kgPatientPatientHistory,
  ...kgPatientPatientAccess,
  ...kgPatientPatientBook,
  ...kgPatientPatientMedical,
  patientCabinet: {
    ...kgPatientPatientCore.patientCabinet,
    ...kgPatientPatientDashboard.patientCabinet,
    ...kgPatientPatientAppointments.patientCabinet,
    ...kgPatientPatientDoctors.patientCabinet,
    ...kgPatientPatientFamily.patientCabinet,
    ...kgPatientPatientCommunication.patientCabinet,
    ...kgPatientPatientFinance.patientCabinet,
    ...kgPatientPatientFiles.patientCabinet,
    ...kgPatientPatientHistory.patientCabinet,
    ...kgPatientPatientAccess.patientCabinet,
    ...kgPatientPatientBook.patientCabinet,
    ...kgPatientPatientMedical.patientCabinet,
  },
} satisfies TranslationDictionary;

export default kgPatient;
