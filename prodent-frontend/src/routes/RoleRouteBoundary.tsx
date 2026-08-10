import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import {
  canAccessRoleRoute,
  type RoleAccessSnapshot,
  type RoleRouteGroup,
} from "./role-route-policy";

type RoleRouteAccessState =
  | { status: "loading" }
  | { status: "allowed" }
  | { status: "denied"; redirectTo: "/" | "/auth" };

interface RoleRouteBoundaryProps {
  group: RoleRouteGroup;
  children?: ReactNode;
}

interface RoleRouteBoundaryContentProps {
  access: RoleRouteAccessState;
  children?: ReactNode;
}

function RoleRouteBoundaryContent({
  access,
  children,
}: RoleRouteBoundaryContentProps) {
  const location = useLocation();
  if (access.status === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-live="polite"
      >
        Проверяем доступ…
      </div>
    );
  }

  if (access.status === "denied") {
    return (
      <Navigate
        to={access.redirectTo}
        replace
        state={
          access.redirectTo === "/auth"
            ? { returnTo: `${location.pathname}${location.search}${location.hash}` }
            : undefined
        }
      />
    );
  }

  return children ?? <Outlet />;
}

async function loadRoleAccess(
  userId: string,
  group: RoleRouteGroup,
  clinicId: string | null,
): Promise<RoleAccessSnapshot> {
  const globalResult = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const globalRoles = globalResult.data?.map(({ role }) => role) ?? [];

  if (canAccessRoleRoute(group, { globalRoles })) {
    return { globalRoles, membershipRoles: [] };
  }

  let membershipQuery = supabase
    .from("clinic_members")
    .select("role")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (clinicId) {
    membershipQuery = membershipQuery.eq("clinic_id", clinicId);
  }
  const membershipResult = await membershipQuery;

  return {
    globalRoles,
    membershipRoles: membershipResult.data?.map(({ role }) => role) ?? [],
  };
}

function ConnectedRoleRouteBoundary({
  group,
  children,
}: RoleRouteBoundaryProps) {
  const { user, loading: isAuthLoading } = useAuth();
  const clinicId = localStorage.getItem("prodent_current_clinic");
  const accessQuery = useQuery({
    queryKey: ["role-route-access", group, user?.id, clinicId],
    queryFn: () => loadRoleAccess(user!.id, group, clinicId),
    enabled: Boolean(user) && !isAuthLoading,
    retry: 1,
    staleTime: 60_000,
  });

  let access: RoleRouteAccessState;

  if (isAuthLoading || (user && accessQuery.isPending)) {
    access = { status: "loading" };
  } else if (
    user &&
    accessQuery.data &&
    canAccessRoleRoute(group, accessQuery.data)
  ) {
    access = { status: "allowed" };
  } else {
    access = { status: "denied", redirectTo: "/" };
  }

  return (
    <RoleRouteBoundaryContent access={access}>
      {children}
    </RoleRouteBoundaryContent>
  );
}

function ResolvedRoleRouteBoundary({
  group,
  children,
}: RoleRouteBoundaryProps) {
  const { user, loading: isAuthLoading } = useAuth();
  const { role, loading: isRoleLoading } = useUserRole();

  let access: RoleRouteAccessState;

  if (isAuthLoading || (user && isRoleLoading)) {
    access = { status: "loading" };
  } else if (!user) {
    access = { status: "denied", redirectTo: "/auth" };
  } else if (canAccessRoleRoute(group, { resolvedRole: role })) {
    access = { status: "allowed" };
  } else {
    access = { status: "denied", redirectTo: "/" };
  }

  return (
    <RoleRouteBoundaryContent access={access}>
      {children}
    </RoleRouteBoundaryContent>
  );
}

export function RoleRouteBoundary({
  group,
  children,
}: RoleRouteBoundaryProps) {
  if (group === "crm" || group === "medical" || group === "doctor") {
    return (
      <ResolvedRoleRouteBoundary group={group}>
        {children}
      </ResolvedRoleRouteBoundary>
    );
  }

  return (
    <ConnectedRoleRouteBoundary group={group}>
      {children}
    </ConnectedRoleRouteBoundary>
  );
}
