import type { TranslationDictionary } from "../types";
import shared from "./uz_cyrl.shared";
import crm from "./uz_cyrl.crm";
import doctor from "./uz_cyrl.doctor";
import patient from "./uz_cyrl.patient";
import admin from "./uz_cyrl.admin";
import commerce from "./uz_cyrl.commerce";
import ops from "./uz_cyrl.ops";

const uzcyrlApp = {
  ...shared,
  ...crm,
  ...doctor,
  ...patient,
  ...admin,
  ...commerce,
  ...ops,
} satisfies TranslationDictionary;

export default uzcyrlApp;
