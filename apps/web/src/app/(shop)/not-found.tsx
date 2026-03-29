import Link from "next/link";

export default function ShopNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="font-mono text-6xl font-bold text-neon mb-4">404</p>
        <h1 className="heading-lg mb-3">PAGE INTROUVABLE</h1>
        <p className="font-mono text-sm text-text-muted mb-8">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-neon">
            ACCUEIL
          </Link>
          <Link href="/produits" className="btn-outline">
            CATALOGUE
          </Link>
        </div>
      </div>
    </div>
  );
}
