import type { TranslationDictionary } from "../types";
import kzDoctorCore from "./kz.doctor-core";
import kzDoctorSchedule from "./kz.doctor-schedule";
import kzDoctorPatients from "./kz.doctor-patients";
import kzDoctorTreatment from "./kz.doctor-treatment";
import kzDoctorFinance from "./kz.doctor-finance";
import kzDoctorOps from "./kz.doctor-ops";
import kzDoctorMarket from "./kz.doctor-market";
import kzDoctorProfile from "./kz.doctor-profile";
import kzDoctorCommunication from "./kz.doctor-communication";

const kzDoctor = {
  ...kzDoctorCore,
  ...kzDoctorSchedule,
  ...kzDoctorPatients,
  ...kzDoctorTreatment,
  ...kzDoctorFinance,
  ...kzDoctorOps,
  ...kzDoctorMarket,
  ...kzDoctorProfile,
  ...kzDoctorCommunication,
} satisfies TranslationDictionary;

export default kzDoctor;
