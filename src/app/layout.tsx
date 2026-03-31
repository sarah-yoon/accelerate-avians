import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Accelerate Avians",
  description: "A pixel art bird typing racer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${pressStart.variable}`}>
        <body className="bg-pixel-black text-pixel-text-white min-h-screen font-mono">
          {/* Outer pixel frame */}
          <div className="min-h-screen relative game-frame m-0 md:m-2">
            {/* Scanline overlay for extra retro feel */}
            <div
              className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
              style={{
                background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
              }}
            />
            {children}
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
