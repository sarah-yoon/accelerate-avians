"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="bg-[#0A0A14] text-[#E8E8E8] min-h-screen font-mono flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-[#FFD700] text-lg mb-4" style={{ fontFamily: '"Press Start 2P", monospace' }}>
            GAME OVER
          </h1>
          <p className="text-[#5A5A7A] text-sm mb-6">Something went wrong.</p>
          <button
            onClick={reset}
            className="bg-[#4CAF50] text-[#0A0A14] px-6 py-2 text-sm font-bold"
            style={{ fontFamily: '"Press Start 2P", monospace' }}
          >
            TRY AGAIN
          </button>
        </div>
      </body>
    </html>
  );
}
