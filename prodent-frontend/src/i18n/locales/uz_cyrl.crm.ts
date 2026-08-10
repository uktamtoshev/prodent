import type { TranslationDictionary } from "../types";
import crmcore from "./uz_cyrl.crm-core";
import crmschedule from "./uz_cyrl.crm-schedule";
import crmpatients from "./uz_cyrl.crm-patients";
import crmfinance from "./uz_cyrl.crm-finance";
import crmtreatment from "./uz_cyrl.crm-treatment";
import crmsettings from "./uz_cyrl.crm-settings";
import crmops from "./uz_cyrl.crm-ops";

const uzcyrlCrm = {
  ...crmcore,
  ...crmschedule,
  ...crmpatients,
  ...crmfinance,
  ...crmtreatment,
  ...crmsettings,
  ...crmops,
} satisfies TranslationDictionary;

export default uzcyrlCrm;
