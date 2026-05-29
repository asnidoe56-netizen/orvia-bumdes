import { HeroSection } from "@/components/public/hero-section";
import { PhilosophyStrip } from "@/components/public/philosophy-strip";
import { PublicContentPreview } from "@/components/public/public-content-preview";
import { PublicCtaSection } from "@/components/public/public-cta-section";
import { PublicNavbar } from "@/components/public/public-navbar";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <PublicNavbar />
      <HeroSection />
      <PhilosophyStrip />
      <PublicContentPreview />
      <PublicCtaSection />
    </main>
  );
}
