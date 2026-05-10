import DesignStudio from "@/components/DesignStudio";

export const metadata = {
  title: "Design Studio — AuraDesign RO",
  description: "Redesigneaza-ti camera cu mobila reala din magazinele romanesti.",
};

export default function StudioPage() {
  return (
    <main className="min-h-screen bg-stone-50">
      <DesignStudio />
    </main>
  );
}
