"use client";

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        {/* Logo + Brand */}
        <div className="inline-flex items-center gap-2 bg-violet-50 rounded-full px-4 py-1.5 mb-6">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">
            Real Product Staging
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-900 tracking-tight leading-tight">
          Vezi mobila reala din magazin
          <br />
          <span className="text-violet-600">direct in casa ta</span>
        </h1>

        <p className="mt-5 max-w-2xl mx-auto text-lg text-zinc-500 leading-relaxed">
          AuraDesign RO este singurul designer AI interactiv care iti populeaza
          camera din prima clipa doar cu produse reale din stocurile magazinelor
          din Romania — pe care le poti schimba cu un click.
        </p>

        {/* CTA */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="#studio"
            className="inline-block rounded-xl bg-violet-600 text-white font-semibold px-8 py-4 text-base hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-200"
          >
            Incearca Mobila in Casa Ta Acum
          </a>
          <a
            href="#how-it-works"
            className="inline-block rounded-xl border border-zinc-300 text-zinc-700 font-semibold px-8 py-4 text-base hover:bg-zinc-50 transition-colors"
          >
            Cum functioneaza?
          </a>
        </div>
      </section>

      {/* Partner Logos */}
      <section className="bg-zinc-50 border-y border-zinc-100 py-6">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-center text-xs text-zinc-400 uppercase tracking-wider mb-4">
            Produse reale din magazinele tale preferate
          </p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {["eMAG", "Mobidea", "SomProduct", "IKEA Romania", "JYSK"].map(
              (store) => (
                <span
                  key={store}
                  className="text-sm font-bold text-zinc-300 hover:text-zinc-500 transition-colors"
                >
                  {store}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-zinc-900 text-center mb-10">
          Cum functioneaza
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Incarca o poza",
              desc: "Fotografiaza camera ta. AI-ul analizeaza mobilierul existent, iluminarea si geometria spatiului.",
              icon: "📷",
            },
            {
              step: "02",
              title: "Alege ce pastrezi",
              desc: "Bifeaza piesele de mobilier pe care vrei sa le pastrezi. Restul vor fi inlocuite cu produse reale din magazine.",
              icon: "✅",
            },
            {
              step: "03",
              title: "Schimba cu un click",
              desc: "Primesti o imagine cu produse reale, cu preturi si linkuri. Bifeaza alternative si imaginea se reface instant.",
              icon: "🔄",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-zinc-200 bg-white p-6 text-center hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl mb-3">{item.icon}</div>
              <div className="text-xs font-bold text-violet-500 mb-1">
                PASUL {item.step}
              </div>
              <h3 className="text-base font-bold text-zinc-800 mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Key Features */}
      <section className="bg-violet-50/50 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-zinc-900 text-center mb-10">
            De ce AuraDesign RO?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                title: "Real Product Staging",
                desc: "Fiecare piesa de mobilier din randare exista fizic intr-un depozit din Romania si poate fi cumparata.",
              },
              {
                title: "Smart Replace interactiv",
                desc: "Nu esti multumit de fotoliu? Bifeaza altul din catalog si doar fotoliul se schimba in imagine, restul ramane intact.",
              },
              {
                title: "Hyper-localizare RO",
                desc: "Integrat cu eMAG, Mobidea si alte magazine romanesti prin reteaua 2Performant. Preturi in RON, livrare locala.",
              },
              {
                title: "AI Multi-Agent",
                desc: "3 agenti AI lucreaza impreuna: unul analizeaza camera, unul cauta produse potrivite, si unul randeaza imaginea finala.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl bg-white border border-violet-100 p-5"
              >
                <h3 className="text-sm font-bold text-violet-700 mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Anchor for studio */}
      <div id="studio" />
    </div>
  );
}
