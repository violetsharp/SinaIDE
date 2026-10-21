import { native } from "./native";
import type { ProcessPoll, ToolConfig } from "./types";
// A bounded stdio transport shared by the two different protocols. Each client owns its session state.
export class Protocol {
  id = 0;
  sequence = 0;
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;
  private closed = false;
  private pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    private kind: "lsp" | "dap",
    private event: (message: any) => void,
    private log: (message: string) => void,
    private onClose: () => void = () => {},
  ) {}
  async start(config: ToolConfig) {
    this.id = await native<number>("start_process", {
      ...config,
      mode: "protocol",
    });
    if (this.closed) {
      await native("stop_process", { id: this.id });
      throw Error("Tool session was closed during startup.");
    }
    this.timer = setInterval(() => void this.poll(), 60);
  }
  private async poll() {
    if (this.polling || this.closed) return;
    this.polling = true;
    try {
      const p = await native<ProcessPoll>("poll_process", { id: this.id });
      if (this.closed) return;
      for (const s of p.errors) this.log(s);
      if (p.dropped)
        throw Error("Protocol output overflowed. Restart the tool.");
      for (const text of p.chunks) {
        const m = JSON.parse(text);
        if (m.transportError) throw Error(m.transportError);
        const response =
          this.kind === "lsp" ? "id" in m && !m.method : m.type === "response";
        if (response) {
          const id = this.kind === "lsp" ? m.id : m.request_seq;
          const pending = this.pending.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(id);
            if (m.error || m.success === false)
              pending.reject(
                Error(m.error?.message ?? m.message ?? "Tool request failed"),
              );
            else pending.resolve(this.kind === "lsp" ? m.result : m.body);
          }
        } else if (this.kind === "lsp" && m.method && "id" in m) {
          // Never apply server edits, download tools, or run commands without a user decision.
          const result =
            m.method === "workspace/configuration"
              ? (m.params?.items ?? []).map(() => ({}))
              : null;
          await this.send({
            jsonrpc: "2.0",
            id: m.id,
            ...(m.method === "workspace/configuration"
              ? { result }
              : {
                  error: {
                    code: -32601,
                    message:
                      "This client does not support server-initiated actions.",
                  },
                }),
          });
        } else if (this.kind === "dap" && m.type === "request") {
          await this.send({
            seq: ++this.sequence,
            type: "response",
            request_seq: m.seq,
            command: m.command,
            success: false,
            message: "Server-initiated execution is not supported.",
          });
        } else this.event(m);
      }
      if (p.finished) throw Error(`Tool exited with code ${p.exitCode}.`);
    } catch (e) {
      this.log(String(e));
      await this.close();
    } finally {
      this.polling = false;
    }
  }
  private send(message: unknown) {
    return native("send_process", {
      id: this.id,
      data: JSON.stringify(message),
    });
  }
  notify(method: string, params?: unknown) {
    return this.send({ jsonrpc: "2.0", method, params });
  }
  request(method: string, params: unknown = {}): Promise<any> {
    if (this.closed) return Promise.reject(Error("Tool session is closed."));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error(`${method} timed out after 15 seconds.`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      void this.send(
        this.kind === "lsp"
          ? { jsonrpc: "2.0", id, method, params }
          : { seq: id, type: "request", command: method, arguments: params },
      ).catch((e) => {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(Error(String(e)));
      });
    });
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    this.onClose();
    clearInterval(this.timer);
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("Tool session closed."));
    }
    this.pending.clear();
    if (this.id)
      await native("stop_process", { id: this.id }).catch((e) =>
        this.log(String(e)),
      );
  }
}
