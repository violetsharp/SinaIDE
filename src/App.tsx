import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type * as Monaco from "monaco-editor";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { native, isDesktop } from "./native";
import { defaults, loadPreferences } from "./preferences";
import { applySave, dirty, uriIdentity } from "./types";
import type { Document, DiskDocument, FileEntry, Project } from "./types";
import { Search, Git, Basement, LanguagePanel } from "./Tools";
import type { LanguageTools } from "./languageTools";
const Editor = lazy(() => import("./Editor"));
const Debugger = lazy(() => import("./Debugger"));
type Tool =
  "observatory" | "notes" | "search" | "git" | "language" | "debug" | "world";
type Question = {
  title: string;
  detail: string;
  options: string[];
  input?: string;
  answer: (choice: string, text: string) => void;
};

function Modal({ question }: { question: Question }) {
  const [text, setText] = useState(question.input ?? "");
  const box = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = box.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className="sina-dialog"
      ref={box}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        question.answer("Cancel", text);
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          question.answer(question.options[0], text);
        }}
      >
        <span className="dialog-flower">✿</span>
        <h2 id="dialog-title">{question.title}</h2>
        <p>{question.detail}</p>
        {question.input !== undefined && (
          <input
            aria-label={question.title}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
        <div className="dialog-actions">
          {question.options.map((o, i) => (
            <button
              type="button"
              key={o}
              autoFocus={
                question.input === undefined &&
                i === question.options.length - 1
              }
              className={i === 0 ? "primary" : ""}
              onClick={() => question.answer(o, text)}
            >
              {o}
            </button>
          ))}
        </div>
      </form>
    </dialog>
  );
}
function Heading({
  glyph,
  title,
  sub,
  children,
}: {
  glyph: string;
  title: string;
  sub: string;
  children?: ReactNode;
}) {
  return (
    <div className="window-heading">
      <span className="window-glyph pink">{glyph}</span>
      <div>
        <strong>{title}</strong>
        <small>{sub}</small>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function App() {
  const [prefs, setPrefs] = useState(loadPreferences),
    [storageError, setStorageError] = useState(false);
  const [project, setProject] = useState<Project | null>(null),
    [pathInput, setPathInput] = useState(""),
    [directories, setDirectories] = useState<Record<string, FileEntry[]>>({}),
    [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [showHidden, setShowHidden] = useState(false),
    [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [docs, setDocs] = useState<Document[]>([]),
    [active, setActive] = useState(""),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState<string[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(
      "A little room of your own. Open a project to begin.",
    );
  const [tool, setTool] = useState<Tool>("observatory"),
    [garden, setGarden] = useState(true),
    [basement, setBasement] = useState(false),
    [question, setQuestion] = useState<Question | null>(null),
    [palette, setPalette] = useState(false),
    [query, setQuery] = useState(""),
    [commandIndex, setCommandIndex] = useState(0),
    [preview, setPreview] = useState(false),
    [previewUrl, setPreviewUrl] = useState("http://127.0.0.1:8000"),
    [previewSrc, setPreviewSrc] = useState("");
  const [position, setPosition] = useState({ line: 1, column: 1 }),
    [editor, setEditor] = useState<Monaco.editor.IStandaloneCodeEditor | null>(
      null,
    ),
    [breakpoints, setBreakpoints] = useState<Record<string, number[]>>({});
  const current = useRef({ docs, active, project, busy });
  current.current = { docs, active, project, busy };
  const lock = useRef(false),
    saves = useRef(new Set<string>()),
    questions = useRef(false),
    language = useRef<LanguageTools | null>(null),
    editorRef = useRef(editor);
  editorRef.current = editor;
  const goToLine = useRef<{ path: string; line: number } | null>(null);
  const report = (s: string) => {
    setError(s.replace(/^Error: /, ""));
  };
  const updateDocs = (fn: (v: Document[]) => Document[]) => {
    const next = fn(current.current.docs);
    current.current.docs = next;
    setDocs(next);
  };
  const ask = (
    title: string,
    detail: string,
    options: string[],
    input?: string,
  ) =>
    new Promise<{ choice: string; text: string }>((resolve) => {
      if (questions.current) {
        resolve({ choice: "Cancel", text: "" });
        return;
      }
      questions.current = true;
      setQuestion({
        title,
        detail,
        options,
        input,
        answer: (choice, text) => {
          questions.current = false;
          setQuestion(null);
          resolve({ choice, text });
        },
      });
    });
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      report(String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function saveDocument(path: string) {
    const doc = current.current.docs.find((d) => d.path === path);
    if (!doc || !dirty(doc) || saves.current.has(path)) return;
    saves.current.add(path);
    setSaving([...saves.current]);
    try {
      const snapshot = doc.contents;
      const revision = await native<string>("write_text_file", {
        path,
        contents: snapshot,
        expected: doc.revision,
      });
      updateDocs((v) =>
        v.map((d) => (d.path === path ? applySave(d, snapshot, revision) : d)),
      );
      setNotice(`Saved ${path}`);
      await language.current?.saved(doc);
    } finally {
      saves.current.delete(path);
      setSaving([...saves.current]);
    }
  }
  async function protect(documents: Document[]) {
    const modified = documents.filter(dirty);
    if (!modified.length) return true;
    const { choice } = await ask(
      "Keep your little changes?",
      `${modified.length} document(s) have unsaved edits: ${modified.map((d) => d.path).join(", ")}`,
      ["Save all", "Discard edits", "Cancel"],
    );
    if (choice === "Cancel") return false;
    if (choice === "Save all")
      for (const doc of modified) await saveDocument(doc.path);
    return true;
  }
  async function openProject(path?: string) {
    const target = path ?? pathInput;
    if (!target.trim()) {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Choose a place to make things",
      });
      if (typeof result === "string") await openProject(result);
      return;
    }
    if (!(await protect(current.current.docs))) return;
    const next = await native<Project>("open_workspace", { path: target });
    await language.current?.close();
    language.current = null;
    setProject(next);
    current.current.project = next;
    setPathInput(next.root);
    setDirectories({ "": next.entries });
    setExpanded(new Set());
    updateDocs(() => []);
    setActive("");
    setSelectedEntry(null);
    setBreakpoints({});
    setPreview(false);
    setPreviewSrc("");
    setPrefs((p) => ({
      ...p,
      recent: [next.root, ...p.recent.filter((v) => v !== next.root)].slice(
        0,
        8,
      ),
    }));
    setNotice(`Welcome to ${next.root.split(/[\\/]/).pop()}.`);
  }
  async function chooseProject() {
    const result = await open({
      directory: true,
      multiple: false,
      title: "Choose your project folder",
    });
    if (typeof result === "string") await openProject(result);
  }
  async function refresh() {
    const all = ["", ...expanded];
    const next: Record<string, FileEntry[]> = {};
    for (const path of all) {
      try {
        next[path] = await native<FileEntry[]>("read_directory", { path });
      } catch (e) {
        if (!path) throw e;
      }
    }
    setDirectories(next);
    setNotice("File Garden refreshed.");
  }
  async function openFile(path: string, line?: number) {
    const existing = current.current.docs.find((d) => d.path === path);
    if (!existing) {
      const disk = await native<DiskDocument>("read_text_file", { path });
      path = disk.path;
      updateDocs((v) =>
        v.some((d) => d.uri === disk.uri)
          ? v
          : [...v, { ...disk, saved: disk.contents }],
      );
    }
    setActive(path);
    current.current.active = path;
    if (line) goToLine.current = { path, line };
    setPreview(false);
    if (existing && line) {
      editorRef.current?.setPosition({ lineNumber: line, column: 1 });
      editorRef.current?.revealLineInCenter(line);
    }
  }
  const jump = (path: string, line = 1) => {
    const p = current.current.project;
    if (!p) return;
    let relative = path;
    try {
      if (path.startsWith("file:"))
        relative = decodeURIComponent(new URL(path).pathname).replace(
          /^\/(\w:)/,
          "$1",
        );
    } catch {
      report("Invalid tool source path.");
      return;
    }
    const normalized = relative.replaceAll("\\", "/"),
      root = p.root.replaceAll("\\", "/");
    if (normalized.startsWith(root + "/"))
      relative = normalized.slice(root.length + 1);
    void run(() => openFile(relative, line));
  };
  async function closeDoc(path: string) {
    const doc = current.current.docs.find((d) => d.path === path);
    if (!doc || !(await protect([doc]))) return;
    await language.current?.closeDocument(doc.uri);
    const remaining = current.current.docs.filter((d) => d.path !== path);
    updateDocs(() => remaining);
    if (current.current.active === path)
      setActive(remaining.at(-1)?.path ?? "");
  }
  async function reloadDoc() {
    const path = current.current.active,
      doc = current.current.docs.find((d) => d.path === path);
    if (!doc || !(await protect([doc]))) return;
    const disk = await native<DiskDocument>("read_text_file", { path });
    editorRef.current?.getModel()?.setValue(disk.contents);
    updateDocs((v) =>
      v.map((d) => (d.path === path ? { ...disk, saved: disk.contents } : d)),
    );
    setNotice("Reloaded the disk version.");
  }
  async function saveCopy() {
    const source = current.current.docs.find(
      (d) => d.path === current.current.active,
    );
    if (!source) return;
    const { choice, text } = await ask(
      "Save a copy of your little changes",
      "Enter a new project-relative filename. Your original buffer stays open.",
      ["Save copy", "Cancel"],
      source.path + ".copy",
    );
    if (choice !== "Save copy" || !text) return;
    await native("create_entry", { path: text, directory: false });
    const empty = await native<DiskDocument>("read_text_file", { path: text });
    await native("write_text_file", {
      path: text,
      contents: source.contents,
      expected: empty.revision,
    });
    await refresh();
    await openFile(text);
  }
  function affected(path: string) {
    return current.current.docs.filter(
      (d) => d.path === path || d.path.startsWith(path + "/"),
    );
  }
  async function create(directory: boolean) {
    const parent =
      selectedEntry?.kind === "directory" ? selectedEntry.path + "/" : "";
    const { choice, text } = await ask(
      directory ? "Plant a new folder" : "Make a new file",
      "Enter a project-relative path. Its parent folder must already exist.",
      ["Create", "Cancel"],
      parent,
    );
    if (choice !== "Create" || !text.trim()) return;
    await native("create_entry", { path: text, directory });
    await refresh();
    if (!directory) await openFile(text);
  }
  async function rename() {
    if (!selectedEntry) return;
    const entry = selectedEntry;
    if (affected(entry.path).length) {
      report(
        "Close documents inside this file or folder before renaming. Their edits will be protected.",
      );
      return;
    }
    const { choice, text } = await ask(
      "Give it a new name",
      "Enter the new project-relative path. Existing paths are never replaced.",
      ["Rename", "Cancel"],
      entry.path,
    );
    if (choice !== "Rename" || text === entry.path) return;
    await native("rename_entry", { path: entry.path, destination: text });
    setSelectedEntry(null);
    await refresh();
  }
  async function trash() {
    if (!selectedEntry) return;
    const entry = selectedEntry;
    if (affected(entry.path).length) {
      report(
        "Close the affected documents before removing this item. Your edits must be saved or discarded explicitly.",
      );
      return;
    }
    const { choice } = await ask(
      "Put this little thing away?",
      `${entry.path} will move into the project’s .sinaide recovery folder. It will not be permanently deleted.`,
      ["Move to recovery", "Cancel"],
    );
    if (choice !== "Move to recovery") return;
    const recovery = await native<string>("trash_entry", { path: entry.path });
    setSelectedEntry(null);
    await refresh();
    setNotice(`Recover this item from ${recovery}`);
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("sinaide.world.v1", JSON.stringify(prefs));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [prefs]);
  useEffect(() => {
    const t = setTimeout(() => {
      for (const d of current.current.docs)
        void language.current?.open(d).catch((e) => report(String(e)));
    }, 100);
    return () => clearTimeout(t);
  }, [docs.map((d) => d.uri).join("|")]);
  useEffect(() => {
    if (
      goToLine.current &&
      editor &&
      uriIdentity(editor.getModel()?.uri.toString() ?? "") ===
        uriIdentity(docs.find((d) => d.path === active)?.uri ?? "")
    ) {
      editor.setPosition({ lineNumber: goToLine.current.line, column: 1 });
      editor.revealLineInCenter(goToLine.current.line);
      editor.focus();
      goToLine.current = null;
    }
  }, [active, docs.length, editor]);
  useEffect(() => {
    let dispose: (() => void) | undefined,
      ended = false;
    if (isDesktop())
      void getCurrentWindow()
        .onCloseRequested((event) => {
          event.preventDefault();
          void run(async () => {
            if (await protect(current.current.docs)) {
              await language.current?.close();
              await getCurrentWindow().destroy();
            }
          });
        })
        .then((fn) => {
          if (ended) fn();
          else dispose = fn;
        });
    const before = (e: BeforeUnloadEvent) => {
      if (current.current.docs.some(dirty)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => {
      ended = true;
      dispose?.();
      window.removeEventListener("beforeunload", before);
    };
  }, []);
  const commands = [
    {
      label: "Open a project folder",
      key: "Ctrl / ⌘ O",
      action: () => void run(chooseProject),
    },
    {
      label: "Save this document",
      key: "Ctrl / ⌘ S",
      action: () => void run(() => saveDocument(current.current.active)),
    },
    {
      label: "Save every document",
      key: "Ctrl / ⌘ Shift S",
      action: () =>
        void run(async () => {
          for (const d of current.current.docs) await saveDocument(d.path);
        }),
    },
    {
      label: "Save a copy under a new name",
      key: "",
      action: () => void run(saveCopy),
    },
    {
      label: "New file in the File Garden",
      key: "",
      action: () => void run(() => create(false)),
    },
    {
      label: "Find in project",
      key: "Ctrl / ⌘ Shift F",
      action: () => setTool("search"),
    },
    {
      label: "Visit the Basement · tools & terminals",
      key: "",
      action: () => setBasement(true),
    },
    { label: "Check Git changes", key: "", action: () => setTool("git") },
    { label: "Open pocket notebook", key: "", action: () => setTool("notes") },
    {
      label: "Connect language tools",
      key: "",
      action: () => setTool("language"),
    },
    { label: "Open debugger", key: "", action: () => setTool("debug") },
    { label: "Make this world yours", key: "", action: () => setTool("world") },
    {
      label: "Toggle a quieter workspace",
      key: "",
      action: () => setPrefs((p) => ({ ...p, focus: !p.focus })),
    },
  ];
  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()),
  );
  const latestCommands = useRef(commands);
  latestCommands.current = commands;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (questions.current) return;
      const modifier = e.ctrlKey || e.metaKey;
      if (modifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setPalette((v) => !v);
      } else if (modifier && e.key.toLowerCase() === "s") {
        e.preventDefault();
        latestCommands.current[e.shiftKey ? 2 : 1].action();
      } else if (modifier && e.key.toLowerCase() === "o") {
        e.preventDefault();
        latestCommands.current[0].action();
      } else if (modifier && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setTool("search");
      } else if (
        modifier &&
        e.key.toLowerCase() === "w" &&
        current.current.active
      ) {
        e.preventDefault();
        void run(() => closeDoc(current.current.active));
      } else if (modifier && e.key === "Tab") {
        e.preventDefault();
        const d = current.current.docs,
          i = d.findIndex((d) => d.path === current.current.active);
        if (d.length)
          setActive(d[(i + (e.shiftKey ? d.length - 1 : 1)) % d.length].path);
      } else if (e.key === "Escape") {
        setPalette(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function tree(path: string, depth = 0): ReactNode {
    return (directories[path] ?? [])
      .filter((e) => showHidden || !e.hidden)
      .map((entry) => (
        <div
          key={entry.path}
          role="treeitem"
          aria-expanded={
            entry.kind === "directory" ? expanded.has(entry.path) : undefined
          }
        >
          <button
            className={`file-row ${selectedEntry?.path === entry.path ? "selected" : ""}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            title={entry.path + (entry.symlink ? " (symlink)" : "")}
            onClick={() => {
              setSelectedEntry(entry);
              void run(async () => {
                if (entry.kind === "file") await openFile(entry.path);
                else {
                  const next = new Set(expanded);
                  if (next.has(entry.path)) next.delete(entry.path);
                  else {
                    const children = await native<FileEntry[]>(
                      "read_directory",
                      { path: entry.path },
                    );
                    setDirectories((v) => ({ ...v, [entry.path]: children }));
                    next.add(entry.path);
                  }
                  setExpanded(next);
                }
              });
            }}
          >
            <span
              className={`file-icon ${entry.kind === "directory" ? "folder" : ""}`}
            >
              {entry.kind === "directory"
                ? expanded.has(entry.path)
                  ? "▾"
                  : "▸"
                : "◇"}
            </span>
            <span>
              {entry.name}
              {entry.symlink ? " ↗" : ""}
            </span>
            {docs.some((d) => d.path === entry.path && dirty(d)) && (
              <span className="file-star">●</span>
            )}
          </button>
          {entry.kind === "directory" && expanded.has(entry.path) && (
            <div role="group">{tree(entry.path, depth + 1)}</div>
          )}
        </div>
      ));
  }
  const doc = docs.find((d) => d.path === active);
  const name = project?.root.split(/[\\/]/).pop() ?? "your little world";
  const style = {
    "--garden-width": `${garden && !prefs.focus ? prefs.gardenWidth : 0}px`,
    "--observatory-width": `${prefs.focus ? 0 : prefs.observatoryWidth}px`,
    "--basement-height": `${prefs.basementHeight}px`,
  } as CSSProperties;
  const loadPreview = () => {
    try {
      const u = new URL(previewUrl);
      if (
        u.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(u.hostname) ||
        u.username ||
        u.password
      )
        throw Error("Use a local HTTP address, such as http://127.0.0.1:8000.");
      setPreviewSrc(u.toString());
    } catch (e) {
      report(String(e));
    }
  };
  return (
    <main
      className={`sina-app theme-${prefs.theme} ${prefs.reducedMotion ? "quiet-motion" : ""} ${prefs.focus ? "focus-world" : ""} ${prefs.swapSides ? "swap-sides" : ""}`}
      style={style}
    >
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-sigil" aria-hidden="true">
            ✳
          </div>
          <div>
            <div className="brand-name">
              sina<span>ide</span>
            </div>
            <div className="brand-subtitle">a place to make things</div>
          </div>
        </div>
        <nav className="menu-row" aria-label="Main menu">
          <button
            className="menu-item"
            onClick={() => {
              setQuery("");
              setPalette(true);
            }}
          >
            File ⌄
          </button>
          <button className="menu-item" onClick={() => void run(chooseProject)}>
            Project ↗
          </button>
          <button className="menu-item" onClick={() => setTool("world")}>
            World ✧
          </button>
        </nav>
        <div className="topbar-actions">
          <span
            className={`unsaved-dot ${docs.some(dirty) ? "dirty" : ""}`}
            title={docs.some(dirty) ? "Unsaved edits" : "No unsaved edits"}
          />
          <span className="workspace-label">{name}</span>
          <button
            className="icon-button"
            aria-label="Toggle quiet workspace"
            onClick={() => setPrefs((p) => ({ ...p, focus: !p.focus }))}
          >
            ☾
          </button>
          <button
            className="icon-button"
            aria-label="Open command palette"
            onClick={() => {
              setQuery("");
              setPalette(true);
            }}
          >
            ⌘K
          </button>
        </div>
      </header>
      <div className="world-banner">
        <div className="world-greeting">
          <span className="eyebrow">
            {prefs.name
              ? `${prefs.name.toUpperCase()}’S LITTLE CORNER OF THE UNIVERSE`
              : "YOUR LITTLE CORNER OF THE UNIVERSE"}
          </span>
          <h1>
            Make a little <em>something.</em>
          </h1>
          <p>
            {project
              ? `${name} is growing here. Take your time.`
              : "Your code, your thoughts, your own kind of strange."}
          </p>
        </div>
        <div className="weather-widget">
          <span className="weather-orb">✦</span>
          <div>
            <strong>creative weather</strong>
            <span>
              {docs.some(dirty)
                ? "a few ideas still blooming"
                : "mostly possibilities"}
            </span>
          </div>
          <span className="weather-spark">✧</span>
        </div>
        <span className="banner-doodle doodle-one">✳</span>
        <span className="banner-doodle doodle-two">⌁</span>
      </div>
      {(error || storageError) && (
        <div className="global-message error" role="alert">
          <span>
            ✦{" "}
            {error ||
              "Preferences could not be saved. This session still works."}
          </span>
          {error && <button onClick={() => setError("")}>Dismiss</button>}
        </div>
      )}
      <div className="desktop">
        <aside className="object-rail" aria-label="Workspace objects">
          <button
            className={`rail-object ${garden ? "active" : ""}`}
            onClick={() => {
              setGarden((v) => !v);
              if (prefs.focus) setPrefs((p) => ({ ...p, focus: false }));
            }}
          >
            <span>▤</span>
            <small>garden</small>
          </button>
          {(
            [
              ["notes", "✎", "notes"],
              ["search", "⌕", "find"],
              ["git", "⑂", "git"],
              ["debug", "♧", "debug"],
              ["world", "✧", "world"],
            ] as const
          ).map(([t, icon, label]) => (
            <button
              key={t}
              className={`rail-object ${tool === t ? "active" : ""}`}
              onClick={() => {
                setTool(t);
                if (prefs.focus) setPrefs((p) => ({ ...p, focus: false }));
              }}
            >
              <span>{icon}</span>
              <small>{label}</small>
            </button>
          ))}
          <div className="rail-spacer" />
          <button
            className={`rail-object ${basement ? "active" : ""}`}
            onClick={() => setBasement((v) => !v)}
          >
            <span>⌘</span>
            <small>basement</small>
          </button>
        </aside>
        <section
          className="workspace daily-workspace"
          aria-label="SinaIDE desktop workspace"
        >
          <section
            className="window-card garden-window"
            hidden={!garden || prefs.focus}
          >
            <Heading glyph="✿" title="file garden" sub="things growing here">
              <button
                title="Refresh tree"
                disabled={!project || busy}
                onClick={() => void run(refresh)}
              >
                ↻
              </button>
            </Heading>
            <form
              className="project-path-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => openProject());
              }}
            >
              <label htmlFor="project-path">A PLACE TO MAKE THINGS</label>
              <input
                id="project-path"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder="Paste a project folder path…"
              />
              <div className="tool-actions">
                <button disabled={busy}>Open path</button>
                <button
                  type="button"
                  disabled={busy || !isDesktop()}
                  onClick={() => void run(chooseProject)}
                >
                  Choose folder ↗
                </button>
              </div>
            </form>
            <div className="project-chip">
              <span className="folder-emoji">✿</span>
              <div>
                <strong>{name}</strong>
                <small title={project?.root}>
                  {project?.root ?? "waiting for a project"}
                </small>
              </div>
              <span className="chip-star">✦</span>
            </div>
            <div className="garden-tools">
              <button
                disabled={!project || busy}
                onClick={() => void run(() => create(false))}
              >
                ＋ file
              </button>
              <button
                disabled={!project || busy}
                onClick={() => void run(() => create(true))}
              >
                ＋ folder
              </button>
              <button
                disabled={!selectedEntry || busy}
                onClick={() => void run(rename)}
              >
                rename
              </button>
              <button
                disabled={!selectedEntry || busy}
                onClick={() => void run(trash)}
              >
                put away
              </button>
            </div>
            <label className="hidden-toggle">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              show hidden things
            </label>
            <div className="file-list" role="tree" aria-label="Project files">
              {project ? (
                tree("")
              ) : (
                <div className="empty-garden">
                  No rush. Plant a project here.<span>✿</span>
                  {prefs.recent.map((path) => (
                    <button
                      key={path}
                      title={path}
                      onClick={() => void run(() => openProject(path))}
                    >
                      {path.split(/[\\/]/).pop()} ↗
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="garden-footer">
              ✿ {selectedEntry?.path ?? "a place for your little things"}
            </div>
          </section>
          <section className="window-card editor-window">
            <Heading
              glyph="✳"
              title="the workbench"
              sub="where ideas become real"
            >
              <button
                disabled={!doc || busy}
                onClick={() => void run(reloadDoc)}
              >
                Reload disk
              </button>
              <button
                disabled={
                  !doc || !dirty(doc) || saving.includes(active) || busy
                }
                onClick={() => void run(() => saveDocument(active))}
              >
                {saving.includes(active) ? "Saving…" : "Save"}
              </button>
            </Heading>
            <div
              className="editor-tabs"
              role="tablist"
              aria-label="Open documents"
            >
              {docs.map((d) => (
                <div
                  className={`document-tab ${d.path === active ? "active" : ""}`}
                  key={d.path}
                >
                  <button
                    role="tab"
                    aria-selected={active === d.path}
                    title={d.path}
                    onClick={() => {
                      setActive(d.path);
                      setPreview(false);
                    }}
                  >
                    {dirty(d) ? "●" : "◇"} {d.path.split("/").pop()}
                  </button>
                  <button
                    aria-label={`Close ${d.path}`}
                    disabled={busy}
                    onClick={() => void run(() => closeDoc(d.path))}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="tab-spacer" />
              <button
                className="new-tab"
                aria-label="New file"
                disabled={!project || busy}
                onClick={() => void run(() => create(false))}
              >
                ＋
              </button>
              <button
                className="preview-toggle"
                onClick={() => setPreview((v) => !v)}
              >
                {preview ? "Code" : "Web ↗"}
              </button>
            </div>
            <div className="workbench-body">
              <div className="editor-mount" hidden={!doc || preview}>
                <Suspense
                  fallback={
                    <div className="editor-empty">Unpacking the workbench…</div>
                  }
                >
                  <Editor
                    docs={docs}
                    active={active}
                    theme={prefs.theme}
                    fontSize={prefs.fontSize}
                    disabled={busy}
                    onReady={(e) => {
                      setEditor(e);
                      editorRef.current = e;
                    }}
                    onChange={(uri, contents) => {
                      updateDocs((v) =>
                        v.map((d) => (d.uri === uri ? { ...d, contents } : d)),
                      );
                      language.current?.change(uri);
                    }}
                    onPosition={(line, column) => setPosition({ line, column })}
                    breakpoints={breakpoints}
                    onBreakpoint={(path, line) =>
                      setBreakpoints((v) => ({
                        ...v,
                        [path]: (v[path] ?? []).includes(line)
                          ? v[path].filter((n) => n !== line)
                          : [...(v[path] ?? []), line],
                      }))
                    }
                  />
                </Suspense>
              </div>
              {!doc && !preview && (
                <div className="editor-empty">
                  <span>✧</span>
                  <strong>Your workbench is waiting.</strong>
                  <p>
                    Open a project, choose a file, and make yourself at home.
                  </p>
                  <button
                    onClick={() => void run(chooseProject)}
                    disabled={!isDesktop()}
                  >
                    Choose a project folder ↗
                  </button>
                  <small>
                    {isDesktop()
                      ? "Ctrl / ⌘ O · open project   /   Ctrl / ⌘ K · little toolbox"
                      : "Browser preview · files and tools are available in the desktop app."}
                  </small>
                </div>
              )}
              {preview && (
                <div className="web-preview">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      loadPreview();
                    }}
                  >
                    <input
                      aria-label="Local preview URL"
                      value={previewUrl}
                      onChange={(e) => setPreviewUrl(e.target.value)}
                    />
                    <button>Load</button>
                  </form>
                  {previewSrc ? (
                    <iframe
                      title="Local website preview"
                      key={previewSrc}
                      src={previewSrc}
                      sandbox="allow-scripts allow-forms allow-same-origin"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="editor-empty">
                      <span>⌁</span>
                      <strong>A window into your website.</strong>
                      <p>
                        Start your PHP server in the Basement, then load its
                        local address here. Preview content has no native IDE
                        access.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="editor-footer">
              <span>
                {busy
                  ? "tending to things…"
                  : doc && dirty(doc)
                    ? "a few changes waiting to be saved"
                    : notice}
              </span>
              <span>
                Ln {position.line}, Col {position.column}
              </span>
              <span>UTF-8</span>
            </div>
          </section>
          <aside
            className="window-card observatory-window"
            hidden={prefs.focus}
          >
            <Heading glyph="✧" title="little observatory" sub="looking closer">
              <button
                title="Show observatory"
                onClick={() => setTool("observatory")}
              >
                ✦
              </button>
            </Heading>
            <nav className="tool-tabs" aria-label="Observatory tools">
              {(
                [
                  "observatory",
                  "notes",
                  "search",
                  "git",
                  "language",
                  "debug",
                  "world",
                ] as Tool[]
              ).map((t) => (
                <button
                  aria-pressed={tool === t}
                  key={t}
                  onClick={() => setTool(t)}
                >
                  {(
                    { observatory: "look", language: "tools" } as Record<
                      string,
                      string
                    >
                  )[t] ?? t}
                </button>
              ))}
            </nav>
            <div className="observatory-body">
              <div hidden={tool !== "observatory"}>
                <div className="observatory-art">
                  <div className="orbit orbit-a" />
                  <div className="orbit orbit-b" />
                  <div className="planet">✦</div>
                  <span className="starlet s1">✧</span>
                  <span className="starlet s3">✳</span>
                </div>
                <div className="inspector-section">
                  <span className="eyebrow">CURRENTLY LOOKING AT</span>
                  <strong>
                    {doc?.path ?? "a little space for possibilities"}
                  </strong>
                  <span className="muted-text">
                    {doc
                      ? `${doc.contents.split("\n").length} lines · ${new TextEncoder().encode(doc.contents).length} bytes · ${dirty(doc) ? "unsaved edits" : "saved snapshot"}`
                      : "There’s no right way to make this world yours."}
                  </span>
                </div>
                <div className="inspector-tags">
                  <span>curious</span>
                  <span>{doc ? "growing" : "unhurried"}</span>
                  <span>yours</span>
                </div>
                <button
                  className="inspector-action"
                  onClick={() => setTool("notes")}
                >
                  leave yourself a little note ↗
                </button>
                <button
                  className="inspector-action"
                  onClick={() => setBasement(true)}
                >
                  visit the basement · run your project ↗
                </button>
              </div>
              <div className="pocket-note" hidden={tool !== "notes"}>
                <span className="eyebrow">THOUGHTS BEFORE THEY FLY AWAY</span>
                <textarea
                  aria-label="Personal scratch note"
                  value={prefs.note}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, note: e.target.value }))
                  }
                  placeholder="a thought, a plan, a small spell…"
                />
                <p>✿ a note to future-you · saved on this computer</p>
              </div>
              {project && (
                <div key={project.root} className="project-tools">
                  <div hidden={tool !== "search"}>
                    <Search open={jump} error={report} />
                  </div>
                  <div hidden={tool !== "git"}>
                    <Git open={jump} error={report} />
                  </div>
                  <div hidden={tool !== "language"}>
                    <LanguagePanel
                      rootUri={project.uri}
                      docs={docs}
                      editor={editor}
                      error={report}
                      onJump={jump}
                      register={(v) => {
                        language.current = v;
                      }}
                    />
                  </div>
                  <div hidden={tool !== "debug"}>
                    <Suspense fallback={<p>Unpacking debugger…</p>}>
                      <Debugger
                        root={project.root}
                        breakpoints={breakpoints}
                        onJump={jump}
                        onError={report}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
              {!project &&
                ["search", "git", "language", "debug"].includes(tool) && (
                  <p className="tool-panel">Open a project to use this tool.</p>
                )}
              <div
                className="tool-panel world-settings"
                hidden={tool !== "world"}
              >
                <span className="eyebrow">MAKE YOURSELF AT HOME</span>
                <label>
                  Your name or a little nickname
                  <input
                    maxLength={50}
                    value={prefs.name}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="what should this world call you?"
                  />
                </label>
                <label>
                  Atmosphere
                  <select
                    value={prefs.theme}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        theme: e.target.value as typeof p.theme,
                      }))
                    }
                  >
                    <option value="midnight">Midnight studio</option>
                    <option value="garden">Paper garden</option>
                    <option value="berry">Berry after hours</option>
                  </select>
                </label>
                <label>
                  Editor font · {prefs.fontSize}px
                  <input
                    type="range"
                    min={10}
                    max={28}
                    value={prefs.fontSize}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, fontSize: +e.target.value }))
                    }
                  />
                </label>
                <label>
                  File Garden width
                  <input
                    type="range"
                    min={200}
                    max={420}
                    value={prefs.gardenWidth}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, gardenWidth: +e.target.value }))
                    }
                  />
                </label>
                <label>
                  Observatory width
                  <input
                    type="range"
                    min={240}
                    max={500}
                    value={prefs.observatoryWidth}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        observatoryWidth: +e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Basement height
                  <input
                    type="range"
                    min={150}
                    max={600}
                    value={prefs.basementHeight}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        basementHeight: +e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.swapSides}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, swapSides: e.target.checked }))
                    }
                  />
                  Swap Garden and Observatory
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.reducedMotion}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        reducedMotion: e.target.checked,
                      }))
                    }
                  />
                  Less motion, please
                </label>
                <button
                  onClick={() =>
                    setPrefs((p) => ({
                      ...defaults,
                      name: p.name,
                      note: p.note,
                      recent: p.recent,
                    }))
                  }
                >
                  Reset atmosphere & layout
                </button>
                <p className="tool-intro">
                  Settings stay on this computer. Project contents and database
                  passwords are never stored here.
                </p>
              </div>
            </div>
          </aside>
          {project && (
            <section className="window-card basement-window" hidden={!basement}>
              <Heading
                glyph="⌘"
                title="the basement"
                sub="real tools & mysterious machinery"
              >
                <button
                  aria-label="Hide Basement"
                  onClick={() => setBasement(false)}
                >
                  ⌄
                </button>
              </Heading>
              <Basement
                key={project.root}
                root={project.root}
                active={active}
                dirty={docs.some(dirty)}
                error={report}
                preview={() => setPreview(true)}
              />
            </section>
          )}
        </section>
      </div>
      <footer className="statusbar">
        <div>
          <span className="status-flower">✿</span>
          <span>{name}</span>
          <span className="status-divider">/</span>
          <span>
            {docs.length} open · {docs.filter(dirty).length} unsaved
          </span>
        </div>
        <div>
          <button onClick={() => setBasement((v) => !v)}>⌘ basement</button>
          <span className="status-heart">♥</span>
          <span>made for curiosity · 0.2.0</span>
        </div>
      </footer>
      {question && <Modal question={question} />}
      {palette && (
        <div className="palette-scrim" onClick={() => setPalette(false)}>
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Little toolbox"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const items = [
                  ...e.currentTarget.querySelectorAll<HTMLElement>(
                    "input,button:not(:disabled)",
                  ),
                ];
                const i = items.indexOf(document.activeElement as HTMLElement);
                if (items.length) {
                  e.preventDefault();
                  items[
                    (i + (e.shiftKey ? items.length - 1 : 1)) % items.length
                  ].focus();
                }
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCommandIndex((i) =>
                  filtered.length ? (i + 1) % filtered.length : 0,
                );
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setCommandIndex((i) =>
                  filtered.length
                    ? (i + filtered.length - 1) % filtered.length
                    : 0,
                );
              }
              if (e.key === "Enter") {
                e.preventDefault();
                const c = filtered[commandIndex];
                if (c) {
                  setPalette(false);
                  c.action();
                }
              }
            }}
          >
            <div className="palette-title">
              <span>✧</span>
              <input
                autoFocus
                placeholder="what are we looking for?"
                aria-label="Search commands"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCommandIndex(0);
                }}
              />
              <button onClick={() => setPalette(false)}>Esc</button>
            </div>
            <div className="palette-label">LITTLE THINGS YOU CAN DO</div>
            {filtered.map((c, i) => (
              <button
                className={i === commandIndex ? "highlighted" : ""}
                key={c.label}
                onMouseEnter={() => setCommandIndex(i)}
                onClick={() => {
                  setPalette(false);
                  c.action();
                }}
              >
                <span>✦</span>
                <span>{c.label}</span>
                {c.key && <kbd>{c.key}</kbd>}
              </button>
            ))}
            {!filtered.length && <p>No little powers match that search.</p>}
          </section>
        </div>
      )}
    </main>
  );
}
export default App;
