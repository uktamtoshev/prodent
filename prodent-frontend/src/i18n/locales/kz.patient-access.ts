import type { TranslationDictionary } from "../types";

const kzPatientAccess = {
  "patientCabinet": {
    "medicalAccessTitle": "Медкартаға рұқсат",
    "medicalAccessDesc": "Сіздің медициналық деректеріңізге рұқсат сұрауларын басқару",
    "pendingRequests": "Шешімді күтуде",
    "activeAccesses": "Белсенді рұқсаттар",
    "inHistory": "Тарихта",
    "tabPending": "Күтудегі",
    "tabActive": "Белсенді",
    "tabHistory": "Тарих",
    "noPendingRequests": "Күтудегі сұраулар жоқ",
    "noActiveAccesses": "Белсенді рұқсаттар жоқ",
    "noActiveAccessesDesc": "Сұранысты мақұлдағанда, ол осы жерде көрінеді",
    "historyEmptyAccess": "Тарих бос"
  }
} satisfies TranslationDictionary;

export default kzPatientAccess;
