import type { TranslationDictionary } from "../types";
import crmcore from "./ru.crm-core";
import crmschedule from "./ru.crm-schedule";
import crmpatients from "./ru.crm-patients";
import crmfinance from "./ru.crm-finance";
import crmtreatment from "./ru.crm-treatment";
import crmsettings from "./ru.crm-settings";
import crmops from "./ru.crm-ops";

const ruCrm = {
  ...crmcore,
  ...crmschedule,
  ...crmpatients,
  ...crmfinance,
  ...crmtreatment,
  ...crmsettings,
  ...crmops,
} satisfies TranslationDictionary;

export default ruCrm;
