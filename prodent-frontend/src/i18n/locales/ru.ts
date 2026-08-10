import type { TranslationDictionary } from "../types";
import base from "./ru.base";
import app from "./ru.app";

const ru = {
  ...base,
  ...app,
} satisfies TranslationDictionary;

export default ru;
