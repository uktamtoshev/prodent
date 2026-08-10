import type { TranslationDictionary } from "../types";
import base from "./kg.base";
import app from "./kg.app";

const kg = {
  ...base,
  ...app,
} satisfies TranslationDictionary;

export default kg;
