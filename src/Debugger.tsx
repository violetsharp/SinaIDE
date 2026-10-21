import { useEffect, useRef, useState } from "react";
import { Protocol } from "./protocol";
import { parseArgs } from "./types";
import { configuredBreakpoints, debugConfiguration } from "./debugging";
import type { BreakpointRule, DebugCapabilities } from "./debugging";
type Props = {
  root: string;
  breakpoints: Record<string, number[]>;
  onJump: (path: string, line: number) => void;
  onError: (s: string) => void;
};
export default function Debugger({
  root,
  breakpoints,
  onJump,
  onError,
}: Props) {
  const [exe, setExe] = useState("lldb-dap");
  const [args, setArgs] = useState("[]");
  const [launch, setLaunch] = useState(
    '{\n  "program": "/full/path/to/program",\n  "args": [],\n  "stopOnEntry": true\n}',
  );
  const [status, setStatus] = useState("No debug adapter connected.");
  const [frames, setFrames] = useState<any[]>([]);
  const [variables, setVariables] = useState<any[]>([]);
  const [thread, setThread] = useState(0);
  const [log, setLog] = useState("");
  const [mode, setMode] = useState<"launch" | "attach">("launch");
  const [connected, setConnected] = useState(false),
    [paused, setPaused] = useState(false);
  const [rules, setRules] = useState<
    Record<string, Record<number, BreakpointRule>>
  >({});
  const [verified, setVerified] = useState<Record<string, string>>({});
  const [expression, setExpression] = useState(""),
    [watches, setWatches] = useState<string[]>([]),
    [values, setValues] = useState<Record<string, string>>({});
  const [consoleInput, setConsoleInput] = useState("");
  const frameId = useRef<number | undefined>(undefined),
    caps = useRef<DebugCapabilities>({});
  const watchRef = useRef(watches);
  watchRef.current = watches;
  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const stopping = useRef(false);
  const pauseEpoch = useRef(0);
  const client = useRef<Protocol | null>(null);
  const latest = useRef(breakpoints);
  latest.current = breakpoints;
  const note = (s: string) => setLog((v) => (v + "\n" + s).slice(-20000));
  async function sendBreakpoints(p: Protocol) {
    for (const [path, lines] of Object.entries(latest.current)) {
      const result = await p.request("setBreakpoints", {
        source: { path: `${root}/${path}` },
        breakpoints: configuredBreakpoints(
          lines,
          rulesRef.current[path] ?? {},
          caps.current,
        ),
      });
      if (client.current !== p) return;
      for (const [index, point] of (result?.breakpoints ?? []).entries())
        setVerified((v) => ({
          ...v,
          [`${path}:${lines[index]}`]: point.verified
            ? "verified"
            : point.message || "not verified",
        }));
    }
  }
  async function evaluateWatches(p: Protocol, frame: number) {
    const result = await Promise.all(
      watchRef.current.map(async (expression) => {
        try {
          const r = await p.request("evaluate", {
            expression,
            frameId: frame,
            context: "watch",
          });
          return [expression, String(r?.result ?? "")];
        } catch (e) {
          return [expression, String(e)];
        }
      }),
    );
    if (client.current === p && frameId.current === frame)
      setValues(Object.fromEntries(result));
  }
  function clearPause() {
    frameId.current = undefined;
    setPaused(false);
    setFrames([]);
    setVariables([]);
    setValues({});
  }
  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    const p = client.current;
    try {
      if (p)
        await p.request("disconnect", { terminateDebuggee: mode === "launch" });
    } catch {
      /* Always close the owned adapter even when disconnect is unsupported. */
    } finally {
      await p?.close();
      client.current = null;
      clearPause();
      setConnected(false);
      setStatus("Disconnected");
      stopping.current = false;
    }
  }
  async function inspect(p: Protocol, threadId: number) {
    const r = await p.request("stackTrace", {
      threadId,
      startFrame: 0,
      levels: 30,
    });
    if (client.current !== p || frameId.current === undefined) return;
    setFrames(r?.stackFrames ?? []);
    const frame = r?.stackFrames?.[0];
    if (frame) await scopes(p, frame);
  }
  async function scopes(p: Protocol, frame: any) {
    frameId.current = frame.id;
    if (frame.source?.path) onJump(frame.source.path, frame.line);
    const r = await p.request("scopes", { frameId: frame.id });
    if (client.current !== p || frameId.current !== frame.id) return;
    const scope = r?.scopes?.find((s: any) => !s.expensive) ?? r?.scopes?.[0];
    if (scope) {
      const v = await p.request("variables", {
        variablesReference: scope.variablesReference,
      });
      if (client.current === p && frameId.current === frame.id)
        setVariables(v?.variables ?? []);
    }
    await evaluateWatches(p, frame.id);
  }
  async function start() {
    if (connected || stopping.current) return;
    setConnected(true);
    clearPause();
    setVerified({});
    try {
      const config = debugConfiguration(launch, root);
      let launchPromise: Promise<any> | undefined;
      const p = new Protocol(
        "dap",
        (m) => {
          if (client.current !== p) return;
          if (m.event === "initialized") {
            void (async () => {
              await sendBreakpoints(p);
              if (caps.current.supportsConfigurationDoneRequest)
                await p.request("configurationDone");
            })().catch((e) => {
              onError(String(e));
              void stop();
            });
          }
          if (m.event === "stopped") {
            ++pauseEpoch.current;
            setStatus("Paused");
            setPaused(true);
            frameId.current = -1;
            void (async () => {
              const result = await p.request("threads");
              if (client.current !== p || frameId.current === undefined) return;
              const id = m.body?.threadId ?? result?.threads?.[0]?.id;
              if (id !== undefined) {
                setThread(id);
                await inspect(p, id);
              }
            })().catch((e) => onError(String(e)));
          }
          if (m.event === "continued") {
            clearPause();
            setStatus("Running");
          }
          if (m.event === "terminated" || m.event === "exited") {
            clearPause();
            setStatus("Program ended");
            void p.close();
          }
          if (m.event === "output") note(m.body.output);
        },
        note,
        () => {
          if (client.current === p) {
            client.current = null;
            setConnected(false);
            clearPause();
            setStatus((s) =>
              s === "Program ended" ? s : "Adapter disconnected",
            );
          }
        },
      );
      client.current = p;
      await p.start({ executable: exe, args: parseArgs(args), cwd: "" });
      if (client.current !== p) {
        await p.close();
        return;
      }
      caps.current = await p.request("initialize", {
        clientID: "sinaide",
        adapterID: "configured",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
        supportsRunInTerminalRequest: false,
      });
      setStatus(mode === "attach" ? "Attaching…" : "Launching…");
      launchPromise = p.request(mode, config);
      await launchPromise;
      setStatus((s) => (s === "Paused" ? s : "Running"));
    } catch (e) {
      onError(String(e));
      setStatus("Launch failed");
      await client.current?.close();
      client.current = null;
      setConnected(false);
    }
  }
  useEffect(() => {
    const p = client.current;
    if (p) void sendBreakpoints(p).catch((e) => onError(String(e)));
  }, [breakpoints]);
  useEffect(() => {
    const p = client.current,
      frame = frameId.current;
    if (p && frame !== undefined) void evaluateWatches(p, frame);
  }, [watches]);
  useEffect(
    () => () => {
      const p = client.current;
      client.current = null;
      void p?.close();
    },
    [],
  );
  const command = async (name: string) => {
    try {
      const epoch = pauseEpoch.current;
      await client.current?.request(name, { threadId: thread });
      if (name !== "pause" && pauseEpoch.current === epoch) {
        clearPause();
        setStatus("Running");
      }
    } catch (e) {
      onError(String(e));
    }
  };
  return (
    <div className="tool-panel">
      <p className="tool-intro">
        Bring your own DAP adapter. Nothing downloads or launches until you
        choose Start. PHP needs a PHP DAP adapter and Xdebug configured
        separately.
      </p>
      <fieldset disabled={connected}>
        <label>
          Debug connection
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "launch" | "attach")}
          >
            <option value="launch">Launch a program</option>
            <option value="attach">Attach / listen</option>
          </select>
        </label>
        <label>
          Adapter executable
          <input value={exe} onChange={(e) => setExe(e.target.value)} />
        </label>
        <label>
          Adapter arguments (JSON)
          <input value={args} onChange={(e) => setArgs(e.target.value)} />
        </label>
        <label>
          Debug configuration
          <textarea
            rows={7}
            value={launch}
            onChange={(e) => setLaunch(e.target.value)}
            spellCheck={false}
          />
        </label>
      </fieldset>
      <button disabled={!root || connected} onClick={() => void start()}>
        Start debugging
      </button>
      <p role="status">{status}</p>
      <div className="tool-actions">
        {["continue", "pause", "next", "stepIn", "stepOut"].map((c) => (
          <button
            key={c}
            disabled={!connected || (c === "pause" ? paused : !paused)}
            onClick={() => void command(c)}
          >
            {c}
          </button>
        ))}
        <button disabled={!connected} onClick={() => void stop()}>
          Stop
        </button>
      </div>
      <small>Click the editor gutter to set breakpoints.</small>
      <details>
        <summary>Breakpoints & conditions</summary>
        {Object.entries(breakpoints).flatMap(([path, lines]) =>
          lines.map((line) => (
            <div className="debug-breakpoint" key={`${path}:${line}`}>
              <strong>
                {path}:{line}
              </strong>
              <small>
                {verified[`${path}:${line}`] ?? "pending adapter verification"}
              </small>
              {(["condition", "hitCondition", "logMessage"] as const).map(
                (field) => (
                  <label key={field}>
                    {field === "condition"
                      ? "Condition"
                      : field === "hitCondition"
                        ? "Hit count"
                        : "Log message"}
                    <input
                      value={rules[path]?.[line]?.[field] ?? ""}
                      onChange={(e) =>
                        setRules((v) => ({
                          ...v,
                          [path]: {
                            ...v[path],
                            [line]: {
                              ...v[path]?.[line],
                              [field]: e.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>
                ),
              )}
              <button
                disabled={!connected}
                onClick={() => {
                  if (client.current)
                    void sendBreakpoints(client.current).catch((e) =>
                      onError(String(e)),
                    );
                }}
              >
                Apply conditions
              </button>
            </div>
          )),
        )}
      </details>
      <h3>Call stack</h3>
      {frames.map((f) => (
        <button
          className="result-row"
          key={f.id}
          onClick={() =>
            client.current &&
            void scopes(client.current, f).catch((e) => onError(String(e)))
          }
        >
          {f.name} : {f.line}
        </button>
      ))}
      <h3>Variables</h3>
      {variables.map((v, i) => (
        <div className="variable" key={i}>
          <strong>{v.name}</strong>
          <code>{v.value}</code>
          {v.variablesReference > 0 && (
            <button
              onClick={() =>
                void client.current
                  ?.request("variables", {
                    variablesReference: v.variablesReference,
                  })
                  .then((r) => setVariables(r.variables))
                  .catch((e) => onError(String(e)))
              }
            >
              expand
            </button>
          )}
        </div>
      ))}
      <h3>Watch garden</h3>
      <p className="tool-intro">
        Expressions can execute code in your program. Watches refresh when
        paused or when you select a frame.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = expression.trim();
          if (value && !watches.includes(value))
            setWatches((v) => [...v, value].slice(-30));
          setExpression("");
        }}
      >
        <label>
          Watch expression
          <input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
          />
        </label>
        <button>Add watch</button>
      </form>
      {watches.map((w) => (
        <div className="variable" key={w}>
          <strong>{w}</strong>
          <code>
            {paused ? (values[w] ?? "evaluating…") : "available when paused"}
          </code>
          <button
            aria-label={`Remove watch ${w}`}
            onClick={() => setWatches((v) => v.filter((x) => x !== w))}
          >
            ×
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const p = client.current;
          if (!p || !paused || !consoleInput.trim()) return;
          const expression = consoleInput;
          setConsoleInput("");
          note(`› ${expression}`);
          void p
            .request("evaluate", {
              expression,
              frameId: frameId.current,
              context: "repl",
            })
            .then((r) => note(String(r?.result ?? "")))
            .catch((e) => note(String(e)));
        }}
      >
        <label>
          Debug console
          <input
            disabled={!paused}
            value={consoleInput}
            onChange={(e) => setConsoleInput(e.target.value)}
          />
        </label>
        <button disabled={!paused}>Evaluate</button>
      </form>
      <pre className="tool-log">{log}</pre>
    </div>
  );
}
