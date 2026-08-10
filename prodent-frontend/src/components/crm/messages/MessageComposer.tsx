import { memo, useState, useCallback, useId, FormEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MessageAttachment,
  MessageFilePreview,
} from "./MessageAttachment";
import { useLanguage } from "@/contexts/LanguageContext";

export interface PendingFile {
  url: string;
  type: string;
  name: string;
}

export interface MessageComposerProps {
  onSend: (payload: {
    content?: string;
    fileUrl?: string;
    fileType?: string;
  }) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  // Visual variant — "doctor" uses a flat textarea, "patient" uses pill style.
  variant?: "doctor" | "default";
}

/**
 * Standalone message composer with its own local text + pending-file state.
 *
 * Why local state? Previously the parent chat page held `messageText` in
 * useState. Every keystroke re-rendered the entire chat (patient list,
 * message thread, header). With many DOM nodes that produced visible input
 * lag — typing felt like the UI "thought" after each letter. Pushing the
 * state down here means only the composer re-renders per keystroke.
 *
 * `onSend` is wrapped with useCallback by callers; this component is wrapped
 * in `memo()` below so it doesn't even re-render when the parent re-renders
 * for unrelated reasons.
 */
function MessageComposerInner({
  onSend,
  disabled = false,
  placeholder,
  variant = "default",
}: MessageComposerProps) {
  const { t } = useLanguage();
  const effectivePlaceholder = placeholder ?? t("crmMessageComposer.writeMessage");
  const composerId = useId();
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isDisabled = disabled || submitting;

  const handleSend = useCallback(
    async (e?: FormEvent) => {
      if (e) e.preventDefault();
      if (isDisabled) return;
      const trimmed = text.trim();
      if (!trimmed && !pendingFile) return;
      setSubmitting(true);
      try {
        await onSend({
          content: trimmed || undefined,
          fileUrl: pendingFile?.url,
          fileType: pendingFile?.type,
        });
        setText("");
        setPendingFile(null);
      } catch {
        // Keep the draft and attachment so the user can retry.
      } finally {
        setSubmitting(false);
      }
    },
    [text, pendingFile, isDisabled, onSend]
  );

  const handleFileSelected = useCallback(
    (url: string, type: string, name: string) => {
      setPendingFile({ url, type, name });
    },
    []
  );

  const clearFile = useCallback(() => setPendingFile(null), []);

  return (
    <>
      {pendingFile && (
        <MessageFilePreview file={pendingFile} onRemove={clearFile} />
      )}
      <div
        className={cn(
          "min-w-0 border-t border-border bg-background p-3 sm:p-4",
          variant === "doctor" && "p-4"
        )}
      >
        <form
          onSubmit={handleSend}
          className="flex min-w-0 items-end gap-2"
          aria-busy={isDisabled}
        >
          <MessageAttachment
            onFileSelected={handleFileSelected}
            pendingFile={pendingFile}
            onClearFile={clearFile}
            disabled={isDisabled}
          />
          <div className="min-w-0 flex-1">
            <label htmlFor={composerId} className="sr-only">
              {effectivePlaceholder}
            </label>
            <textarea
              id={composerId}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={effectivePlaceholder}
              disabled={isDisabled}
              className={cn(
                "min-h-11 w-full resize-none rounded-prodent-input border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                variant === "doctor" ? "h-11" : "max-h-32"
              )}
            />
          </div>
          <button
            type="submit"
            disabled={isDisabled || (!text.trim() && !pendingFile)}
            className={cn(
              "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-prodent-input bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-[hsl(var(--brand-700))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            )}
            aria-label={t("crmMessageComposer.sendBtn")}
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{t("crmMessageComposer.sendBtn")}</span>
          </button>
        </form>
      </div>
    </>
  );
}

export const MessageComposer = memo(MessageComposerInner);
