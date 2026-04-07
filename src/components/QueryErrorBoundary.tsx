import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n/i18n";
import { errorMessage } from "../lib/errors";
import { Button } from "./ui/Button";

type FallbackRenderProps = {
  error: Error;
  reset: () => void;
};

type Props = {
  children: ReactNode;
  fallback?: (props: FallbackRenderProps) => ReactNode;
};

type State = { error: Error | null };

/**
 * Catches React render errors in the workspace subtree; pairs with `QueryErrorResetBoundary`
 * so retry clears TanStack query errors and this boundary’s local state.
 */
class QueryErrorBoundaryInner extends Component<
  Props & { onResetQueries: () => void },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workspace error boundary", error, info.componentStack);
  }

  reset = () => {
    this.props.onResetQueries();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const fallback = this.props.fallback ?? defaultWorkspaceFallback;
      return fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}

function defaultWorkspaceFallback({ error, reset }: FallbackRenderProps) {
  return (
    <div className="border-te-danger/30 bg-te-danger-bg rounded-xl border px-4 py-6 text-center">
      <p className="text-te-danger text-sm font-medium">
        {i18n.t("errors.boundaryTitle")}
      </p>
      <p className="text-te-muted mt-2 text-xs">{errorMessage(error)}</p>
      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        onClick={reset}
      >
        {i18n.t("errors.retry")}
      </Button>
    </div>
  );
}

export function QueryErrorBoundary({ children, fallback }: Props) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <QueryErrorBoundaryInner onResetQueries={reset} fallback={fallback}>
          {children}
        </QueryErrorBoundaryInner>
      )}
    </QueryErrorResetBoundary>
  );
}
