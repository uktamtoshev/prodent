import type { TranslationDictionary } from "../types";
import shared from "./tj.shared";
import crm from "./tj.crm";
import doctor from "./tj.doctor";
import patient from "./tj.patient";
import admin from "./tj.admin";
import commerce from "./tj.commerce";
import ops from "./tj.ops";

const tjApp = {
  ...shared,
  ...crm,
  ...doctor,
  ...patient,
  ...admin,
  ...commerce,
  ...ops,
} satisfies TranslationDictionary;

export default tjApp;
