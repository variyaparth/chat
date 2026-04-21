export default function Loading() {
  return (
    <div className="h-[calc(100dvh-109px)] overflow-hidden md:h-[calc(100dvh-73px)]">
      <div className="mx-auto flex h-full w-full max-w-7xl gap-4 px-3 py-3 sm:px-4 lg:px-6">
        <aside className="hidden h-full w-[280px] rounded-2xl border border-white/10 bg-[#10101a]/85 p-4 lg:block">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="mt-4 space-y-2">
            <div className="skeleton h-4 w-1/2 rounded-md" />
            <div className="skeleton h-3 w-full rounded-md" />
            <div className="skeleton h-3 w-5/6 rounded-md" />
          </div>
        </aside>

        <section className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-[#0f0f18]/90 p-4">
          <div className="skeleton h-14 rounded-2xl" />
          <div className="mt-4 flex-1 space-y-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <div className="skeleton h-12 w-2/3 rounded-2xl" />
              </div>
            ))}
          </div>
          <div className="skeleton h-16 rounded-2xl" />
        </section>
      </div>
    </div>
  );
}
