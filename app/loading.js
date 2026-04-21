export default function Loading() {
  return (
    <div className="px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="skeleton mx-auto h-12 w-72 rounded-xl sm:w-96" />
          <div className="skeleton mx-auto mt-5 h-5 w-80 max-w-full rounded-md" />
          <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <div className="skeleton h-11 flex-1 rounded-full" />
            <div className="skeleton h-11 flex-1 rounded-full" />
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <div className="skeleton h-12 w-full rounded-full" />
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-8 w-20 rounded-full" />
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <article
              key={index}
              className="rounded-2xl border border-white/10 bg-[#11111a]/80 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
            >
              <div className="skeleton h-28 rounded-xl" />
              <div className="-mt-8 ml-3 h-16 w-16 rounded-full border-4 border-[#11111a] bg-[#1a1a2b]" />
              <div className="skeleton mt-4 h-6 w-2/3 rounded-md" />
              <div className="skeleton mt-3 h-4 w-full rounded-md" />
              <div className="skeleton mt-2 h-4 w-5/6 rounded-md" />
              <div className="skeleton mt-5 h-9 w-24 rounded-full" />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
