export interface HttpTransportRequest {
  readonly url: string;
  readonly body: unknown;
  readonly timeoutMs: number;
}

export interface HttpTransportResponse {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfter: string | null;
}

export interface HttpTransport {
  request(request: HttpTransportRequest, apiKey: string, signal?: AbortSignal): Promise<HttpTransportResponse>;
}

export class TransportTimeoutError extends Error {
  constructor() {
    super('TRANSPORT_TIMEOUT');
    this.name = 'TransportTimeoutError';
  }
}

export class TransportAbortError extends Error {
  constructor() {
    super('TRANSPORT_ABORTED');
    this.name = 'TransportAbortError';
  }
}

export class TransportNetworkError extends Error {
  constructor() {
    super('TRANSPORT_NETWORK_ERROR');
    this.name = 'TransportNetworkError';
  }
}

export class FetchHttpTransport implements HttpTransport {
  async request(request: HttpTransportRequest, apiKey: string, signal?: AbortSignal): Promise<HttpTransportResponse> {
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort();
    if (signal?.aborted) throw new TransportAbortError();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, request.timeoutMs);

    try {
      const response = await globalThis.fetch(request.url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });
      const text = await response.text();
      let body: unknown = undefined;
      if (text.length > 0) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = undefined;
        }
      }
      return Object.freeze({
        status: response.status,
        body,
        retryAfter: response.headers.get('retry-after'),
      });
    } catch (error) {
      if (signal?.aborted) throw new TransportAbortError();
      if (timedOut) throw new TransportTimeoutError();
      if (error instanceof TransportAbortError || error instanceof TransportTimeoutError) throw error;
      throw new TransportNetworkError();
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
