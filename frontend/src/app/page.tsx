import DesignStudio from "@/components/DesignStudio";
import LandingPage from "@/components/LandingPage";

export const metadata = {
  title: "AuraDesign RO — Real Product Staging",
  description:
    "Upload a photo of your room. AI sources real furniture from Romanian stores, renders it in your space, and lets you swap products with one click.",
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      <LandingPage />
      <DesignStudio />
    </main>
  );
}
