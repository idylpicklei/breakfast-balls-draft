import Link from "next/link";
import { DevUserSwitcher } from "@/components/DevUserSwitcher";

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--surface)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]">
          Breakfast Balls
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-[var(--muted)] hover:text-[var(--ink)]">
            Tournaments
          </Link>
          <Link href="/admin" className="text-[var(--muted)] hover:text-[var(--ink)]">
            Admin
          </Link>
          <DevUserSwitcher />
        </nav>
      </div>
    </header>
  );
}
