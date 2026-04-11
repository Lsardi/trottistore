"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = "loading" | "ok" | "already" | "error";

export default function NewsletterUnsubscribePage() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    fetch(`/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const json = await res.json();
        if (json?.data?.status === "already_unsubscribed") setStatus("already");
        else setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-16 text-center">
      <h1 className="heading-lg mb-4">NEWSLETTER</h1>
      {status === "loading" && (
        <p className="font-mono text-sm text-text-muted">Désinscription en cours...</p>
      )}
      {status === "ok" && (
        <p className="font-mono text-sm text-text">
          ✓ Vous êtes désinscrit de la newsletter TrottiStore.
        </p>
      )}
      {status === "already" && (
        <p className="font-mono text-sm text-text-muted">
          Vous étiez déjà désinscrit.
        </p>
      )}
      {status === "error" && (
        <p className="font-mono text-sm text-danger">
          Lien invalide.
        </p>
      )}
      <Link href="/" className="btn-outline mt-8 inline-block">
        RETOUR À L&apos;ACCUEIL
      </Link>
    </div>
  );
}
