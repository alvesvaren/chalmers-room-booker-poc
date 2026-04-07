import App from "./App.tsx";
import { PersistedQueryBoundary } from "./components/PersistedQueryBoundary.tsx";
import { useSessionToken } from "./hooks/useSessionToken.ts";

export function Root() {
  const session = useSessionToken();
  return (
    <PersistedQueryBoundary>
      <App session={session} />
    </PersistedQueryBoundary>
  );
}
