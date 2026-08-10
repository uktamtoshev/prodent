import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");
const forbiddenMutation = /\.from\(\s*["'](?:doctor_clinic_requests|doctor_clinic_affiliations)["']\s*\)[\s\S]{0,500}?\.(?:insert|update|upsert|delete)\s*\(/;
const rawRequestStatusDecision = /\.status\s*(?:===|!==)\s*["'](?:pending|approved|rejected)["']/;
const normalizedStatusConsumers = [
  "components/crm/DoctorRequestsManager.tsx",
  "components/crm/InviteDoctorDialog.tsx",
  "components/doctor/ClinicInvitationsManager.tsx",
  "components/doctor/JoinClinicDialog.tsx",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(entry.name)) || entry.name.includes(".test.")) return [];
    return [path];
  });
}

describe("doctor clinic request write surface", () => {
  it("keeps request and affiliation mutations behind dedicated scoped APIs", () => {
    const violations = sourceFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return forbiddenMutation.test(source) ? [path] : [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps legacy upper-case request statuses actionable in every UI consumer", () => {
    for (const relativePath of normalizedStatusConsumers) {
      const source = readFileSync(join(sourceRoot, relativePath), "utf8");

      expect(source).toContain("normalizeDoctorClinicRequestStatus");
      expect(source).not.toMatch(rawRequestStatusDecision);
    }

    const inviteDialog = readFileSync(
      join(sourceRoot, "components/crm/InviteDoctorDialog.tsx"),
      "utf8",
    );
    expect(inviteDialog).toContain("['pending', 'approved', 'PENDING', 'APPROVED']");

    const invitationsManager = readFileSync(
      join(sourceRoot, "components/doctor/ClinicInvitationsManager.tsx"),
      "utf8",
    );
    expect(invitationsManager.match(/\.ilike\('status', 'pending'\)/g)).toHaveLength(2);

    const invitationCount = readFileSync(
      join(sourceRoot, "hooks/useClinicInvitationsCount.ts"),
      "utf8",
    );
    expect(invitationCount).toContain('.ilike("status", "pending")');
  });
});
