import type { TranslationDictionary } from "../types";
import ruPatientPatientCore from "./ru.patient-core";
import ruPatientPatientDashboard from "./ru.patient-dashboard";
import ruPatientPatientAppointments from "./ru.patient-appointments";
import ruPatientPatientDoctors from "./ru.patient-doctors";
import ruPatientPatientFamily from "./ru.patient-family";
import ruPatientPatientCommunication from "./ru.patient-communication";
import ruPatientPatientFinance from "./ru.patient-finance";
import ruPatientPatientFiles from "./ru.patient-files";
import ruPatientPatientHistory from "./ru.patient-history";
import ruPatientPatientAccess from "./ru.patient-access";
import ruPatientPatientBook from "./ru.patient-book";
import ruPatientPatientMedical from "./ru.patient-medical";

const ruPatient = {
  ...ruPatientPatientCore,
  ...ruPatientPatientDashboard,
  ...ruPatientPatientAppointments,
  ...ruPatientPatientDoctors,
  ...ruPatientPatientFamily,
  ...ruPatientPatientCommunication,
  ...ruPatientPatientFinance,
  ...ruPatientPatientFiles,
  ...ruPatientPatientHistory,
  ...ruPatientPatientAccess,
  ...ruPatientPatientBook,
  ...ruPatientPatientMedical,
  patientCabinet: {
    ...ruPatientPatientCore.patientCabinet,
    ...ruPatientPatientDashboard.patientCabinet,
    ...ruPatientPatientAppointments.patientCabinet,
    ...ruPatientPatientDoctors.patientCabinet,
    ...ruPatientPatientFamily.patientCabinet,
    ...ruPatientPatientCommunication.patientCabinet,
    ...ruPatientPatientFinance.patientCabinet,
    ...ruPatientPatientFiles.patientCabinet,
    ...ruPatientPatientHistory.patientCabinet,
    ...ruPatientPatientAccess.patientCabinet,
    ...ruPatientPatientBook.patientCabinet,
    ...ruPatientPatientMedical.patientCabinet,
  },
} satisfies TranslationDictionary;

export default ruPatient;
