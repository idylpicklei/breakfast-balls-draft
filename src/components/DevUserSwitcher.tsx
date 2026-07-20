"use client";

import { useEffect, useState } from "react";
import { getDevUserId, setDevUserId } from "@/lib/api-client";

const USERS = [
  { id: "admin", label: "Admin" },
  { id: "player-1", label: "Player One" },
  { id: "player-2", label: "Player Two" },
  { id: "player-3", label: "Player Three" },
  { id: "player-4", label: "Player Four" },
];

export function DevUserSwitcher() {
  const [userId, setUserId] = useState("admin");

  useEffect(() => {
    setUserId(getDevUserId());
  }, []);

  return (
    <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
      <span>Playing as</span>
      <select
        className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[var(--ink)]"
        value={userId}
        onChange={(e) => {
          setDevUserId(e.target.value);
          setUserId(e.target.value);
          window.location.reload();
        }}
      >
        {USERS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
    </label>
  );
}
