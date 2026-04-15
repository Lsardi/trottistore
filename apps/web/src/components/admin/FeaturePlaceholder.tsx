import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

// Shared skeleton for admin features that exist in the sidebar roadmap but
// aren't built yet. Keeps every placeholder visually consistent so the
// admin feels like a coherent product even while we phase features in.
export function FeaturePlaceholder({
  title,
  purpose,
  whatItWillDo,
}: {
  title: string;
  purpose: string;
  whatItWillDo: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-lg">{title.toUpperCase()}</h1>
        <p className="font-mono text-sm text-text-muted mt-1">{purpose}</p>
      </div>

      <div className="bg-surface border border-border p-6 space-y-4">
        <div className="inline-flex items-center gap-2 border border-neon/40 bg-neon-dim text-neon px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider">
          <Sparkles className="h-3 w-3" />
          À venir
        </div>
        <div className="font-mono text-sm text-text-muted leading-relaxed">
          {whatItWillDo}
        </div>
      </div>
    </div>
  );
}
