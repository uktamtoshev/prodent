import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, UserRound } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { searchClinicPatients } from "@/lib/crm-operations-api";
import { CABINET_SECTIONS } from "@/lib/cabinet-routes";
import { useCabinetShell } from "./CabinetShellContext";

/**
 * Cabinet command palette — Cmd+K / Ctrl+K.
 *
 * The cabinet had no global search at all: 19-20 menu items in one column and
 * no way to reach a patient without first landing on the right section. A
 * receptionist on the phone had to navigate visually while the caller waited.
 *
 * Two deliberate constraints:
 *
 * 1. Destinations come from `shell.navEntries`, i.e. the menu the sidebar
 *    ALREADY filtered by permission. The palette never rebuilds that list —
 *    a second copy of the rules would drift and start offering sections the
 *    viewer cannot open.
 * 2. Patient search starts at two characters, mirroring the backend's
 *    `@Size(min = 2)` on the search endpoint. A shorter query is a guaranteed
 *    400, so the input says what it needs instead of failing.
 */

interface PatientHit {
  id: string;
  name: string;
  phone?: string | null;
  patient_type?: string;
}

export function CabinetCommandPalette() {
  const shell = useCabinetShell();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Cmd+K on macOS, Ctrl+K elsewhere. `event.key` is lowercase "k" unless
      // Shift is held, so match case-insensitively.
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setOpen((previous) => !previous);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Reset the query on close so the next open starts clean rather than showing
  // a stale patient list from the previous errand.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const trimmed = query.trim();
  const patients = useQuery({
    queryKey: ["command-palette-patients", currentClinic?.id, trimmed],
    queryFn: () =>
      searchClinicPatients(currentClinic!.id, trimmed) as Promise<PatientHit[]>,
    enabled: open && !!currentClinic?.id && trimmed.length >= 2,
    staleTime: 30 * 1000,
  });

  const navEntries = shell?.navEntries ?? [];
  const grouped = useMemo(() => {
    const buckets = new Map<string, typeof navEntries>();
    for (const entry of navEntries) {
      const key = entry.group ?? "";
      buckets.set(key, [...(buckets.get(key) ?? []), entry]);
    }
    return [...buckets.entries()];
  }, [navEntries]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* shouldFilter is left on for sections (cmdk fuzzy-matches their titles);
          patient hits come pre-filtered by the server, so they carry a `value`
          that always matches the current query. */}
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("commandPalette.placeholder")}
      />
      {/*
        Outside <CommandList> on purpose. As an empty-state it was invisible
        exactly when it mattered: one letter still matches several section
        titles, so the list was non-empty and the user got no explanation for
        why no patients appeared. Here it always shows, and `role="status"`
        announces it to a screen reader.
      */}
      {trimmed.length === 1 ? (
        <p
          role="status"
          className="border-b border-border px-3 py-2 text-xs text-muted-foreground"
        >
          {t("commandPalette.needTwoChars")}
        </p>
      ) : null}
      <CommandList>
        <CommandEmpty>
          {patients.isLoading ? t("common.loading") : t("commandPalette.nothingFound")}
        </CommandEmpty>

        {patients.data && patients.data.length > 0 ? (
          <CommandGroup heading={t("crm.patients")}>
            {patients.data.map((patient) => (
              <CommandItem
                key={patient.id}
                value={`${query} ${patient.name}`}
                onSelect={() =>
                  go(`${CABINET_SECTIONS.patients.path}/${patient.id}`)
                }
                className="min-h-11 gap-2"
              >
                <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{patient.name}</span>
                {patient.phone ? (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {patient.phone}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {grouped.map(([group, entries]) => (
          <CommandGroup key={group || "main"} heading={group || t("crm.home")}>
            {entries.map((entry) => (
              <CommandItem
                key={entry.path}
                value={entry.title}
                onSelect={() => go(entry.path)}
                className="min-h-11 gap-2"
              >
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{entry.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
