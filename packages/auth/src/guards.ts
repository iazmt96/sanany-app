import type { AuthSnapshot } from "./controller";

export function isAuthenticated(snapshot: AuthSnapshot): boolean {
  return snapshot.status === "authenticated" && snapshot.session !== null;
}

export function isAuthPending(snapshot: AuthSnapshot): boolean {
  return snapshot.status === "loading";
}

