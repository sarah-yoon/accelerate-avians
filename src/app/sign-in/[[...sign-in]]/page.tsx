import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div className="game-screen">
      <h1 className="font-heading text-pixel-bird-yellow text-[10px] mb-6 text-glow-yellow">
        SIGN IN
      </h1>
      <SignIn signUpUrl="/sign-up" appearance={clerkAppearance} />
      <Link href="/" className="game-menu-item mt-6 text-[8px] !text-center !pl-0">
        BACK TO TITLE
      </Link>
    </div>
  );
}
