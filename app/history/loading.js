export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-73px)] bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="skeleton h-10 w-72 rounded-xl" />
        <div className="skeleton h-5 w-80 rounded-md" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-2xl border border-white/10 bg-[#12121d] p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-white/10" />
                <div className="h-3 w-3/4 rounded bg-white/10" />
              </div>
              <div className="h-4 w-20 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
