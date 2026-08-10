import type { TranslationDictionary } from "../types";
import base from "./tj.base";
import app from "./tj.app";

const tj = {
  ...base,
  ...app,
} satisfies TranslationDictionary;

export default tj;
