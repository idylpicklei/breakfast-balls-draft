"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api-client";
import type { AuthUser, DraftSession, Tournament } from "@/lib/db/types";
import { DEFAULT_PICK_CLOCK_SECONDS } from "@/lib/draft/pickAdvance";

interface PartnershipTeamView {
  id?: string;
  name: string;
  sort_order?: number;
  member_ids: string[];
}

interface TournamentDetail {
  tournament: Tournament;
  draft_session: DraftSession | null;
  draft_order: { user_id: string; pick_position: number; user_name?: string }[];
  partnership_teams: PartnershipTeamView[];
  editable: boolean;
}

export default function EditTournamentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = params.id;

  const [me, setMe] = useState<AuthUser | null>(null);
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [order, setOrder] = useState("");
  const [idaho, setIdaho] = useState("");
  const [oregon, setOregon] = useState("");
  const [pickClockSeconds, setPickClockSeconds] = useState(String(DEFAULT_PICK_CLOCK_SECONDS));

  const load = useCallback(async () => {
    const data = await apiFetch<TournamentDetail>(`/api/tournaments/${tournamentId}`);
    setDetail(data);
    setName(data.tournament.name);
    setOrder(data.draft_order.map((d) => d.user_id).join(", "));
    const idahoTeam =
      data.partnership_teams.find((t) => t.name === "Idaho") ?? data.partnership_teams[0];
    const oregonTeam =
      data.partnership_teams.find((t) => t.name === "Oregon") ?? data.partnership_teams[1];
    setIdaho((idahoTeam?.member_ids ?? []).join(", "));
    setOregon((oregonTeam?.member_ids ?? []).join(", "));
    setPickClockSeconds(
      String(data.tournament.pick_clock_seconds ?? DEFAULT_PICK_CLOCK_SECONDS),
    );
  }, [tournamentId]);

  useEffect(() => {
    apiFetch<AuthUser>("/api/me")
      .then(setMe)
      .catch((err: Error) => setError(err.message));
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [load]);

  async function onUpdate(e: FormEvent) {
    e.preventDefault();
    setUpdating(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiFetch<TournamentDetail>(`/api/tournaments/${tournamentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          draft_order: order
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          partnership_teams: [
            {
              name: "Idaho",
              member_ids: idaho
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            },
            {
              name: "Oregon",
              member_ids: oregon
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            },
          ],
          pick_clock_seconds: Number(pickClockSeconds),
        }),
      });
      setDetail(updated);
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUpdating(false);
    }
  }

  async function deleteTournament() {
    if (!detail) return;
    const confirmed = window.confirm(
      `Delete "${detail.tournament.name}"? This removes the draft, rosters, and all tournament data. This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/tournaments/${tournamentId}`, { method: "DELETE" });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tournament");
      setDeleting(false);
    }
  }

  const adminDisabled = me != null && !me.is_admin;
  const canEdit = detail?.editable === true;

  if (loading && !detail) {
    return <p className="text-[var(--muted)]">{error ?? "Loading…"}</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Edit</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
            {detail?.tournament.name ?? "Tournament"}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Draft: {detail?.draft_session?.draft_status ?? "—"}
            {canEdit ? " · editable" : " · locked (draft already started)"}
          </p>
        </div>
        <div className="flex gap-2">
          {(detail?.tournament.status === "SCHEDULED" ||
            detail?.tournament.status === "DRAFTING") && (
            <Link
              href={`/tournaments/${tournamentId}/draft`}
              className="border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--accent-soft)]"
            >
              Draft
            </Link>
          )}
          <Link
            href={`/tournaments/${tournamentId}`}
            className="border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--accent-soft)]"
          >
            Scoreboard
          </Link>
        </div>
      </div>

      {me && !me.is_admin && (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Signed in as {me.name}. Only admins can edit tournament settings.
        </p>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <form
        onSubmit={onUpdate}
        className="space-y-4 border border-[var(--line)] bg-[var(--panel)]/80 p-5"
      >
        <p className="text-sm text-[var(--muted)]">
          Name, draft order, pick clock, and Idaho/Oregon teams can be changed only while the draft
          is PENDING.
        </p>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">League display name</span>
          <input
            required
            disabled={!canEdit || adminDisabled}
            className="w-full border border-[var(--line)] bg-white px-3 py-2 disabled:opacity-60"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Draft order (4 user ids, comma-separated)</span>
          <input
            required
            disabled={!canEdit || adminDisabled}
            className="w-full border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs disabled:opacity-60"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Pick clock (seconds)</span>
          <input
            required
            type="number"
            min={15}
            max={600}
            disabled={!canEdit || adminDisabled}
            className="w-full border border-[var(--line)] bg-white px-3 py-2 disabled:opacity-60"
            value={pickClockSeconds}
            onChange={(e) => setPickClockSeconds(e.target.value)}
          />
        </label>

        <fieldset className="space-y-3 border border-[var(--line)] bg-[var(--surface)]/60 p-4">
          <legend className="px-1 text-sm font-medium">2v2 partnership teams</legend>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Idaho members</span>
            <input
              required
              disabled={!canEdit || adminDisabled}
              className="w-full border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs disabled:opacity-60"
              value={idaho}
              onChange={(e) => setIdaho(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Oregon members</span>
            <input
              required
              disabled={!canEdit || adminDisabled}
              className="w-full border border-[var(--line)] bg-white px-3 py-2 font-mono text-xs disabled:opacity-60"
              value={oregon}
              onChange={(e) => setOregon(e.target.value)}
            />
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={!canEdit || updating || adminDisabled}
          className="bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {updating ? "Saving…" : "Save settings"}
        </button>
        {message && <p className="text-sm text-[var(--fairway)]">{message}</p>}

        <div className="border-t border-[var(--line)] pt-4">
          <h3 className="text-sm font-semibold text-red-800">Danger zone</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Permanently delete this tournament and all draft data.
          </p>
          <button
            type="button"
            disabled={deleting || adminDisabled}
            onClick={deleteTournament}
            className="mt-3 border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete tournament"}
          </button>
        </div>
      </form>
    </div>
  );
}
