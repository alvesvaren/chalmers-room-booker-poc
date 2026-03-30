import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, type ErrorInfo, type ReactNode } from "react";
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
 * Catches render errors from suspense queries; pairs with `QueryErrorResetBoundary` so retry
 * can invalidate the TanStack error state as well as local boundary state.
 */
class QueryErrorBoundaryInner extends Component<Props & { onResetQueries: () => void }, State> {
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
    <div className='rounded-xl border border-te-danger/30 bg-te-danger-bg px-4 py-6 text-center'>
      <p className='text-sm font-medium text-te-danger'>Något gick fel när data skulle laddas.</p>
      <p className='mt-2 text-xs text-te-muted'>{errorMessage(error)}</p>
      <Button type='button' variant='secondary' className='mt-4' onClick={reset}>
        Försök igen
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
