import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "400px" }}>
        <p className="font-mono text-6xl font-bold text-neon mb-4">404</p>
        <h1 className="heading-lg mb-3">PAGE INTROUVABLE</h1>
        <p className="font-mono text-sm text-text-muted mb-8">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <Link href="/" className="btn-neon">
          ACCUEIL
        </Link>
      </div>
    </div>
  );
}
