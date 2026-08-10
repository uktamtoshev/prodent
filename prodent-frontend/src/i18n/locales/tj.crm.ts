import type { TranslationDictionary } from "../types";
import crmcore from "./tj.crm-core";
import crmschedule from "./tj.crm-schedule";
import crmpatients from "./tj.crm-patients";
import crmfinance from "./tj.crm-finance";
import crmtreatment from "./tj.crm-treatment";
import crmsettings from "./tj.crm-settings";
import crmops from "./tj.crm-ops";

const tjCrm = {
  ...crmcore,
  ...crmschedule,
  ...crmpatients,
  ...crmfinance,
  ...crmtreatment,
  ...crmsettings,
  ...crmops,
} satisfies TranslationDictionary;

export default tjCrm;
