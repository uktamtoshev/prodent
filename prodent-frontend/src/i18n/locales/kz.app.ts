import type { TranslationDictionary } from "../types";
import shared from "./kz.shared";
import crm from "./kz.crm";
import doctor from "./kz.doctor";
import patient from "./kz.patient";
import admin from "./kz.admin";
import commerce from "./kz.commerce";
import ops from "./kz.ops";

const kzApp = {
  ...shared,
  ...crm,
  ...doctor,
  ...patient,
  ...admin,
  ...commerce,
  ...ops,
} satisfies TranslationDictionary;

export default kzApp;
