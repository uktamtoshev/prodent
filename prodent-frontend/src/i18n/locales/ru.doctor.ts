import type { TranslationDictionary } from "../types";
import ruDoctorCore from "./ru.doctor-core";
import ruDoctorSchedule from "./ru.doctor-schedule";
import ruDoctorPatients from "./ru.doctor-patients";
import ruDoctorTreatment from "./ru.doctor-treatment";
import ruDoctorFinance from "./ru.doctor-finance";
import ruDoctorOps from "./ru.doctor-ops";
import ruDoctorMarket from "./ru.doctor-market";
import ruDoctorProfile from "./ru.doctor-profile";
import ruDoctorCommunication from "./ru.doctor-communication";

const ruDoctor = {
  ...ruDoctorCore,
  ...ruDoctorSchedule,
  ...ruDoctorPatients,
  ...ruDoctorTreatment,
  ...ruDoctorFinance,
  ...ruDoctorOps,
  ...ruDoctorMarket,
  ...ruDoctorProfile,
  ...ruDoctorCommunication,
} satisfies TranslationDictionary;

export default ruDoctor;
