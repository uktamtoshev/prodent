import type { TranslationDictionary } from "../types";
import kgDoctorCore from "./kg.doctor-core";
import kgDoctorSchedule from "./kg.doctor-schedule";
import kgDoctorPatients from "./kg.doctor-patients";
import kgDoctorTreatment from "./kg.doctor-treatment";
import kgDoctorFinance from "./kg.doctor-finance";
import kgDoctorOps from "./kg.doctor-ops";
import kgDoctorMarket from "./kg.doctor-market";
import kgDoctorProfile from "./kg.doctor-profile";
import kgDoctorCommunication from "./kg.doctor-communication";

const kgDoctor = {
  ...kgDoctorCore,
  ...kgDoctorSchedule,
  ...kgDoctorPatients,
  ...kgDoctorTreatment,
  ...kgDoctorFinance,
  ...kgDoctorOps,
  ...kgDoctorMarket,
  ...kgDoctorProfile,
  ...kgDoctorCommunication,
} satisfies TranslationDictionary;

export default kgDoctor;
