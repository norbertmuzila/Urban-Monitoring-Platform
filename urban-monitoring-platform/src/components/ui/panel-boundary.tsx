"use client";

import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { reportClientError } from "@/lib/client/report-error";

type Props = { children: ReactNode; label?: string; className?: string };
type State = { failed: boolean; attempt: number };

/**
 * Keeps a failure inside one panel (a map, a chart) instead of taking down the page.
 * The panel re-mounts by itself once after a short pause, then offers a button.
 */
export class PanelBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };
  private timer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportClientError(error);
    if (this.state.attempt === 0) this.timer = setTimeout(this.retry, 1500);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  retry = () => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));

  render() {
    if (!this.state.failed) return <div key={this.state.attempt} className={this.props.className ?? "contents"}>{this.props.children}</div>;
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface/80 p-6 text-center">
        <RefreshCw className="size-5 text-subtle" aria-hidden />
        <p className="text-sm text-muted">{this.props.label ?? "This panel"} is reloading.</p>
        <button type="button" onClick={this.retry} className="rounded-md border border-line px-3 py-1 text-xs hover:bg-surface-2">
          Reload panel
        </button>
      </div>
    );
  }
}
