import type { TranslationDictionary } from "../types";
import base from "./uz.base";
import app from "./uz.app";

const uz = {
  ...base,
  ...app,
} satisfies TranslationDictionary;

export default uz;
