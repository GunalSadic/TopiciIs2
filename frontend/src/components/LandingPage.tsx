"use client";

import { useEffect } from "react";
import Link from "next/link";

const PITCH_URL =
  "https://docs.google.com/presentation/d/1hRDCdqq0n8sBSqTBJ8t3jSmmpc6ADCUFLFC2M1Oj4KI/edit?slide=id.g3dfbad2f962_4_2#slide=id.g3dfbad2f962_4_2";
const BUSINESS_URL =
  "https://docs.google.com/document/d/1tVBcKnhxSvMhHtvQkYjpGlqw1zDEsQFPjxDv6RSGVlE/edit?tab=t.0";

// Real technologies actually imported and used in the codebase
const AGENTS = [
  {
    symbol: "◉",
    role: "Vision Analyzer",
    name: "GPT-4o Vision",
    tech: "langchain_openai · ChatOpenAI",
    desc: "Analizeaza fotografia cu model=gpt-4o: detecteaza mobilierul, conditia, pozitia si caracteristicile spatiului.",
  },
  {
    symbol: "⬡",
    role: "Design Planner",
    name: "GPT-4o",
    tech: "langchain_openai · ChatOpenAI",
    desc: "Creaza planul de redesign respectand stilul ales si lista de mobila pastrata, cu sugestii specifice per slot.",
  },
  {
    symbol: "◈",
    role: "Market Agent",
    name: "OpenAI Responses API",
    tech: "web_search_preview tool",
    desc: "Cauta produse reale pe emag.ro, jysk.ro, vivre.ro prin web search. Descarca imaginile prin scraping og:image.",
  },
  {
    symbol: "◧",
    role: "Iterative Renderer",
    name: "gpt-image-1",
    tech: "client.images.edit · images API",
    desc: "Editeaza fotografia originala produs cu produs prin image editing. Fallback pe DALL-E 3 la nevoie.",
  },
  {
    symbol: "⬢",
    role: "Orchestrator",
    name: "LangGraph",
    tech: "StateGraph · langgraph",
    desc: "Coordoneaza fluxul intre cei 4 agenti prin StateGraph si mentine starea jobului prin fiecare tranzitie.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Incarca fotografia",
    desc: "Fotografiaza camera ta. GPT-4o Vision analizeaza mobilierul, iluminarea si geometria spatiului.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Alege si personalizeaza",
    desc: "Selectezi ce pastrezi. Market Agent cauta produse reale pe eMAG, JYSK, Vivre. Poti adauga si produse proprii.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Primesti designul final",
    desc: "gpt-image-1 integreaza fiecare produs in fotografie, iterativ. Lista completa cu preturi si linkuri directe.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
];

const FEATURES = [
  {
    title: "Produse Reale, Nu Fictive",
    desc: "Fiecare piesa din randare exista fizic intr-un depozit din Romania si poate fi comandata imediat.",
  },
  {
    title: "Smart Replace cu un Click",
    desc: "Nu esti multumit de un produs? Il elimini sau il inlocuiesti instant — AI-ul re-randeaza doar acea portiune.",
  },
  {
    title: "Adauga Produse Proprii",
    desc: "Gasit ceva pe un alt site? Lipesti link-ul si imaginea e preluata automat, produsul intrand in design.",
  },
  {
    title: "11 Stiluri de Design",
    desc: "Modern, Minimalist, Luxury, Japandi, Industrial, Bohemian, Art Deco, Coastal, Traditional si altele.",
  },
];

export default function LandingPage() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="font-sans antialiased">
      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-brand-deep/90 backdrop-blur-md border-b border-white/[0.07]">
        <Link href="/" className="font-bold text-lg tracking-tight select-none">
          <span className="text-white">Aura</span>
          <span className="text-brand-light">Design</span>
          <span className="ml-2 text-white/30 text-xs font-normal">RO</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href={PITCH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-white/50 text-sm px-3 py-2 rounded-lg hover:text-brand-light hover:bg-white/5 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Pitch
          </a>
          <a
            href={BUSINESS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-white/50 text-sm px-3 py-2 rounded-lg hover:text-brand-light hover:bg-white/5 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Business
          </a>
          <Link
            href="/studio"
            className="ml-2 inline-flex items-center gap-1.5 bg-brand-light text-brand-deep font-semibold text-sm px-4 py-2 rounded-lg hover:bg-[#D8CDAF] active:scale-95 transition-all shadow-lg shadow-brand-light/20"
          >
            Intra in Aplicatie
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen bg-brand-deep flex flex-col items-center justify-center text-center px-4 pt-28 pb-20 overflow-hidden">
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(to right,#C7BCA115 1px,transparent 1px),linear-gradient(to bottom,#C7BCA115 1px,transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-dark/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-brand-deep to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 border border-brand-light/25 rounded-full px-4 py-1.5 mb-8 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-light animate-pulse" />
            <span className="text-brand-light text-xs font-semibold tracking-[0.18em] uppercase">
              AI · Real Product Staging · Romania
            </span>
          </div>

          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6 animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            Mobilezi o camera
            <br />
            <span className="text-brand-light">in cateva minute</span>
          </h1>

          <p
            className="text-white/50 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-10 animate-fade-in-up"
            style={{ animationDelay: "0.22s" }}
          >
            Incarca o fotografie. GPT-4o analizeaza spatiul, Market Agent cauta mobila
            reala pe site-urile romanesti, iar gpt-image-1 genereaza designul final.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up"
            style={{ animationDelay: "0.34s" }}
          >
            <Link
              href="/studio"
              className="inline-flex items-center gap-2.5 bg-brand-light text-brand-deep font-bold px-8 py-4 rounded-xl hover:bg-[#D8CDAF] active:scale-95 transition-all shadow-xl shadow-brand-light/15 text-base"
            >
              Incearca Gratuit
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <a
              href={PITCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 border border-white/15 text-white/60 font-semibold px-8 py-4 rounded-xl hover:border-brand-light/50 hover:text-white transition-all text-base"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Pitch Deck
            </a>
          </div>

          <div className="mt-14 animate-fade-in" style={{ animationDelay: "0.5s" }}>
            <p className="text-white/25 text-xs uppercase tracking-[0.2em] mb-4">
              Produse reale din
            </p>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              {["eMAG", "JYSK", "Vivre", "IKEA RO", "Mobexpert"].map((s) => (
                <span key={s} className="text-white/25 text-sm font-bold tracking-wide hover:text-brand-light transition-colors cursor-default">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-30">
          <svg className="w-6 h-6 text-brand-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-brand-bg py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 reveal">
            <span className="text-brand-mid text-xs font-bold uppercase tracking-[0.2em]">Proces</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-brand-dark mt-3 tracking-tight">
              Trei pasi simpli
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.n} className="reveal" style={{ transitionDelay: `${i * 0.12}s` }}>
                <div className="group bg-white rounded-2xl p-8 border border-brand-lighter hover:border-brand-light hover:shadow-xl hover:shadow-brand-lighter/60 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-brand-dark flex items-center justify-center text-brand-light mb-5 group-hover:scale-110 transition-transform duration-300">
                    {step.icon}
                  </div>
                  <div className="text-brand-light text-xs font-bold uppercase tracking-[0.15em] mb-2">
                    Pasul {step.n}
                  </div>
                  <h3 className="text-brand-dark font-bold text-lg mb-3">{step.title}</h3>
                  <p className="text-brand-mid text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI TECHNOLOGY (real stack) ── */}
      <section className="bg-brand-dark py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 reveal">
            <span className="text-brand-light text-xs font-bold uppercase tracking-[0.2em]">
              Stack tehnic real
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 tracking-tight">
              Sistem Multi-Agent AI
            </h2>
            <p className="text-white/50 mt-4 max-w-xl mx-auto text-base">
              5 componente specializate lucreaza in lant, orchestrate de LangGraph.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AGENTS.map((agent, i) => (
              <div key={agent.name} className="reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 hover:bg-white/[0.08] hover:border-brand-light/30 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl border border-brand-light/30 bg-brand-light/10 flex items-center justify-center">
                      <span className="text-brand-light text-lg font-mono">{agent.symbol}</span>
                    </div>
                    <div>
                      <div className="text-brand-light/70 text-xs font-bold uppercase tracking-[0.15em] mb-0.5">
                        {agent.role}
                      </div>
                      <h3 className="text-white font-bold text-base mb-1">{agent.name}</h3>
                      <div className="inline-block bg-white/5 border border-white/10 rounded px-2 py-0.5 text-[10px] text-white/40 font-mono mb-2">
                        {agent.tech}
                      </div>
                      <p className="text-white/50 text-sm leading-relaxed">{agent.desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline */}
          <div className="mt-12 reveal">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {["GPT-4o Vision", "→", "GPT-4o Planner", "→", "Responses API", "→", "gpt-image-1"].map((item, i) =>
                item === "→" ? (
                  <span key={i} className="text-brand-light/40 text-lg">→</span>
                ) : (
                  <span key={i} className="border border-white/10 bg-white/5 text-white/60 text-xs font-semibold px-4 py-2 rounded-lg tracking-wide">
                    {item}
                  </span>
                )
              )}
            </div>
            <p className="text-center text-white/25 text-xs mt-3 tracking-widest uppercase">
              orchestrat de LangGraph StateGraph
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-white py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 reveal">
            <span className="text-brand-mid text-xs font-bold uppercase tracking-[0.2em]">Avantaje</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-brand-dark mt-3 tracking-tight">
              De ce AuraDesign RO?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="rounded-2xl border border-brand-lighter p-7 hover:border-brand-light hover:shadow-lg hover:shadow-brand-lighter/60 transition-all duration-300 group">
                  <div className="w-9 h-9 rounded-xl bg-brand-lighter border border-brand-light flex items-center justify-center mb-5 group-hover:bg-brand-light transition-colors">
                    <div className="w-2 h-2 rounded-full bg-brand-dark" />
                  </div>
                  <h3 className="font-bold text-brand-dark text-base mb-2">{f.title}</h3>
                  <p className="text-brand-mid text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOCUMENTS ── */}
      <section className="bg-brand-bg py-28 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 reveal">
            <span className="text-brand-mid text-xs font-bold uppercase tracking-[0.2em]">Documente</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-brand-dark mt-3 tracking-tight">
              Afla mai multe
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <a
              href={PITCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="reveal group rounded-2xl bg-brand-dark p-8 hover:bg-[#55536A] transition-all duration-300 hover:shadow-2xl hover:shadow-brand-dark/30 hover:-translate-y-1"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center mb-6">
                <svg className="w-5 h-5 text-brand-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-xl mb-2">Pitch Deck</h3>
              <p className="text-white/50 text-sm mb-7 leading-relaxed">
                Prezentarea completa a produsului, pietei tinta si modelului de business pentru investitori.
              </p>
              <span className="inline-flex items-center gap-2 text-brand-light text-sm font-semibold group-hover:gap-3 transition-all">
                Deschide prezentarea
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            </a>

            <a
              href={BUSINESS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="reveal group rounded-2xl bg-white border border-brand-lighter p-8 hover:border-brand-light transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-lighter border border-brand-light flex items-center justify-center mb-6">
                <svg className="w-5 h-5 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-brand-dark font-bold text-xl mb-2">Business Foundation</h3>
              <p className="text-brand-mid text-sm mb-7 leading-relaxed">
                Documentul de fundatie al business-ului: strategie, analiza de piata, model de venituri si plan de crestere.
              </p>
              <span className="inline-flex items-center gap-2 text-brand-dark text-sm font-semibold group-hover:gap-3 transition-all">
                Deschide documentul
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-brand-light py-28 px-4 text-center">
        <div className="max-w-3xl mx-auto reveal">
          <h2 className="text-4xl sm:text-5xl font-bold text-brand-deep mb-4 tracking-tight">
            Gata sa incerci?
          </h2>
          <p className="text-brand-dark/70 text-lg mb-10 leading-relaxed">
            Incarca o poza si vezi cum arata camera ta cu mobila noua — in mai putin de 2 minute.
          </p>
          <Link
            href="/studio"
            className="inline-flex items-center gap-3 bg-brand-dark text-white font-bold text-lg px-10 py-5 rounded-xl hover:bg-[#55536A] active:scale-95 transition-all shadow-2xl shadow-brand-dark/20 hover:-translate-y-0.5"
          >
            Incearca Gratuit
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-brand-deep py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white/30 text-sm">
            © 2025 <span className="text-white/60 font-semibold">AuraDesign RO</span> · Real Product Staging
          </span>
          <div className="flex items-center gap-6">
            <a href={PITCH_URL} target="_blank" rel="noopener noreferrer" className="text-white/25 text-sm hover:text-brand-light transition-colors">Pitch Deck</a>
            <a href={BUSINESS_URL} target="_blank" rel="noopener noreferrer" className="text-white/25 text-sm hover:text-brand-light transition-colors">Business</a>
            <Link href="/studio" className="text-white/25 text-sm hover:text-brand-light transition-colors">Aplicatie</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
