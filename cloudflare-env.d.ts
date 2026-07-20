/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    RAPID_API?: string;
    /** When "true", accept x-dev-user-id header (private league before Cloudflare Access). */
    ALLOW_HEADER_AUTH?: string;
  }
}

export {};
