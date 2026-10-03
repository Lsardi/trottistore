"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ProductVariant } from "@/lib/api";

export default function VariantSelector({ variants, selectedId }: { variants: ProductVariant[]; selectedId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <div className="mb-5">
    <label htmlFor="product-variant" className="spec-label mb-2 block">Variante</label>
    <select id="product-variant" className="input-dark w-full" value={selectedId} onChange={(event) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", event.target.value);
      router.replace(`${pathname}?${params}`, { scroll: false });
    }}>
      {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
    </select>
  </div>;
}
