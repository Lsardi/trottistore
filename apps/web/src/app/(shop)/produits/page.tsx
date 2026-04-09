import { Suspense } from "react";
import { ApiError, categoriesApi, productsApi, type Category, type Product } from "@/lib/api";
import CatalogueFilters, { CatalogueSkeleton } from "./CatalogueFilters";

type SearchParamsRecord = Record<string, string | string[] | undefined>;

interface ProductsPageProps {
  searchParams?: Promise<SearchParamsRecord>;
}

function getFirstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePage(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

async function resolveSearchParams(input?: Promise<SearchParamsRecord>): Promise<SearchParamsRecord> {
  if (!input) return {};
  return await input;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return "Le service catalogue est temporairement indisponible. Réessayez dans quelques instants.";
  }
  if (error instanceof TypeError) {
    return "Le catalogue est momentanément indisponible. Veuillez réessayer dans quelques instants.";
  }
  return "Impossible de charger le catalogue pour le moment.";
}

async function fetchInitialData(params: {
  page: number;
  sort: string;
  search: string;
  categorySlug: string;
}): Promise<{
  products: Product[];
  categories: Category[];
  total: number;
  totalPages: number;
  error: string | null;
}> {
  const { page, sort, search, categorySlug } = params;

  let categories: Category[] = [];
  try {
    const categoriesRes = await categoriesApi.list();
    categories = categoriesRes.data;
  } catch {
    categories = [];
  }

  try {
    const productsRes = await productsApi.list({
      page,
      limit: 24,
      sort,
      search: search || undefined,
      categorySlug: categorySlug || undefined,
    });

    return {
      products: productsRes.data,
      categories,
      total: productsRes.pagination?.total || 0,
      totalPages: productsRes.pagination?.totalPages || 1,
      error: null,
    };
  } catch (error) {
    return {
      products: [],
      categories,
      total: 0,
      totalPages: 1,
      error: toErrorMessage(error),
    };
  }
}

async function ProductsCataloguePage({ searchParams }: ProductsPageProps) {
  const params = await resolveSearchParams(searchParams);
  const page = parsePage(getFirstParam(params.page));
  const sort = getFirstParam(params.sort) || "newest";
  const search = getFirstParam(params.search) || "";
  const categorySlug = getFirstParam(params.categorySlug) || "";

  const initial = await fetchInitialData({ page, sort, search, categorySlug });

  return (
    <CatalogueFilters
      initialProducts={initial.products}
      categories={initial.categories}
      initialTotal={initial.total}
      initialTotalPages={initial.totalPages}
      initialPage={page}
      initialSort={sort}
      initialSearch={search}
      initialCategorySlug={categorySlug}
      initialError={initial.error}
    />
  );
}

export default function ProductsPage(props: ProductsPageProps) {
  return (
    <Suspense fallback={<CatalogueSkeleton />}>
      <ProductsCataloguePage {...props} />
    </Suspense>
  );
}
