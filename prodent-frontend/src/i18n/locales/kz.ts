import type { TranslationDictionary } from "../types";
import base from "./kz.base";
import app from "./kz.app";

const kz = {
  ...base,
  ...app,
} satisfies TranslationDictionary;

export default kz;
