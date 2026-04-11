/**
 * Google Places API — fetch shop-level reviews for the actual TrottiStore
 * physical store.
 *
 * Configuration via env vars (Railway):
 *   GOOGLE_MAPS_API_KEY  — server-side key, Places API enabled
 *   GOOGLE_PLACE_ID      — the place identifier of the boutique
 *
 * Fallback: returns null if env vars are missing or the API fails. Callers
 * must gracefully degrade (e.g. fall back to internal verified reviews or
 * hide the section entirely).
 *
 * Cache: 1 day at the Next.js fetch level. Place Details responses are
 * stable enough that hourly fetches would burn quota for nothing.
 */

export interface GoogleReview {
  authorName: string;
  authorPhotoUrl?: string;
  rating: number; // 1..5
  text: string;
  relativeTime: string; // "il y a 2 mois"
  language?: string;
}

export interface GoogleReviewsData {
  rating: number; // average, 1..5
  total: number; // total user_ratings_total (often >> reviews.length)
  reviews: GoogleReview[]; // Place Details only returns up to 5
  placeUrl?: string; // direct link to the place on Google Maps
}

interface PlacesApiReview {
  author_name: string;
  author_url?: string;
  language?: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
}

interface PlacesApiResult {
  result?: {
    name?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: PlacesApiReview[];
    url?: string;
  };
  status: string;
  error_message?: string;
}

/**
 * Fetch reviews from the Google Places Details API. Server-only (uses an
 * env API key that must NOT be exposed to the browser).
 *
 * @returns null if configuration missing OR if the API call fails. Never throws.
 */
export async function fetchGoogleReviews(): Promise<GoogleReviewsData | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,rating,user_ratings_total,reviews,url");
  url.searchParams.set("reviews_sort", "newest");
  url.searchParams.set("language", "fr");
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString(), {
      // Cache 1 day at the Next.js data layer to spare the Places API quota.
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.warn(`[google-reviews] HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as PlacesApiResult;
    if (json.status !== "OK") {
      console.warn(`[google-reviews] API status ${json.status}: ${json.error_message ?? ""}`);
      return null;
    }
    const result = json.result;
    if (!result) return null;

    const reviews: GoogleReview[] = (result.reviews ?? []).map((r) => ({
      authorName: r.author_name,
      authorPhotoUrl: r.profile_photo_url,
      rating: r.rating,
      text: r.text,
      relativeTime: r.relative_time_description,
      language: r.language,
    }));

    return {
      rating: result.rating ?? 0,
      total: result.user_ratings_total ?? 0,
      reviews,
      placeUrl: result.url,
    };
  } catch (e) {
    console.warn(`[google-reviews] fetch error`, e);
    return null;
  }
}
