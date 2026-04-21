export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="animate-pulse rounded-2xl border border-white/10 bg-[#11111a] p-6">
            <div className="skeleton mx-auto h-8 w-48 rounded-full" />
            <div className="mt-6 space-y-3">
              <div className="skeleton h-11 rounded-xl" />
              <div className="skeleton h-11 rounded-xl" />
              <div className="skeleton h-11 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="hidden rounded-2xl border border-white/10 bg-[#11111a] p-6 lg:col-span-3 lg:block">
          <div className="skeleton h-full min-h-[520px] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
