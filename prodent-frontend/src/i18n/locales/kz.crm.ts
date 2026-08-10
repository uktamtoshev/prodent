import type { TranslationDictionary } from "../types";
import crmcore from "./kz.crm-core";
import crmschedule from "./kz.crm-schedule";
import crmpatients from "./kz.crm-patients";
import crmfinance from "./kz.crm-finance";
import crmtreatment from "./kz.crm-treatment";
import crmsettings from "./kz.crm-settings";
import crmops from "./kz.crm-ops";

const kzCrm = {
  ...crmcore,
  ...crmschedule,
  ...crmpatients,
  ...crmfinance,
  ...crmtreatment,
  ...crmsettings,
  ...crmops,
} satisfies TranslationDictionary;

export default kzCrm;
