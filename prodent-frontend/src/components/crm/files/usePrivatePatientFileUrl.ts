import { useCallback, useEffect, useState } from "react";
import { loadPrivatePatientFileObjectUrl } from "@/lib/patient-cabinet";

export function usePrivatePatientFileUrl(
  rawUrl: string | null | undefined,
  enabled = true,
) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    if (!rawUrl || !enabled) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void loadPrivatePatientFileObjectUrl(rawUrl)
      .then((nextUrl) => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
        else URL.revokeObjectURL(nextUrl);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "File load failed",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, enabled, rawUrl]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { url, loading, error, retry };
}
