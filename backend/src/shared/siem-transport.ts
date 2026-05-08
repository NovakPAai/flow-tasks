import { logger } from './utils/logger.js';

export interface SiemSink {
  name: string;
  send(event: Record<string, unknown>): Promise<void>;
}

class StdoutSink implements SiemSink {
  name = 'stdout';
  async send(event: Record<string, unknown>): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({ siem: true, ...event }));
    }
  }
}

export class HttpSink implements SiemSink {
  name = 'http';
  constructor(
    private readonly url: string,
    private readonly token?: string,
  ) {}

  async send(event: Record<string, unknown>): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}

class SiemTransport {
  private readonly sinks: SiemSink[] = [new StdoutSink()];

  addSink(sink: SiemSink): void {
    this.sinks.push(sink);
  }

  async emit(event: Record<string, unknown>): Promise<void> {
    const enriched = { ...event, forwarder: process.env.HOSTNAME ?? 'unknown', source: 'flow-tasks-backend' };
    await Promise.allSettled(
      this.sinks.map((sink) =>
        sink.send(enriched).catch((err) =>
          logger.error('siem.transport.error', { sink: sink.name, error: String(err) }),
        ),
      ),
    );
  }
}

export const siemTransport = new SiemTransport();

// Initialize extra sinks from env (called once at startup)
export function initSiemTransport(): void {
  const httpUrl = process.env.SIEM_HTTP_URL;
  const httpToken = process.env.SIEM_HTTP_TOKEN;
  if (httpUrl) {
    siemTransport.addSink(new HttpSink(httpUrl, httpToken));
    logger.info('siem.transport.http_sink_added', { url: httpUrl });
  }
}
