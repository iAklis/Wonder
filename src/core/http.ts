/** Bounded requests work in both MV3 workers and extension pages. */
export async function request(url: string, options: RequestInit = {}, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Translation request timed out')), timeoutMs);
  try {
    const response = await fetch(url, {...options, signal: controller.signal});
    if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
    // Consume the body under the timeout, including stalled response streams.
    const body = await response.arrayBuffer();
    return new Response(body, {status: response.status, headers: response.headers});
  } finally { clearTimeout(timeout); }
}
/** Limits provider traffic without losing input order. Failed work never poisons retries. */
export class RequestQueue {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(readonly concurrency = 4) { if (concurrency < 1) throw new RangeError('Invalid concurrency'); }
  async run<T>(task: () => Promise<T>): Promise<T> {
    await new Promise<void>(resolve => { this.waiting.push(resolve); this.drain(); });
    try { return await task(); }
    finally { this.active--; this.drain(); }
  }
  private drain(): void {
    while (this.active < this.concurrency && this.waiting.length) { this.active++; this.waiting.shift()!(); }
  }
}
