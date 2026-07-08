import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { AuthController, AuthSnapshot } from "@sanany/auth";
import type { AuthPayload } from "@sanany/types";
import { getMobileAuthController } from "../lib/auth-controller";

type AuthContextValue = {
  snapshot: AuthSnapshot;
  signIn(payload: AuthPayload): Promise<void>;
  signUp(payload: AuthPayload): Promise<AuthSnapshot["session"]>;
  signOut(): Promise<void>;
};

const initialSnapshot: AuthSnapshot = {
  status: "loading",
  session: null,
  user: null
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren;

export function AuthProvider({ children }: AuthProviderProps) {
  const controller: AuthController = useMemo(() => getMobileAuthController(), []);
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(initialSnapshot);

  useEffect(() => {
    const unsubscribe = controller.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });

    void controller.initialize();
    return unsubscribe;
  }, [controller]);

  const value = useMemo<AuthContextValue>(
    () => ({
      snapshot,
      signIn: (payload) => controller.signIn(payload),
      signUp: (payload) => controller.signUp(payload),
      signOut: () => controller.signOut()
    }),
    [controller, snapshot]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
