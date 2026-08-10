import type { TranslationDictionary } from "../types";
import uzCyrlDoctorCore from "./uz_cyrl.doctor-core";
import uzCyrlDoctorSchedule from "./uz_cyrl.doctor-schedule";
import uzCyrlDoctorPatients from "./uz_cyrl.doctor-patients";
import uzCyrlDoctorTreatment from "./uz_cyrl.doctor-treatment";
import uzCyrlDoctorFinance from "./uz_cyrl.doctor-finance";
import uzCyrlDoctorOps from "./uz_cyrl.doctor-ops";
import uzCyrlDoctorMarket from "./uz_cyrl.doctor-market";
import uzCyrlDoctorProfile from "./uz_cyrl.doctor-profile";
import uzCyrlDoctorCommunication from "./uz_cyrl.doctor-communication";

const uzCyrlDoctor = {
  ...uzCyrlDoctorCore,
  ...uzCyrlDoctorSchedule,
  ...uzCyrlDoctorPatients,
  ...uzCyrlDoctorTreatment,
  ...uzCyrlDoctorFinance,
  ...uzCyrlDoctorOps,
  ...uzCyrlDoctorMarket,
  ...uzCyrlDoctorProfile,
  ...uzCyrlDoctorCommunication,
} satisfies TranslationDictionary;

export default uzCyrlDoctor;
