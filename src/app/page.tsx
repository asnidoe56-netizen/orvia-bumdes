import { HeroSection } from "@/components/public/hero-section";
import { PhilosophyStrip } from "@/components/public/philosophy-strip";
import { PublicContentPreview } from "@/components/public/public-content-preview";
import { PublicCtaSection } from "@/components/public/public-cta-section";
import { PublicNavbar } from "@/components/public/public-navbar";
import { getPublicLandingContent } from "@/lib/public/landing-content";

export default async function LandingPage() {
  const landingContent = await getPublicLandingContent();
  const aboutSection = landingContent.sections.find(
    (section) => section.section_key === "tentang",
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <PublicNavbar />
      <HeroSection featureItems={landingContent.items} />
      <PhilosophyStrip />
      <PublicContentPreview
        sections={landingContent.sections}
        newsPosts={landingContent.newsPosts}
      />
      <PublicCtaSection section={aboutSection} />
    </main>
  );
}
