/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    RAPID_API?: string;
    SESSION_SECRET?: string;
    /** When "true", accept x-dev-user-id header (local dev only). */
    ALLOW_HEADER_AUTH?: string;
  }
}

export {};
