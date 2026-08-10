import type { TranslationDictionary } from "../types";
import shared from "./uz.shared";
import crm from "./uz.crm";
import doctor from "./uz.doctor";
import patient from "./uz.patient";
import admin from "./uz.admin";
import commerce from "./uz.commerce";
import ops from "./uz.ops";

const uzApp = {
  ...shared,
  ...crm,
  ...doctor,
  ...patient,
  ...admin,
  ...commerce,
  ...ops,
} satisfies TranslationDictionary;

export default uzApp;
