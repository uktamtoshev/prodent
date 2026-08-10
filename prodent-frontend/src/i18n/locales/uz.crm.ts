import type { TranslationDictionary } from "../types";
import crmcore from "./uz.crm-core";
import crmschedule from "./uz.crm-schedule";
import crmpatients from "./uz.crm-patients";
import crmfinance from "./uz.crm-finance";
import crmtreatment from "./uz.crm-treatment";
import crmsettings from "./uz.crm-settings";
import crmops from "./uz.crm-ops";

const uzCrm = {
  ...crmcore,
  ...crmschedule,
  ...crmpatients,
  ...crmfinance,
  ...crmtreatment,
  ...crmsettings,
  ...crmops,
} satisfies TranslationDictionary;

export default uzCrm;
