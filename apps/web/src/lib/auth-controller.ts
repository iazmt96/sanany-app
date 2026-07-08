import type { AuthController } from "@sanany/auth";
import { createAuthController, createSupabaseAuthService } from "@sanany/auth";
import { getWebSupabaseClient } from "./supabase-client";

let controller: AuthController | null = null;

export function getWebAuthController(): AuthController {
  if (controller) {
    return controller;
  }

  controller = createAuthController(createSupabaseAuthService(getWebSupabaseClient()));
  return controller;
}

