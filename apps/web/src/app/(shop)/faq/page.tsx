import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { FAQ_SECTIONS } from "./faq-data";
import FaqContent from "./FaqContent";

export const metadata: Metadata = {
  title: `Questions fréquentes | ${brand.name}`,
  description:
    "Réponses aux questions fréquentes sur la livraison, le paiement, la réparation et le SAV TrottiStore.",
};

export default function FAQPage() {
  return (
    <>
      <FaqContent />

      {/* FAQ Schema.org */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_SECTIONS.flatMap((s) =>
              s.questions.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: { "@type": "Answer", text: faq.a },
              }))
            ),
          }),
        }}
      />
    </>
  );
}
