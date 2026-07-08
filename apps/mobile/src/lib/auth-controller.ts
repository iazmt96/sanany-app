import type { AuthController } from "@sanany/auth";
import { createAuthController, createSupabaseAuthService } from "@sanany/auth";
import { getMobileSupabaseClient } from "./supabase-client";

let controller: AuthController | null = null;

export function getMobileAuthController(): AuthController {
  if (controller) {
    return controller;
  }

  controller = createAuthController(createSupabaseAuthService(getMobileSupabaseClient()));
  return controller;
}

