import type { TranslationDictionary } from "../types";
import crmcore from "./kg.crm-core";
import crmschedule from "./kg.crm-schedule";
import crmpatients from "./kg.crm-patients";
import crmfinance from "./kg.crm-finance";
import crmtreatment from "./kg.crm-treatment";
import crmsettings from "./kg.crm-settings";
import crmops from "./kg.crm-ops";

const kgCrm = {
  ...crmcore,
  ...crmschedule,
  ...crmpatients,
  ...crmfinance,
  ...crmtreatment,
  ...crmsettings,
  ...crmops,
} satisfies TranslationDictionary;

export default kgCrm;
