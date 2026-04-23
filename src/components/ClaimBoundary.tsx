"use client";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { readRecentClaims, clearClaims } from "@/lib/claim-result";

/**
 * Spec § 3.7 — on every authenticated boot, drain the guest-race stash
 * and POST each entry to /api/scores. Fires exactly once per session.
 * Entries older than 30 minutes have already been silently dropped by
 * readRecentClaims.
 */
export function ClaimBoundary() {
  const { isSignedIn, isLoaded } = useUser();
  const hasRunRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const claims = readRecentClaims();
    if (claims.length === 0) return;

    let settled = 0;
    Promise.all(
      claims.map((c) =>
        fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passageId: c.passageId,
            clientGhostData: c.clientGhostData,
            totalKeystrokes: c.totalKeystrokes,
            correctKeystrokes: c.correctKeystrokes,
          }),
        })
          .then((res) => {
            if (res.ok) settled += 1;
          })
          .catch(() => void 0)
      )
    ).then(() => {
      clearClaims();
      if (settled > 0) {
        setToast(`Saved ${settled} guest race${settled === 1 ? "" : "s"} to your account.`);
        setTimeout(() => setToast(null), 4000);
      }
    });
  }, [isLoaded, isSignedIn]);

  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-pixel-panel border-2 border-pixel-bird-yellow px-4 py-2 font-heading text-[8px] text-pixel-bird-yellow text-glow-yellow"
    >
      {toast}
    </div>
  );
}
