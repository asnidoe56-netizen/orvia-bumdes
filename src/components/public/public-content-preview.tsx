import { publicContentPreviewSections } from "@/components/public/landing-data";

function getSectionClass(tone: string) {
  if (tone === "slate") return "bg-slate-50";
  return "bg-white";
}

function getCardClass(tone: string) {
  if (tone === "orange") return "border-orange-100 bg-orange-50";
  return "border-slate-200 bg-white";
}

function getEyebrowClass(tone: string) {
  if (tone === "orange") return "text-orange-700";
  return "text-emerald-700";
}

export function PublicContentPreview() {
  return (
    <>
      {publicContentPreviewSections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className={[
            getSectionClass(section.tone),
            "px-4 py-16 sm:px-6 lg:px-8",
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto max-w-7xl rounded-[2rem] border p-6 shadow-sm md:p-10",
              getCardClass(section.tone),
            ].join(" ")}
          >
            <p
              className={[
                "text-sm font-black uppercase tracking-[0.25em]",
                getEyebrowClass(section.tone),
              ].join(" ")}
            >
              {section.eyebrow}
            </p>

            <div className="mt-3 grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <h2 className="text-3xl font-black tracking-tight text-slate-950">
                {section.title}
              </h2>

              <p className="text-sm leading-7 text-slate-600">
                {section.description}
              </p>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
