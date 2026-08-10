import type { TranslationDictionary } from "../types";
import shared from "./ru.shared";
import crm from "./ru.crm";
import doctor from "./ru.doctor";
import patient from "./ru.patient";
import admin from "./ru.admin";
import commerce from "./ru.commerce";
import ops from "./ru.ops";

const ruApp = {
  ...shared,
  ...crm,
  ...doctor,
  ...patient,
  ...admin,
  ...commerce,
  ...ops,
} satisfies TranslationDictionary;

export default ruApp;
