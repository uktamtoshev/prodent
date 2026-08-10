import type { TranslationDictionary } from "../types";
import shared from "./kg.shared";
import crm from "./kg.crm";
import doctor from "./kg.doctor";
import patient from "./kg.patient";
import admin from "./kg.admin";
import commerce from "./kg.commerce";
import ops from "./kg.ops";

const kgApp = {
  ...shared,
  ...crm,
  ...doctor,
  ...patient,
  ...admin,
  ...commerce,
  ...ops,
} satisfies TranslationDictionary;

export default kgApp;
