import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-pixel-black">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-pixel-panel border-2 border-pixel-text-dim",
          },
        }}
      />
    </div>
  );
}
