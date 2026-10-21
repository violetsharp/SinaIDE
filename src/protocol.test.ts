import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { native } from "./native";
import { Protocol } from "./protocol";
vi.mock("./native", () => ({ native: vi.fn() }));
const call = native as Mock;
let messages: string[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  messages = [];
  call.mockReset();
  call.mockImplementation(async (command: string) =>
    command === "start_process"
      ? 1
      : command === "poll_process"
        ? {
            chunks: messages.splice(0),
            errors: [],
            dropped: false,
            finished: false,
            exitCode: null,
            elapsedMs: 1,
          }
        : undefined,
  );
});
afterEach(() => vi.useRealTimers());
describe("language and debugger transport lifecycle", () => {
  it("correlates LSP responses and clears pending requests on close", async () => {
    const p = new Protocol("lsp", vi.fn(), vi.fn());
    await p.start({ executable: "fixture", args: [], cwd: "" });
    const response = p.request("initialize");
    messages.push(
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }),
    );
    await vi.advanceTimersByTimeAsync(60);
    await expect(response).resolves.toEqual({ capabilities: {} });
    const pending = p.request("textDocument/hover");
    const rejected = expect(pending).rejects.toThrow("closed");
    await p.close();
    await rejected;
    expect(call).toHaveBeenCalledWith("stop_process", { id: 1 });
  });
  it("routes DAP responses separately from events and surfaces adapter errors", async () => {
    const event = vi.fn();
    const p = new Protocol("dap", event, vi.fn());
    await p.start({ executable: "fixture", args: [], cwd: "" });
    const response = p.request("launch", { program: "/sample" });
    const rejected = expect(response).rejects.toThrow("Program is missing");
    messages.push(
      JSON.stringify({ type: "event", event: "initialized" }),
      JSON.stringify({
        type: "response",
        request_seq: 1,
        success: false,
        message: "Program is missing",
      }),
    );
    await vi.advanceTimersByTimeAsync(60);
    await rejected;
    expect(event).toHaveBeenCalledWith({ type: "event", event: "initialized" });
    await p.close();
  });
  it("rejects server initiated execution and never runs a requested command", async () => {
    const p = new Protocol("lsp", vi.fn(), vi.fn());
    await p.start({ executable: "fixture", args: [], cwd: "" });
    messages.push(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 99,
        method: "workspace/executeCommand",
        params: { command: "bad" },
      }),
    );
    await vi.advanceTimersByTimeAsync(60);
    const sent = call.mock.calls
      .filter((c) => c[0] === "send_process")
      .map((c) => JSON.parse(c[1].data));
    expect(sent.at(-1)).toMatchObject({ id: 99, error: { code: -32601 } });
    expect(
      call.mock.calls.filter((c) => c[0] === "start_process"),
    ).toHaveLength(1);
    await p.close();
  });
  it("malformed transport frames close the process and fail waiting requests", async () => {
    const log = vi.fn();
    const p = new Protocol("lsp", vi.fn(), log);
    await p.start({ executable: "fixture", args: [], cwd: "" });
    const pending = p.request("initialize");
    const rejected = expect(pending).rejects.toThrow("closed");
    messages.push('{"transportError":"bad frame"}');
    await vi.advanceTimersByTimeAsync(60);
    await rejected;
    expect(log).toHaveBeenCalledWith(expect.stringContaining("bad frame"));
  });
});
