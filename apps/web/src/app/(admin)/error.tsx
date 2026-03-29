"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 bg-surface border border-border flex items-center justify-center">
          <span className="font-mono text-2xl text-danger">!</span>
        </div>
        <h1 className="heading-lg mb-3">ERREUR ADMIN</h1>
        <p className="font-mono text-sm text-text-muted mb-6">
          Un problème est survenu dans le panneau d&apos;administration.
        </p>
        <button onClick={reset} className="btn-neon">
          RÉESSAYER
        </button>
      </div>
    </div>
  );
}
