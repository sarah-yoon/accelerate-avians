"use client";

import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";

export function AuthMenu() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <>
        <Link href="/profile" className="game-menu-item !py-3 !text-center !pl-0">
          PROFILE
        </Link>
        <SignOutButton>
          <button className="game-menu-item !py-3 !text-center !pl-0 w-full">
            SIGN OUT
          </button>
        </SignOutButton>
      </>
    );
  }

  return (
    <>
      <Link href="/sign-in" className="game-menu-item !py-3 !text-center !pl-0">
        SIGN IN
      </Link>
      <Link href="/sign-up" className="game-menu-item !py-3 !text-center !pl-0">
        SIGN UP
      </Link>
    </>
  );
}
