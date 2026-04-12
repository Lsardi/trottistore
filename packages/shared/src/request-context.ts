type HeaderValue = string | string[] | undefined;

type RequestLike = {
  id?: string;
  headers?: Record<string, unknown>;
};

type ReplyLike = {
  header?: (name: string, value: string) => unknown;
};

type HookableApp = {
  addHook: (
    hook: "onRequest",
    fn: (request: RequestLike, reply: ReplyLike) => void | Promise<void>,
  ) => unknown;
};

const CONTEXT_KEY = "__trottistore_request_correlation";

export type RequestCorrelation = {
  request_id: string;
  order_id?: string;
  payment_intent_id?: string;
};

function readHeader(value: HeaderValue): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim().length > 0) {
    return value[0].trim();
  }
  return undefined;
}

function toHeaders(source: RequestLike): Record<string, unknown> {
  if (source && source.headers && typeof source.headers === "object") {
    return source.headers;
  }
  return {};
}

function getFallbackRequestId(): string {
  return `req_${Date.now().toString(36)}`;
}

export function getRequestCorrelation(
  source: RequestLike | (Record<string, unknown> & RequestLike),
): RequestCorrelation {
  const existing = (source as Record<string, unknown>)[CONTEXT_KEY];
  if (existing && typeof existing === "object") {
    const maybeCorrelation = existing as Partial<RequestCorrelation>;
    if (typeof maybeCorrelation.request_id === "string") {
      return {
        request_id: maybeCorrelation.request_id,
        order_id: typeof maybeCorrelation.order_id === "string" ? maybeCorrelation.order_id : undefined,
        payment_intent_id:
          typeof maybeCorrelation.payment_intent_id === "string" ? maybeCorrelation.payment_intent_id : undefined,
      };
    }
  }

  const headers = toHeaders(source);
  return {
    request_id: typeof source.id === "string" && source.id.length > 0 ? source.id : getFallbackRequestId(),
    order_id: readHeader(headers["x-order-id"] as HeaderValue),
    payment_intent_id: readHeader(headers["x-payment-intent-id"] as HeaderValue),
  };
}

export function mergeRequestCorrelation(
  base: RequestCorrelation,
  overrides: { order_id?: string; payment_intent_id?: string },
): RequestCorrelation {
  return {
    request_id: base.request_id,
    order_id: overrides.order_id ?? base.order_id,
    payment_intent_id: overrides.payment_intent_id ?? base.payment_intent_id,
  };
}

export function registerRequestCorrelation(app: HookableApp): void {
  app.addHook("onRequest", async (request, reply) => {
    const correlation = getRequestCorrelation(request);
    (request as Record<string, unknown>)[CONTEXT_KEY] = correlation;

    if (typeof reply.header === "function") {
      reply.header("x-request-id", correlation.request_id);
    }
  });
}
