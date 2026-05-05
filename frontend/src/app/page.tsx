import DesignStudio from "@/components/DesignStudio";

export const metadata = {
  title: "RoomRevive AI — Redesign any room instantly",
  description:
    "Upload a photo of your room. AI detects your furniture, lets you keep the best pieces, and generates a photorealistic redesign in your chosen style.",
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      <DesignStudio />
    </main>
  );
}
