import { TriangleAlert } from "lucide-react";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <TriangleAlert className="size-5 text-alert" aria-hidden />
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-line px-3 py-1 text-xs text-fg hover:bg-surface-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}
