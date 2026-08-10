import { createElement, lazy } from "react";
import { Route } from "react-router-dom";
import { RoleRouteBoundary } from "./RoleRouteBoundary";

const AssistantSchedule = lazy(
  () => import("../pages/assistant/AssistantSchedule"),
);
const AssistantRooms = lazy(() => import("../pages/assistant/AssistantRooms"));
const AssistantMaterials = lazy(
  () => import("../pages/assistant/AssistantMaterials"),
);
const AssistantAppointments = lazy(
  () => import("../pages/assistant/AssistantAppointments"),
);

export const assistantRouteContract = [
  { path: "/assistant/schedule", page: "AssistantSchedule", guard: "page-owned" },
  { path: "/assistant/rooms", page: "AssistantRooms", guard: "page-owned" },
  {
    path: "/assistant/materials",
    page: "AssistantMaterials",
    guard: "page-owned",
  },
  {
    path: "/assistant/appointments",
    page: "AssistantAppointments",
    guard: "page-owned",
  },
] as const;

const assistantPages = {
  AssistantSchedule,
  AssistantRooms,
  AssistantMaterials,
  AssistantAppointments,
};

export const assistantRoutePaths = assistantRouteContract.map(
  ({ path }) => path,
);

export const assistantRouteElements = (
  <Route element={<RoleRouteBoundary group="assistant" />}>
    {assistantRouteContract.map((route) => (
      <Route
        key={route.path}
        path={route.path}
        element={createElement(assistantPages[route.page])}
      />
    ))}
  </Route>
);
