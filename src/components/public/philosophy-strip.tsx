import { philosophyItems } from "@/components/public/landing-data";

export function PhilosophyStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-50/70 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {philosophyItems.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="flex gap-4 rounded-3xl p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
