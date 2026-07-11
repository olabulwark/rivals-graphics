import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <UserButton />
      </div>
      <div className="flex flex-col items-center gap-12 w-full max-w-lg">

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rivals-white.png" alt="Rivals" className="w-72 object-contain" />

        {/* Tool links */}
        <div className="flex flex-col gap-4 w-full">
          <Link href="/recruiting-news"
            className="group flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-2xl px-6 py-5 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-base">Recruiting News</p>
                </div>
                <p className="text-gray-500 text-sm">Generate a recruiting news alert graphic</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>


          <Link href="/hsfb-rankings"
            className="group flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-2xl px-6 py-5 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-base">HSFB Rankings</p>
                <p className="text-gray-500 text-sm">Generate a high school football rankings graphic</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>


          <Link href="/commit"
            className="group flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-2xl px-6 py-5 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-base">Commit Graphic</p>
                </div>
                <p className="text-gray-500 text-sm">Generate a commitment announcement graphic</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>


        </div>

      </div>
    </div>
  );
}
