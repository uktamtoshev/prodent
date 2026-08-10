import type { TranslationDictionary } from "../types";
import uzDoctorCore from "./uz.doctor-core";
import uzDoctorSchedule from "./uz.doctor-schedule";
import uzDoctorPatients from "./uz.doctor-patients";
import uzDoctorTreatment from "./uz.doctor-treatment";
import uzDoctorFinance from "./uz.doctor-finance";
import uzDoctorOps from "./uz.doctor-ops";
import uzDoctorMarket from "./uz.doctor-market";
import uzDoctorProfile from "./uz.doctor-profile";
import uzDoctorCommunication from "./uz.doctor-communication";

const uzDoctor = {
  ...uzDoctorCore,
  ...uzDoctorSchedule,
  ...uzDoctorPatients,
  ...uzDoctorTreatment,
  ...uzDoctorFinance,
  ...uzDoctorOps,
  ...uzDoctorMarket,
  ...uzDoctorProfile,
  ...uzDoctorCommunication,
} satisfies TranslationDictionary;

export default uzDoctor;
