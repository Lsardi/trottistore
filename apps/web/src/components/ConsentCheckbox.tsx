"use client";

import Link from "next/link";

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}

/**
 * RGPD consent checkbox — reusable across all forms that collect personal data.
 */
export default function ConsentCheckbox({ checked, onChange, id = "consent-rgpd" }: ConsentCheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer group">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-0.5 accent-[var(--color-neon)]"
        style={{ width: 16, height: 16, flexShrink: 0 }}
      />
      <span className="font-mono text-xs text-text-muted leading-relaxed">
        J&apos;accepte que mes données soient traitées conformément à la{" "}
        <Link href="/politique-confidentialite" className="text-neon underline">
          politique de confidentialité
        </Link>
        .
      </span>
    </label>
  );
}
