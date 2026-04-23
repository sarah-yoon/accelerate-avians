import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Press_Start_2P } from "next/font/google";
import { CrtEffect } from "@/components/CrtEffect";
import { SettingsPopover } from "@/components/SettingsPopover";
import { ShortcutsOverlay } from "@/components/ShortcutsOverlay";
import { ClaimBoundary } from "@/components/ClaimBoundary";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Accelerate, Avians",
  description: "A pixel art bird typing racer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <html lang="en" className={`${pressStart.variable}`}>
        <body className="bg-pixel-black text-pixel-text-white min-h-screen font-mono">
          {children}
          <SettingsPopover />
          <ShortcutsOverlay />
          <ClaimBoundary />
          <CrtEffect />
        </body>
      </html>
    </ClerkProvider>
  );
}
