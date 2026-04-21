export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-73px)] bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="skeleton h-16 rounded-2xl" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-2xl border border-white/10 bg-[#12121d] p-4">
            <div className="skeleton h-5 w-40 rounded-md" />
            <div className="mt-3 space-y-2">
              <div className="skeleton h-4 w-full rounded-md" />
              <div className="skeleton h-4 w-5/6 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
