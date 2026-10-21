import { useEffect, useRef, useState } from "react";
import { native } from "./native";
import { parseArgs, parseGitStatus } from "./types";
import type { ProcessPoll, GitResult, ToolConfig, Document } from "./types";
import Terminal from "./Terminal";
import type { LanguageTools } from "./languageTools";
import type * as Monaco from "monaco-editor";

export function Search({
  open,
  error,
}: {
  open: (path: string, line?: number) => void;
  error: (s: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [sensitive, setSensitive] = useState(false),
    [filenames, setFilenames] = useState(false),
    [excludes, setExcludes] = useState("vendor,.idea");
  const [results, setResults] = useState<{
    hits: { path: string; line: number; preview: string }[];
    truncated: boolean;
    skipped: number;
    cancelled: boolean;
  }>();
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      void native("cancel_search").catch(() => {});
    },
    [],
  );
  async function run() {
    const g = ++generation.current;
    setBusy(true);
    try {
      const r = await native<NonNullable<typeof results>>("search_project", {
        query,
        caseSensitive: sensitive,
        filenames,
        excludes: excludes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (g === generation.current) setResults(r);
    } catch (e) {
      error(String(e));
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  return (
    <form
      className="tool-panel"
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <label>
        Find in your project
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="a little thing to find…"
        />
      </label>
      <div className="tool-actions">
        <label>
          <input
            type="checkbox"
            checked={sensitive}
            onChange={(e) => setSensitive(e.target.checked)}
          />
          Case sensitive
        </label>
        <label>
          <input
            type="checkbox"
            checked={filenames}
            onChange={(e) => setFilenames(e.target.checked)}
          />
          Filenames
        </label>
      </div>
      <label>
        Extra excluded folder names
        <input value={excludes} onChange={(e) => setExcludes(e.target.value)} />
      </label>
      <div className="tool-actions">
        <button disabled={busy || !query}>Search</button>
        <button
          type="button"
          disabled={!busy}
          onClick={() => {
            generation.current++;
            setBusy(false);
            void native("cancel_search").catch((e) => error(String(e)));
          }}
        >
          Cancel
        </button>
      </div>
      <p className="tool-intro">
        Respects .gitignore. Skips symlinks, generated folders, binary files and
        files over 2 MiB. Up to 1,000 matches.
      </p>
      {results && (
        <p role="status">
          {results.hits.length} matches
          {results.truncated ? " (limit reached)" : ""} · {results.skipped}{" "}
          skipped{results.cancelled ? " · cancelled" : ""}
        </p>
      )}
      {results?.hits.map((r, i) => (
        <button
          type="button"
          className="result-row"
          key={`${r.path}:${r.line}:${i}`}
          onClick={() => open(r.path, r.line)}
        >
          <strong>
            {r.path}:{r.line}
          </strong>
          <span>{r.preview}</span>
        </button>
      ))}
    </form>
  );
}
export function Git({
  open,
  error,
}: {
  open: (path: string) => void;
  error: (s: string) => void;
}) {
  const [files, setFiles] = useState<ReturnType<typeof parseGitStatus>>([]),
    [branch, setBranch] = useState(""),
    [diff, setDiff] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("Choose Refresh to inspect Git.");
  const act = async (action: string, path?: string, message?: string) => {
    const r = await native<GitResult>("git_action", { action, path, message });
    if (r.code !== 0)
      throw Error(r.stderr || r.stdout || `Git exited ${r.code}`);
    return r.stdout;
  };
  async function refresh() {
    setFiles(parseGitStatus(await act("status")));
    setBranch((await act("branch")).trim() || "detached HEAD");
    setNotice("Status refreshed.");
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      error(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tool-panel">
      <div className="tool-actions">
        <strong>{branch || "Git garden"}</strong>
        <button disabled={busy} onClick={() => void run(refresh)}>
          Refresh
        </button>
      </div>
      <p role="status">{notice}</p>
      {files.map((f) => (
        <div className="git-file" key={f.path}>
          <button className="result-row" onClick={() => open(f.path)}>
            <strong>
              {f.status} {f.path}
            </strong>
            {f.original && <span>from {f.original}</span>}
          </button>
          <div className="tool-actions">
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setDiff(await act("diff", f.path));
                })
              }
            >
              Diff
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setDiff(await act("staged_diff", f.path));
                })
              }
            >
              Staged diff
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await act("stage", f.path);
                  if (f.original) await act("stage", f.original);
                  await refresh();
                })
              }
            >
              Stage
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await act("unstage", f.path);
                  if (f.original) await act("unstage", f.original);
                  await refresh();
                })
              }
            >
              Unstage
            </button>
          </div>
        </div>
      ))}
      <label>
        Commit message
        <input value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <button
        disabled={busy || !message.trim()}
        onClick={() =>
          void run(async () => {
            const output = await act("commit", undefined, message);
            setMessage("");
            await refresh();
            setNotice(output);
          })
        }
      >
        Commit staged changes
      </button>
      <p className="tool-intro">
        Commits only staged changes. Hooks are disabled in SinaIDE. Remote
        operations are available through the terminal.
      </p>
      {diff && (
        <pre className="diff-view" tabIndex={0}>
          {diff}
        </pre>
      )}
    </div>
  );
}
type Session = {
  id: number;
  name: string;
  terminal: boolean;
  output: string;
  done: boolean;
  code?: number | null;
  elapsed?: number;
};
type WebTools = {
  php: string | null;
  psql: string | null;
  git: string | null;
  phpVersion: string;
  psqlVersion: string;
  phpPostgres: boolean;
  phpExtensionDir: string | null;
};
export function Basement({
  root,
  active,
  dirty,
  error,
  preview,
}: {
  root: string;
  active: string;
  dirty: boolean;
  error: (s: string) => void;
  preview: () => void;
}) {
  const windows = navigator.userAgent.includes("Windows");
  const [executable, setExecutable] = useState("php"),
    [args, setArgs] = useState('["-S","127.0.0.1:8000","-t","."]'),
    [cwd, setCwd] = useState(""),
    [terminal, setTerminal] = useState(false),
    [starting, setStarting] = useState(false),
    [sessions, setSessions] = useState<Session[]>([]),
    [selected, setSelected] = useState(0);
  const current = useRef(sessions);
  current.current = sessions;
  const polling = useRef(false);
  const [pgHost, setPgHost] = useState("localhost"),
    [pgDatabase, setPgDatabase] = useState(""),
    [pgUser, setPgUser] = useState("postgres"),
    [pgPort, setPgPort] = useState("5432"),
    [psqlPath, setPsqlPath] = useState("psql"),
    [webTools, setWebTools] = useState<WebTools | null>(null);
  async function checkTools() {
    try {
      const result = await native<WebTools>("check_web_tools");
      setWebTools(result);
      if (result.psql) setPsqlPath(result.psql);
      return result;
    } catch (e) {
      error(String(e));
      return null;
    }
  }
  async function phpPostgresPreset() {
    const tools = await checkTools();
    if (!tools?.php) return;
    const flags =
      !tools.phpPostgres && tools.phpExtensionDir
        ? [
            "-d",
            `extension_dir=${tools.phpExtensionDir}`,
            "-d",
            "extension=pdo_pgsql",
            "-d",
            "extension=pgsql",
          ]
        : [];
    preset(tools.php, [...flags, "-S", "127.0.0.1:8000", "-t", "."]);
  }
  async function start(
    config?: ToolConfig & { terminal?: boolean; name?: string },
  ) {
    setStarting(true);
    try {
      const c = config ?? { executable, args: parseArgs(args), cwd, terminal };
      const id = await native<number>("start_process", {
        executable: c.executable,
        args: c.args,
        cwd: c.cwd,
        mode: c.terminal ? "terminal" : "task",
      });
      setSessions((v) => [
        ...v,
        {
          id,
          name: c.name ?? c.executable,
          terminal: c.terminal ?? false,
          output: "",
          done: false,
        },
      ]);
      setSelected(id);
    } catch (e) {
      error(String(e));
    } finally {
      setStarting(false);
    }
  }
  useEffect(() => {
    let alive = true;
    const timer = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        for (const s of current.current.filter((s) => !s.terminal && !s.done)) {
          const p = await native<ProcessPoll>("poll_process", { id: s.id });
          if (!alive) return;
          setSessions((v) =>
            v.map((x) =>
              x.id === s.id
                ? {
                    ...x,
                    output: (
                      x.output +
                      (p.dropped ? "\n[Output trimmed]\n" : "") +
                      p.chunks.join("") +
                      p.errors.join("")
                    ).slice(-200000),
                    done: p.finished,
                    code: p.exitCode,
                    elapsed: p.elapsedMs,
                  }
                : x,
            ),
          );
        }
      } catch (e) {
        if (alive) error(String(e));
      } finally {
        polling.current = false;
      }
    }, 120);
    return () => {
      alive = false;
      clearInterval(timer);
      for (const s of current.current)
        void native("stop_process", { id: s.id }).catch(() => {});
    };
  }, []);
  const preset = (exe: string, arguments_: string[], isTerminal = false) => {
    setExecutable(exe);
    setArgs(JSON.stringify(arguments_));
    setTerminal(isTerminal);
    setCwd("");
  };
  return (
    <div className="basement-content">
      <div className="task-presets">
        <button onClick={() => void checkTools()}>Check web tools</button>
        <button onClick={() => void phpPostgresPreset()}>
          PHP + PostgreSQL
        </button>
        <button
          onClick={() => preset("php", ["-S", "127.0.0.1:8000", "-t", "."])}
        >
          PHP server
        </button>
        <button
          disabled={!active}
          onClick={() => preset("php", ["-l", active])}
        >
          PHP syntax check
        </button>
        <button
          onClick={() =>
            preset(
              windows ? "powershell.exe" : "/bin/zsh",
              windows ? ["-NoLogo"] : [],
              true,
            )
          }
        >
          Shell
        </button>
        <button
          onClick={() => preset(windows ? "npm.cmd" : "npm", ["run", "dev"])}
        >
          npm dev
        </button>
        <button onClick={() => preset("cargo", ["check"])}>Rust check</button>
        <button onClick={() => preset("cmake", ["--build", "build"])}>
          C++ build
        </button>
        <button onClick={preview}>Web preview ↗</button>
      </div>
      <details className="task-settings" open={!sessions.length}>
        <summary>
          Run a tool · {executable} · {cwd || "project root"}
        </summary>
        <form
          className="task-form"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <label>
            Executable
            <input
              value={executable}
              onChange={(e) => setExecutable(e.target.value)}
              placeholder="php or full path"
            />
          </label>
          <label>
            Arguments (JSON array)
            <input
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              spellCheck={false}
            />
          </label>
          <label>
            Working folder (relative)
            <input
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="project root"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={terminal}
              onChange={(e) => setTerminal(e.target.checked)}
            />
            Interactive terminal
          </label>
          <button disabled={!root || starting}>Run</button>
        </form>
        {dirty && (
          <p className="tool-warning">
            Save your edits first. Tools read files from disk.
          </p>
        )}
        <p className="tool-intro">
          Run starts the tool shown above in {root || "the selected project"}.
          Nothing runs on project open. Use a shell session for shell syntax;
          task arguments are passed directly.
        </p>
      </details>
      {webTools && (
        <details className="tool-health" open>
          <summary>Web tools on this computer</summary>
          <pre>
            {webTools.phpVersion.split("\n")[0]}
            {"\n"}
            {webTools.psqlVersion.trim()}
            {"\n"}PHP PostgreSQL driver:{" "}
            {webTools.phpPostgres
              ? "enabled"
              : "not enabled in default php.ini"}
          </pre>
          {!webTools.phpPostgres && (
            <p className="tool-intro">
              Use PHP + PostgreSQL to prepare per-process extension flags on
              Windows when the DLLs are available. Review the arguments, then
              Run. Your system php.ini is unchanged. On macOS enable pdo_pgsql
              in your PHP installation.
            </p>
          )}
        </details>
      )}
      <details className="postgres-settings">
        <summary>PostgreSQL · interactive psql connection</summary>
        <div className="task-form">
          <label>
            Host
            <input value={pgHost} onChange={(e) => setPgHost(e.target.value)} />
          </label>
          <label>
            Port
            <input value={pgPort} onChange={(e) => setPgPort(e.target.value)} />
          </label>
          <label>
            psql executable
            <input
              value={psqlPath}
              onChange={(e) => setPsqlPath(e.target.value)}
            />
          </label>
          <label>
            Database
            <input
              value={pgDatabase}
              onChange={(e) => setPgDatabase(e.target.value)}
            />
          </label>
          <label>
            User
            <input value={pgUser} onChange={(e) => setPgUser(e.target.value)} />
          </label>
          <button
            disabled={!root || !pgDatabase || starting}
            onClick={() =>
              void start({
                executable: psqlPath,
                args: [
                  "-X",
                  "-P",
                  "pager=off",
                  "-h",
                  pgHost,
                  "-p",
                  pgPort,
                  "-U",
                  pgUser,
                  "-d",
                  pgDatabase,
                  "-W",
                ],
                cwd: "",
                terminal: true,
                name: "PostgreSQL",
              })
            }
          >
            Connect
          </button>
        </div>
        <p className="tool-intro">
          Requires psql and a running PostgreSQL server. Enter the password
          directly in its terminal prompt; SinaIDE does not save it. SQL
          commands affect the selected database.
        </p>
      </details>
      <div
        className="session-tabs"
        role="tablist"
        aria-label="Process sessions"
      >
        {sessions.map((s) => (
          <div key={s.id}>
            <button
              role="tab"
              aria-selected={s.id === selected}
              onClick={() => setSelected(s.id)}
            >
              {s.name} {s.done ? `· ${s.code}` : "· running"}
            </button>
            <button
              aria-label={`Close ${s.name} session`}
              onClick={() => {
                void native("stop_process", { id: s.id })
                  .then(() => {
                    setSessions((v) => v.filter((x) => x.id !== s.id));
                    if (s.id === selected)
                      setSelected(
                        current.current.find((x) => x.id !== s.id)?.id ?? 0,
                      );
                  })
                  .catch((e) => error(String(e)));
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {sessions.length === 0 && (
        <p className="basement-empty">
          ✦ The machinery is resting. Choose a tool, review its arguments, then
          Run.
        </p>
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          className="session-view"
          style={{ display: s.id === selected ? "flex" : "none" }}
        >
          {s.terminal ? (
            <Terminal id={s.id} onError={error} />
          ) : (
            <>
              <div className="process-status">
                {s.done ? `Exited ${s.code}` : "Running"} ·{" "}
                {((s.elapsed ?? 0) / 1000).toFixed(1)}s
                <button
                  onClick={() => {
                    void native("stop_process", { id: s.id })
                      .then(() =>
                        setSessions((v) =>
                          v.map((x) =>
                            x.id === s.id ? { ...x, done: true, code: -1 } : x,
                          ),
                        ),
                      )
                      .catch((e) => error(String(e)));
                  }}
                >
                  Stop
                </button>
              </div>
              <pre className="process-output" tabIndex={0}>
                {s.output || "Waiting for output…"}
              </pre>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
export function LanguagePanel({
  rootUri,
  docs,
  editor,
  error,
  onJump,
  register,
}: {
  rootUri: string;
  docs: Document[];
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  error: (s: string) => void;
  onJump: (uri: string, line: number) => void;
  register: (tool: LanguageTools | null) => void;
}) {
  const [executable, setExecutable] = useState("phpactor"),
    [args, setArgs] = useState('["language-server"]'),
    [lang, setLang] = useState("php"),
    [log, setLog] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false);
  const client = useRef<LanguageTools | null>(null);
  const allDocs = useRef(docs);
  allDocs.current = docs;
  const note = (s: string) => setLog((v) => (v + "\n" + s).slice(-20000));
  useEffect(
    () => () => {
      register(null);
      void client.current?.close();
    },
    [],
  );
  async function start() {
    setBusy(true);
    try {
      await client.current?.close();
      const { LanguageTools } = await import("./languageTools");
      const c = new LanguageTools(
        lang.split(",").map((s) => s.trim()),
        note,
        onJump,
      );
      client.current = c;
      await c.start(
        { executable, args: parseArgs(args), cwd: "" },
        rootUri,
        allDocs.current,
      );
      register(c);
      setConnected(true);
    } catch (e) {
      error(String(e));
      await client.current?.close();
      register(null);
      setConnected(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tool-panel">
      <p className="tool-intro">
        Monaco includes HTML/CSS/JavaScript tooling. Connect an installed
        language server for PHP, Rust, or another language. Nothing downloads
        automatically.
      </p>
      <div className="tool-actions">
        <button
          onClick={() => {
            setExecutable("phpactor");
            setArgs('["language-server"]');
            setLang("php");
          }}
        >
          PHP
        </button>
        <button
          onClick={() => {
            setExecutable("rust-analyzer");
            setArgs("[]");
            setLang("rust");
          }}
        >
          Rust
        </button>
        <button
          onClick={() => {
            setExecutable("clangd");
            setArgs("[]");
            setLang("cpp,c");
          }}
        >
          C/C++
        </button>
        <button
          onClick={() => {
            setExecutable("typescript-language-server");
            setArgs('["--stdio"]');
            setLang("typescript,javascript");
          }}
        >
          TS/JS
        </button>
      </div>
      <label>
        Server executable
        <input
          value={executable}
          onChange={(e) => setExecutable(e.target.value)}
        />
      </label>
      <label>
        Arguments (JSON)
        <input value={args} onChange={(e) => setArgs(e.target.value)} />
      </label>
      <label>
        Monaco language IDs
        <input value={lang} onChange={(e) => setLang(e.target.value)} />
      </label>
      <button disabled={!rootUri || busy} onClick={() => void start()}>
        {busy ? "Connecting…" : "Connect language server"}
      </button>
      <div className="tool-actions">
        <button
          disabled={!connected}
          onClick={() => {
            void client.current?.close();
            register(null);
            setConnected(false);
          }}
        >
          Disconnect
        </button>
        <button
          disabled={!connected || !editor}
          onClick={() =>
            editor &&
            void client.current
              ?.definition(editor)
              .catch((e) => error(String(e)))
          }
        >
          Go to definition
        </button>
      </div>
      <p className="tool-intro">
        Diagnostics, hover, plain-text completion and definition navigation are
        supported when the server provides them. Server-requested commands and
        edits are refused.
      </p>
      <pre className="tool-log">{log}</pre>
    </div>
  );
}
