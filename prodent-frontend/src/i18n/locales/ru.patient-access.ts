import type { TranslationDictionary } from "../types";

const ruPatientAccess = {
  "patientCabinet": {
    "medicalAccessTitle": "Доступ к медкарте",
    "medicalAccessDesc": "Управление запросами на доступ к вашим медицинским данным",
    "pendingRequests": "Ожидают решения",
    "activeAccesses": "Активные доступы",
    "inHistory": "В истории",
    "tabPending": "Ожидающие",
    "tabActive": "Активные",
    "tabHistory": "История",
    "noPendingRequests": "Нет ожидающих запросов",
    "noActiveAccesses": "Нет активных доступов",
    "noActiveAccessesDesc": "Когда вы одобрите запрос, он появится здесь",
    "historyEmptyAccess": "История пуста"
  }
} satisfies TranslationDictionary;

export default ruPatientAccess;
