"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0f] text-white">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#11111a] p-6 text-center shadow-[0_0_30px_rgba(239,68,68,0.15)]">
            <p className="text-2xl font-bold">Something went wrong</p>
            <p className="mt-3 text-sm text-gray-400">{error?.message || "An unexpected error occurred."}</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="btn-interactive rounded-full bg-[#8b5cf6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7c4df1]"
              >
                Try again
              </button>
              <a
                href="/"
                className="btn-interactive rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/5"
              >
                Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
