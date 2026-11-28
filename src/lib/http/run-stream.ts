/**
 * EventSource cannot set headers. BYOK runs use fetch so the key stays
 * on the request and out of the URL.
 */

export type RunStream = {
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  close: () => void;
};

class HeaderEventSource implements RunStream {
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly abort = new AbortController();
  private closed = false;

  constructor(url: string, headers: Record<string, string>) {
    queueMicrotask(() => {
      void this.pump(url, headers);
    });
  }

  close() {
    this.closed = true;
    this.abort.abort();
  }

  private emitError(messageZh: string) {
    this.onmessage?.({
      data: JSON.stringify({
        id: crypto.randomUUID(),
        runId: "",
        seq: 0,
        agent: "engineer",
        type: "error",
        payload: { messageZh },
      }),
    });
  }

  private async pump(url: string, headers: Record<string, string>) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "text/event-stream", ...headers },
        signal: this.abort.signal,
      });
      if (this.closed) return;
      if (!response.ok || !response.body) {
        let messageZh = "生成失败，请稍后重试";
        try {
          const data = (await response.json()) as { messageZh?: string };
          if (typeof data.messageZh === "string" && data.messageZh) {
            messageZh = data.messageZh;
          }
        } catch {
          // Non-JSON error page.
        }
        this.emitError(messageZh);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!this.closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .find((entry) => entry.startsWith("data:"));
          if (!line) continue;
          this.onmessage?.({ data: line.slice("data:".length).trim() });
        }
      }
      if (!this.closed) this.onerror?.();
    } catch {
      if (!this.closed) this.onerror?.();
    }
  }
}

export function openRunStream(
  url: string,
  headers?: Record<string, string>,
): RunStream {
  if (!headers || Object.keys(headers).length === 0) {
    return new EventSource(url) as unknown as RunStream;
  }
  return new HeaderEventSource(url, headers);
}
