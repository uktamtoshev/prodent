import type { TranslationDictionary } from "../types";
import tjDoctorCore from "./tj.doctor-core";
import tjDoctorSchedule from "./tj.doctor-schedule";
import tjDoctorPatients from "./tj.doctor-patients";
import tjDoctorTreatment from "./tj.doctor-treatment";
import tjDoctorFinance from "./tj.doctor-finance";
import tjDoctorOps from "./tj.doctor-ops";
import tjDoctorMarket from "./tj.doctor-market";
import tjDoctorProfile from "./tj.doctor-profile";
import tjDoctorCommunication from "./tj.doctor-communication";

const tjDoctor = {
  ...tjDoctorCore,
  ...tjDoctorSchedule,
  ...tjDoctorPatients,
  ...tjDoctorTreatment,
  ...tjDoctorFinance,
  ...tjDoctorOps,
  ...tjDoctorMarket,
  ...tjDoctorProfile,
  ...tjDoctorCommunication,
} satisfies TranslationDictionary;

export default tjDoctor;
