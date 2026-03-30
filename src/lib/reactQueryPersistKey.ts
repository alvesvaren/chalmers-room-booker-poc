/** Fast stable id for localStorage key; not for security. */
function hashToken(token: string): string {
  let h = 5381;
  for (let i = 0; i < token.length; i++) {
    h = (h * 33) ^ token.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

const PREFIX = "chalmers-room-booker-rq-v1";

export function reactQueryPersistStorageKey(token: string): string {
  const t = token.trim();
  return t ? `${PREFIX}-${hashToken(t)}` : `${PREFIX}-anon`;
}
