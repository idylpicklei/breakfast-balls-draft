"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import type { AuthUser, Tournament } from "@/lib/db/types";

const DEFAULT_ORDER = ["player-1", "player-2", "player-3", "player-4"];

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [bdlId, setBdlId] = useState("");
  const [prizeRule, setPrizeRule] = useState("Most combined birdies");
  const [order, setOrder] = useState(DEFAULT_ORDER.join(", "));

  useEffect(() => {
    apiFetch<AuthUser>("/api/me")
      .then(setMe)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const draft_order = order
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const data = await apiFetch<{ tournament: Tournament }>("/api/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name,
          bdl_tournament_id: Number(bdlId),
          custom_prize_rule: prizeRule,
          draft_order,
        }),
      });
      router.push(`/tournaments/${data.tournament.id}/draft`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
          Admin
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Create a tournament mapped to a balldontlie PGA tournament id.
        </p>
      </div>

      {me && !me.is_admin && (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Signed in as {me.name}, but not an admin. Switch Dev user to <strong>admin</strong>.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4 border border-[var(--line)] bg-[var(--panel)]/80 p-5">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Tournament name</span>
          <input
            required
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Masters — League Week"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">balldontlie tournament id</span>
          <input
            required
            type="number"
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
            value={bdlId}
            onChange={(e) => setBdlId(e.target.value)}
            placeholder="e.g. 100"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Custom prize rule (display only)</span>
          <input
            required
            className="w-full border border-[var(--line)] bg-white px-3 py-2"
            value={prizeRule}
            onChange={(e) => setPrizeRule(e.target.value)}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Draft order (4 user ids, comma-separated)</span>
          <input
            required
            className="w-full border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={saving || (me != null && !me.is_admin)}
          className="bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create tournament"}
        </button>
      </form>
    </div>
  );
}
