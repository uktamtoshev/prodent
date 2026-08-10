export type FinanceScope = {
  actor: string;
  clinicId: string | undefined;
};

export function setFinanceScopeDuringRender(
  ref: { current: FinanceScope },
  scope: FinanceScope,
): void {
  ref.current = scope;
}

export function isFinanceScopeActive(
  active: FinanceScope,
  candidate: { actor: string; clinicId: string },
): boolean {
  return active.actor === candidate.actor && active.clinicId === candidate.clinicId;
}
