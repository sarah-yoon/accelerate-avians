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
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
