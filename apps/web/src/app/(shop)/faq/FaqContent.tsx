"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { brand } from "@/lib/brand";
import { FAQ_SECTIONS } from "./faq-data";

export default function FaqContent() {
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!query.trim()) return FAQ_SECTIONS;

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    return FAQ_SECTIONS.map((section) => ({
      ...section,
      questions: section.questions.filter((faq) => {
        const text = `${faq.q} ${faq.a}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      }),
    })).filter((section) => section.questions.length > 0);
  }, [query]);

  const totalResults = filteredSections.reduce((sum, s) => sum + s.questions.length, 0);
  const totalQuestions = FAQ_SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="heading-xl mb-2">QUESTIONS FRÉQUENTES</h1>
      <p className="font-mono text-sm text-text-muted mb-6">
        Vous ne trouvez pas la réponse ? Contactez-nous au{" "}
        <a href={`tel:${brand.phoneIntl}`} className="text-neon">{brand.phone}</a>.
      </p>

      {/* Search input */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une question..."
          className="input-dark w-full pl-10 pr-10"
          aria-label="Rechercher dans la FAQ"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text"
            aria-label="Effacer la recherche"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search status */}
      {query && (
        <p className="font-mono text-xs text-text-muted mb-6">
          {totalResults === 0
            ? "Aucun résultat. Essayez d'autres mots-clés."
            : `${totalResults} résultat${totalResults > 1 ? "s" : ""} sur ${totalQuestions} questions`}
        </p>
      )}

      {/* FAQ sections */}
      {filteredSections.map((section) => (
        <section key={section.title} className="mb-10">
          <p className="spec-label mb-4">{section.title}</p>
          <div className="space-y-3">
            {section.questions.map((faq) => (
              <details
                key={faq.q}
                className="bg-surface border border-border group"
                {...(query ? { open: true } : {})}
              >
                <summary className="font-mono text-sm text-text font-bold px-5 py-4 cursor-pointer select-none list-none flex items-center justify-between">
                  {faq.q}
                  <span className="text-text-dim ml-4 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-4 font-mono text-sm text-text-muted">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <div className="divider my-8" />
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/reparation" className="btn-neon">DÉPOSER UN TICKET SAV</Link>
        <Link href="/diagnostic" className="btn-outline">DIAGNOSTIC EN LIGNE</Link>
      </div>
    </main>
  );
}
