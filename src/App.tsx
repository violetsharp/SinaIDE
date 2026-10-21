import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type FileEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  hidden: boolean;
};
type ObjectName = "garden" | "inspector" | "console";
type ThemeName = "midnight" | "garden";

const initialVisibility: Record<ObjectName, boolean> = {
  garden: true,
  inspector: true,
  console: true,
};

const isDesktop = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function App() {
  const [theme, setTheme] = useState<ThemeName>("midnight");
  const [visibility, setVisibility] = useState(initialVisibility);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [projectPath, setProjectPath] = useState("");
  const [projectRoot, setProjectRoot] = useState("");
  const [directories, setDirectories] = useState<Record<string, FileEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activePath, setActivePath] = useState("");
  const [draft, setDraft] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Choose a local project to begin.");
  const pathInput = useRef<HTMLInputElement>(null);

  const dirty = activePath !== "" && draft !== savedContent;
  const activeName = activePath.split(/[\\/]/).filter(Boolean).at(-1) ?? "No file open";
  const projectName = projectRoot.split(/[\\/]/).filter(Boolean).at(-1) || "no project";

  const toggleObject = (name: ObjectName) => {
    setVisibility((current) => ({ ...current, [name]: !current[name] }));
  };

  async function loadDirectory(path: string) {
    if (!isDesktop()) {
      setError("Filesystem access is available in the SinaIDE desktop app, not the browser preview.");
      return;
    }
    const entries = await invoke<FileEntry[]>("read_directory", { path });
    setDirectories((current) => ({ ...current, [path]: entries }));
  }

  async function openProject(event?: React.FormEvent) {
    event?.preventDefault();
    const path = projectPath.trim();
    if (!path) {
      setError("Enter the full path to a project folder.");
      pathInput.current?.focus();
      return;
    }
    if (!isDesktop()) {
      setError("Run SinaIDE with `npm run tauri dev` to open local folders.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const entries = await invoke<FileEntry[]>("read_directory", { path });
      setProjectRoot(path);
      setDirectories({ [path]: entries });
      setExpanded(new Set());
      setActivePath("");
      setDraft("");
      setSavedContent("");
      setNotice(`Opened ${path}`);
    } catch (cause) {
      setError(`Could not open project: ${String(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDirectory(entry: FileEntry) {
    const next = new Set(expanded);
    if (next.has(entry.path)) {
      next.delete(entry.path);
      setExpanded(next);
      return;
    }

    setError("");
    try {
      if (!directories[entry.path]) await loadDirectory(entry.path);
      next.add(entry.path);
      setExpanded(next);
    } catch (cause) {
      setError(`Could not read folder: ${String(cause)}`);
    }
  }

  async function openFile(entry: FileEntry) {
    if (!isDesktop()) return;
    setBusy(true);
    setError("");
    try {
      const contents = await invoke<string>("read_text_file", { path: entry.path });
      setActivePath(entry.path);
      setDraft(contents);
      setSavedContent(contents);
      setNotice(`Opened ${entry.name}`);
    } catch (cause) {
      setError(`Could not open file: ${String(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveFile() {
    if (!activePath || !dirty || busy) return;
    if (!isDesktop()) {
      setError("Saving requires the SinaIDE desktop app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await invoke("write_text_file", { path: activePath, contents: draft });
      setSavedContent(draft);
      setNotice(`Saved ${activeName}`);
    } catch (cause) {
      setError(`Could not save file: ${String(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveFile();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        pathInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function renderEntries(path: string, depth = 0): React.ReactNode {
    const entries = directories[path] ?? [];
    return entries.filter((entry) => !entry.hidden).map((entry) => {
      const isDirectory = entry.kind === "directory";
      const isOpen = expanded.has(entry.path);
      const isActive = activePath === entry.path;
      return (
        <div key={entry.path}>
          <button
            className={`file-row ${isActive ? "selected" : ""}`}
            style={{ paddingLeft: 10 + depth * 15 }}
            onClick={() => isDirectory ? void toggleDirectory(entry) : void openFile(entry)}
            title={entry.path}
          >
            <span className={`file-icon ${isDirectory ? "folder" : ""}`}>
              {isDirectory ? (isOpen ? "▾" : "▸") : "◇"}
            </span>
            <span>{entry.name}</span>
            {isActive && <span className="file-star">{dirty ? "●" : "✦"}</span>}
          </button>
          {isDirectory && isOpen && renderEntries(entry.path, depth + 1)}
        </div>
      );
    });
  }

  return (
    <main className={`sina-app theme-${theme}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-sigil" aria-hidden="true">✳</div>
          <div><div className="brand-name">sina<span>ide</span></div><div className="brand-subtitle">a place to make things</div></div>
        </div>
        <nav className="menu-row" aria-label="Main menu">
          <button className="menu-item" onClick={() => pathInput.current?.focus()}>File <span>⌄</span></button>
          <button className="menu-item" onClick={() => pathInput.current?.focus()}>Project <span>⌄</span></button>
          <button className="menu-item" onClick={() => setVisibility(initialVisibility)}>Workspace <span>⌄</span></button>
        </nav>
        <div className="topbar-actions">
          <span className={dirty ? "unsaved-dot dirty" : "unsaved-dot"} title={dirty ? "Unsaved changes" : "All changes saved"} />
          <span className="workspace-label">{projectName}</span>
          <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === "midnight" ? "garden" : "midnight")}>{theme === "midnight" ? "☼" : "☾"}</button>
          <button className="icon-button" onClick={() => pathInput.current?.focus()} title="Open project (Ctrl+O)">⌘O</button>
        </div>
      </header>

      <div className="world-banner">
        <div className="world-greeting"><span className="eyebrow">YOUR LITTLE CORNER OF THE UNIVERSE</span><h1>Make a little <em>something.</em></h1><p>A real workspace, one small step at a time.</p></div>
        <div className="weather-widget"><span className="weather-orb">✦</span><div><strong>{projectRoot ? projectName : "creative weather"}</strong><span>{projectRoot ? "a project is growing" : "mostly possibilities"}</span></div><span className="weather-spark">✧</span></div>
        <span className="banner-doodle doodle-one">✳</span><span className="banner-doodle doodle-two">⌁</span>
      </div>

      <div className="desktop">
        <aside className="object-rail" aria-label="Workspace objects">
          <button className={visibility.garden ? "rail-object active" : "rail-object"} onClick={() => toggleObject("garden")}><span>▤</span><small>garden</small></button>
          <button className="rail-object active" title="Workbench"><span>▧</span><small>workbench</small></button>
          <button className={visibility.inspector ? "rail-object active" : "rail-object"} onClick={() => toggleObject("inspector")}><span>✧</span><small>inspect</small></button>
          <button className={visibility.console ? "rail-object active" : "rail-object"} onClick={() => toggleObject("console")}><span>⌘</span><small>console</small></button>
          <div className="rail-spacer" />
          <button className="rail-object" onClick={() => pathInput.current?.focus()}><span>✿</span><small>project</small></button>
        </aside>

        <section className="workspace" aria-label="SinaIDE desktop workspace">
          {visibility.garden && <section className="window-card garden-window">
            <div className="window-heading"><span className="window-glyph pink">✿</span><div><strong>file garden</strong><small>your project, rooted locally</small></div></div>
            <form className="project-path-form" onSubmit={openProject}>
              <label htmlFor="project-path">PROJECT FOLDER PATH</label>
              <input ref={pathInput} id="project-path" value={projectPath} onChange={(event) => setProjectPath(event.target.value)} placeholder="C:\\Users\\you\\Projects\\..." spellCheck={false} />
              <button type="submit" disabled={busy}>{busy ? "working…" : "Open folder ↗"}</button>
            </form>
            <div className="project-chip"><span className="folder-emoji">✿</span><div><strong>{projectName}</strong><small>{projectRoot || "No folder opened yet"}</small></div><span className="chip-star">✦</span></div>
            <div className="file-list">
              {projectRoot ? renderEntries(projectRoot) : <div className="empty-garden">No pretend files here.<br />Open a real folder to begin.</div>}
            </div>
            <div className="garden-footer"><span className="tiny-flower">✿</span> {projectRoot ? "filesystem-backed view" : "waiting for a project"}</div>
          </section>}

          <section className="window-card editor-window">
            <div className="window-heading editor-heading"><span className="window-glyph lavender">✳</span><div><strong>the workbench</strong><small>where ideas become real</small></div><span className="window-status">{dirty ? "unsaved" : activePath ? "saved" : "waiting"}</span></div>
            <div className="editor-tabs"><div className="editor-tab active"><span className="tab-gem">◈</span>{activeName}{dirty && <span className="tab-unsaved">●</span>}</div><div className="tab-spacer"/><span className="editor-language">{activePath ? activeName.split(".").at(-1)?.toUpperCase() : "NO FILE"} · UTF-8</span></div>
            <div className="real-editor">
              {activePath ? <textarea aria-label="File editor" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" /> : <div className="editor-empty"><span>✧</span><strong>The workbench is waiting.</strong><p>Open a text file from the File Garden to read and edit it.</p><small>Ctrl+O · open project &nbsp; / &nbsp; Ctrl+S · save file</small></div>}
            </div>
            <div className="editor-footer"><span><i className="status-pip"/>{busy ? "working…" : dirty ? "changes not saved" : notice}</span><span>{activePath ? `${draft.split("\n").length} lines` : "no document"}</span><button className="save-button" onClick={() => void saveFile()} disabled={!dirty || busy}>{busy ? "Working…" : "Save  Ctrl+S"}</button></div>
          </section>

          {visibility.inspector && <section className="window-card inspector-window">
            <div className="window-heading"><span className="window-glyph yellow">✧</span><div><strong>little observatory</strong><small>looking closer</small></div></div>
            <div className="observatory-art"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="planet">✦</div><span className="starlet s1">✧</span><span className="starlet s2">·</span><span className="starlet s3">✳</span></div>
            <div className="inspector-section"><span className="eyebrow">CURRENTLY LOOKING AT</span><strong>{activeName}</strong><span className="muted-text">{activePath || "Choose a file to inspect it."}</span></div>
            <div className="inspector-tags"><span>{activePath ? "text file" : "no selection"}</span><span>{dirty ? "modified" : "in sync"}</span><span>{isDesktop() ? "desktop" : "browser preview"}</span></div>
          </section>}

          {visibility.console && <section className={`window-card console-window ${consoleOpen ? "" : "collapsed"}`}>
            <div className="window-heading console-heading"><span className="window-glyph coral">⌘</span><div><strong>the basement</strong><small>workspace messages</small></div><span className="console-ready"><i/>{error ? "needs attention" : "standing by"}</span><button className="window-dots" onClick={() => setConsoleOpen(!consoleOpen)} aria-label={consoleOpen ? "Collapse messages" : "Expand messages"}>{consoleOpen ? "⌄" : "⌃"}</button></div>
            {consoleOpen && <div className={error ? "console-body error-message" : "console-body"}><span className="console-prompt">{error ? "!" : "✦"}</span><span className="console-output">{error || notice}</span>{error && <button className="clear-error" onClick={() => setError("")}>dismiss</button>}</div>}
          </section>}
        </section>
      </div>

      <footer className="statusbar"><div><span className="status-flower">✿</span><span>{projectName}</span><span className="status-divider">/</span><span>{projectRoot ? "local workspace" : "no project open"}</span></div><div><span className="status-heart">♥</span><span>{dirty ? "unsaved changes" : "made for curiosity"}</span><span className="status-divider">·</span><span>v0.1.0 / the beginning</span></div></footer>
    </main>
  );
}

export default App;
