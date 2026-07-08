import type { Session, User } from "@supabase/supabase-js";
import type { AuthPayload } from "@sanany/types";
import type { AuthService, AuthSubscription } from "./supabase-auth";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthSnapshot = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
};

type SnapshotListener = (snapshot: AuthSnapshot) => void;

export type AuthController = {
  initialize(): Promise<AuthSnapshot>;
  subscribe(listener: SnapshotListener): AuthSubscription;
  getSnapshot(): AuthSnapshot;
  signIn(payload: AuthPayload): Promise<void>;
  signUp(payload: AuthPayload): Promise<void>;
  signOut(): Promise<void>;
};

const initialSnapshot: AuthSnapshot = {
  status: "loading",
  session: null,
  user: null
};

function buildSnapshot(session: Session | null): AuthSnapshot {
  return {
    status: session ? "authenticated" : "unauthenticated",
    session,
    user: session?.user ?? null
  };
}

export function createAuthController(service: AuthService): AuthController {
  let snapshot = initialSnapshot;
  let initialized = false;
  let cleanupSubscription: AuthSubscription | null = null;
  const listeners = new Set<SnapshotListener>();

  const notify = () => {
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const setSnapshot = (nextSession: Session | null) => {
    snapshot = buildSnapshot(nextSession);
    notify();
  };

  return {
    async initialize() {
      if (!initialized) {
        const session = await service.getSession();
        setSnapshot(session);
        cleanupSubscription = service.onAuthStateChange((nextSession) => {
          setSnapshot(nextSession);
        });
        initialized = true;
      }

      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && cleanupSubscription) {
          cleanupSubscription();
          cleanupSubscription = null;
          initialized = false;
          snapshot = initialSnapshot;
        }
      };
    },
    getSnapshot() {
      return snapshot;
    },
    async signIn(payload) {
      await service.signIn(payload);
    },
    async signUp(payload) {
      await service.signUp(payload);
    },
    async signOut() {
      await service.signOut();
    }
  };
}

