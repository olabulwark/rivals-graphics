import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/rivals-white.png" alt="Rivals" className="w-48 object-contain" />
      <SignIn />
    </div>
  );
}
