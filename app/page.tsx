import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-12 w-full max-w-lg">

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rivals-white.png" alt="Rivals" className="w-72 object-contain" />

        {/* Tool links */}
        <div className="flex flex-col gap-4 w-full">
          <Link href="/jersey"
            className="group flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-2xl px-6 py-5 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-base">Jersey Swap</p>
                  <span className="text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5 leading-none">WIP</span>
                </div>
                <p className="text-gray-500 text-sm">Put a recruit in any college jersey</p>
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
                  <span className="text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5 leading-none">WIP</span>
                </div>
                <p className="text-gray-500 text-sm">Generate a commitment announcement graphic</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link href="/quote"
            className="group flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-2xl px-6 py-5 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-base">Quote Graphic</p>
                <p className="text-gray-500 text-sm">Generate a pull quote graphic</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link href="/visits"
            className="group flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-2xl px-6 py-5 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-base">Visit Graphic</p>
                  <span className="text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5 leading-none">WIP</span>
                </div>
                <p className="text-gray-500 text-sm">Build an official visits graphic</p>
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
