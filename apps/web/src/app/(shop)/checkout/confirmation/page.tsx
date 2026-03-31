"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "-";
  const orderNumber = searchParams.get("orderNumber");

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
      <p className="spec-label mb-3">COMMANDE VALIDÉE</p>
      <h1 className="heading-lg mb-4">Merci, votre commande est enregistrée</h1>
      {orderNumber ? (
        <p className="font-mono text-sm text-text-muted mb-2">Numéro de commande : #{orderNumber}</p>
      ) : null}
      <p className="font-mono text-xs text-text-dim mb-8">ID commande : {orderId}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/mon-compte" className="btn-neon">
          VOIR MON COMPTE
        </Link>
        <Link href="/produits" className="btn-outline">
          CONTINUER MES ACHATS
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="font-mono text-sm text-text-muted">Chargement de la confirmation...</p>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
