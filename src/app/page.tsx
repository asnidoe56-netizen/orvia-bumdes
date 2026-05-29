import { HeroSection } from "@/components/public/hero-section";
import { PhilosophyStrip } from "@/components/public/philosophy-strip";
import { PublicContentPreview } from "@/components/public/public-content-preview";
import { PublicCtaSection } from "@/components/public/public-cta-section";
import { PublicNavbar } from "@/components/public/public-navbar";
import { PublicNewsPopup } from "@/components/public/public-news-popup";
import { getPublicLandingContent } from "@/lib/public/landing-content";

export default async function LandingPage() {
  const landingContent = await getPublicLandingContent();
  const heroSection = landingContent.sections.find(
    (section) =>
      section.section_key === "beranda" || section.section_key === "hero",
  );
  const aboutSection = landingContent.sections.find(
    (section) => section.section_key === "tentang",
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <PublicNavbar siteSettings={landingContent.siteSettings} />
      <HeroSection section={heroSection} featureItems={landingContent.items} />
      <PhilosophyStrip />
      <PublicContentPreview
        sections={landingContent.sections}
        newsPosts={landingContent.newsPosts}
      />
      <PublicCtaSection section={aboutSection} />
      <PublicNewsPopup newsPosts={landingContent.newsPosts} />
    </main>
  );
}

