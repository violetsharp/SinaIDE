import { useEffect, useRef, useState } from "react";
import { Protocol } from "./protocol";
import { parseArgs } from "./types";
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
  const client = useRef<Protocol | null>(null);
  const latest = useRef(breakpoints);
  latest.current = breakpoints;
  const note = (s: string) => setLog((v) => (v + "\n" + s).slice(-20000));
  async function sendBreakpoints(p: Protocol) {
    for (const [path, lines] of Object.entries(latest.current))
      await p.request("setBreakpoints", {
        source: { path: `${root}/${path}` },
        breakpoints: lines.map((line) => ({ line })),
      });
  }
  async function inspect(p: Protocol, threadId: number) {
    const r = await p.request("stackTrace", {
      threadId,
      startFrame: 0,
      levels: 30,
    });
    setFrames(r?.stackFrames ?? []);
    const frame = r?.stackFrames?.[0];
    if (frame) await scopes(p, frame);
  }
  async function scopes(p: Protocol, frame: any) {
    if (frame.source?.path) onJump(frame.source.path, frame.line);
    const r = await p.request("scopes", { frameId: frame.id });
    const scope = r?.scopes?.find((s: any) => !s.expensive) ?? r?.scopes?.[0];
    if (scope) {
      const v = await p.request("variables", {
        variablesReference: scope.variablesReference,
      });
      setVariables(v?.variables ?? []);
    }
  }
  async function start() {
    if (client.current) await client.current.close();
    try {
      const config = JSON.parse(launch);
      if (!config || typeof config !== "object" || Array.isArray(config))
        throw Error("Launch configuration must be an object.");
      let launchPromise: Promise<any> | undefined;
      const p = new Protocol(
        "dap",
        (m) => {
          if (m.event === "initialized") {
            void (async () => {
              await sendBreakpoints(p);
              await p.request("configurationDone");
            })().catch((e) => onError(String(e)));
          }
          if (m.event === "stopped") {
            setStatus("Paused");
            setThread(m.body.threadId);
            void inspect(p, m.body.threadId).catch((e) => onError(String(e)));
          }
          if (m.event === "continued") setStatus("Running");
          if (m.event === "terminated" || m.event === "exited")
            setStatus("Program ended");
          if (m.event === "output") note(m.body.output);
        },
        note,
      );
      client.current = p;
      await p.start({ executable: exe, args: parseArgs(args), cwd: "" });
      await p.request("initialize", {
        clientID: "sinaide",
        adapterID: "configured",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
        supportsRunInTerminalRequest: false,
      });
      setStatus("Launching…");
      launchPromise = p.request("launch", { cwd: root, ...config });
      await launchPromise;
      setStatus((s) => (s === "Paused" ? s : "Running"));
    } catch (e) {
      onError(String(e));
      setStatus("Launch failed");
      await client.current?.close();
      client.current = null;
    }
  }
  useEffect(() => {
    const p = client.current;
    if (p) void sendBreakpoints(p).catch((e) => onError(String(e)));
  }, [breakpoints]);
  useEffect(
    () => () => {
      void client.current?.close();
    },
    [],
  );
  const command = async (name: string) => {
    try {
      await client.current?.request(name, { threadId: thread });
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
      <label>
        Adapter executable
        <input value={exe} onChange={(e) => setExe(e.target.value)} />
      </label>
      <label>
        Adapter arguments (JSON)
        <input value={args} onChange={(e) => setArgs(e.target.value)} />
      </label>
      <label>
        Launch configuration
        <textarea
          rows={7}
          value={launch}
          onChange={(e) => setLaunch(e.target.value)}
          spellCheck={false}
        />
      </label>
      <button disabled={!root} onClick={() => void start()}>
        Start debugging
      </button>
      <p role="status">{status}</p>
      <div className="tool-actions">
        {["continue", "pause", "next", "stepIn", "stepOut"].map((c) => (
          <button
            key={c}
            disabled={!client.current}
            onClick={() => void command(c)}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => {
            void client.current?.close();
            client.current = null;
            setStatus("Disconnected");
          }}
        >
          Stop
        </button>
      </div>
      <small>Click the editor gutter to set breakpoints.</small>
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
      <pre className="tool-log">{log}</pre>
    </div>
  );
}
