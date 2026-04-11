"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          backgroundColor: "var(--color-void, #0A0A0A)",
          color: "var(--color-text, #E8E8E8)",
          fontFamily: '"Syne", sans-serif',
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
            }}
          >
            ERREUR INATTENDUE
          </h1>
          <p
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: "0.85rem",
              color: "var(--color-text-muted, #888)",
              marginBottom: "2rem",
              maxWidth: "400px",
            }}
          >
            Une erreur est survenue. Veuillez réessayer.
          </p>
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.75rem 2rem",
              backgroundColor: "var(--color-neon, #00FFD1)",
              color: "var(--color-void, #0A0A0A)",
              fontFamily: '"Syne", sans-serif',
              fontWeight: 700,
              fontSize: "0.8rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              border: "none",
              cursor: "pointer",
            }}
          >
            RÉESSAYER
          </button>
        </div>
      </body>
    </html>
  );
}
