/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    BALLDONTLIE_API_KEY?: string;
  }
}

export {};
