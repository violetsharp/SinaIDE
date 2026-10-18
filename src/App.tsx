import { useState } from "react";

type ObjectName = "garden" | "notebook" | "inspector" | "console";
type ThemeName = "midnight" | "garden";

const sampleFiles = [
  { name: "src", kind: "folder", depth: 0 },
  { name: "main.rs", kind: "rust", depth: 1 },
  { name: "lib.rs", kind: "rust", depth: 1 },
  { name: "the_little_world.tsx", kind: "react", depth: 1 },
  { name: "notes-from-the-moon.md", kind: "markdown", depth: 0 },
  { name: "Cargo.toml", kind: "config", depth: 0 },
];

const initialVisibility: Record<ObjectName, boolean> = {
  garden: true,
  notebook: true,
  inspector: true,
  console: true,
};

function App() {
  const [activeFile, setActiveFile] = useState("the_little_world.tsx");
  const [visibility, setVisibility] = useState(initialVisibility);
  const [theme, setTheme] = useState<ThemeName>("midnight");
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [note, setNote] = useState("remember to leave a little room for the impossible ✷");
  const [showPalette, setShowPalette] = useState(false);

  const toggleObject = (name: ObjectName) => {
    setVisibility((current) => ({ ...current, [name]: !current[name] }));
  };

  return (
    <main className={`sina-app theme-${theme}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-sigil" aria-hidden="true">✳</div>
          <div>
            <div className="brand-name">sina<span>ide</span></div>
            <div className="brand-subtitle">a place to make things</div>
          </div>
        </div>
        <nav className="menu-row" aria-label="Main menu">
          <button className="menu-item">File <span>⌄</span></button>
          <button className="menu-item">Project <span>⌄</span></button>
          <button className="menu-item">Navigate <span>⌄</span></button>
          <button className="menu-item">World <span>⌄</span></button>
        </nav>
        <div className="topbar-actions">
          <span className="unsaved-dot" title="Prototype state" />
          <span className="workspace-label">little world / 01</span>
          <button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === "midnight" ? "garden" : "midnight")}>{theme === "midnight" ? "☼" : "☾"}</button>
          <button className="icon-button" aria-label="Open command palette" onClick={() => setShowPalette(!showPalette)}>⌘K</button>
        </div>
      </header>

      <div className="world-banner">
        <div className="world-greeting"><span className="eyebrow">YOUR LITTLE CORNER OF THE UNIVERSE</span><h1>Make a little <em>something.</em></h1><p>Nothing here has to look like anywhere else.</p></div>
        <div className="weather-widget"><span className="weather-orb">✦</span><div><strong>creative weather</strong><span>mostly possibilities</span></div><span className="weather-spark">✧</span></div>
        <span className="banner-doodle doodle-one">✳</span><span className="banner-doodle doodle-two">⌁</span>
      </div>

      <div className="desktop">
        <aside className="object-rail" aria-label="Workspace objects">
          <button className={visibility.garden ? "rail-object active" : "rail-object"} onClick={() => toggleObject("garden")}><span>▤</span><small>garden</small></button>
          <button className="rail-object active"><span>▧</span><small>workbench</small></button>
          <button className={visibility.notebook ? "rail-object active" : "rail-object"} onClick={() => toggleObject("notebook")}><span>✎</span><small>notes</small></button>
          <button className={visibility.console ? "rail-object active" : "rail-object"} onClick={() => toggleObject("console")}><span>⌘</span><small>console</small></button>
          <div className="rail-spacer" />
          <button className="rail-object" onClick={() => setShowPalette(!showPalette)}><span>✧</span><small>more</small></button>
        </aside>

        <section className="workspace" aria-label="SinaIDE desktop workspace">
          {visibility.garden && <section className="window-card garden-window">
            <div className="window-heading"><span className="window-glyph pink">✿</span><div><strong>file garden</strong><small>things growing here</small></div><button className="window-dots" onClick={() => toggleObject("garden")} aria-label="Hide File Garden">•••</button></div>
            <div className="project-chip"><span className="folder-emoji">✿</span><div><strong>little-world</strong><small>project · local someday</small></div><span className="chip-star">✦</span></div>
            <div className="file-list">
              {sampleFiles.map((file) => <button key={file.name} className={`file-row ${activeFile === file.name ? "selected" : ""}`} style={{ paddingLeft: 12 + file.depth * 17 }} onClick={() => setActiveFile(file.name)}><span className={`file-icon ${file.kind}`}>{file.kind === "folder" ? "▾" : file.kind === "rust" ? "⚙" : file.kind === "react" ? "◈" : file.kind === "markdown" ? "☷" : "◇"}</span><span>{file.name}</span>{activeFile === file.name && <span className="file-star">✦</span>}</button>)}
            </div>
            <div className="garden-footer"><span className="tiny-flower">✿</span> 6 little things · sample view</div>
          </section>}

          <section className="window-card editor-window">
            <div className="window-heading editor-heading"><span className="window-glyph lavender">✳</span><div><strong>the workbench</strong><small>where ideas become real</small></div><span className="window-status">prototype</span><button className="window-dots" aria-label="Workbench options">•••</button></div>
            <div className="editor-tabs"><div className="editor-tab active"><span className="tab-gem">◈</span>{activeFile}<span className="tab-unsaved">●</span></div><button className="new-tab" aria-label="New tab">＋</button><div className="tab-spacer"/><span className="editor-language">TSX · UTF-8</span></div>
            <div className="code-area">
              <div className="line-numbers">{Array.from({length: 14}, (_, i) => <span key={i}>{i + 1}</span>)}</div>
              <pre className="code-content"><code><span className="code-muted">{"// a small spell for the everyday"}</span>{"\n"}<span className="code-purple">const</span> <span className="code-yellow">littleWorld</span> = {"{"}{"\n"}{"  "}<span className="code-blue">mood</span>: <span className="code-green">"curious"</span>,{"\n"}{"  "}<span className="code-blue">rules</span>: [<span className="code-green">"be strange"</span>,{"\n"}{"          "}<span className="code-green">"be kind"</span>,{"\n"}{"          "}<span className="code-green">"make things"</span>],{"\n"}{"  "}<span className="code-blue">magic</span>: <span className="code-orange">true</span>,{"\n"}{"};"}{"\n\n"}<span className="code-purple">function</span> <span className="code-yellow">makeSomething</span>() {"{"}{"\n"}{"  "}<span className="code-purple">return</span> <span className="code-green">"a world of your own"</span>;{"\n"}{"}"}{"\n\n"}<span className="code-muted">{"// TODO: make this actually edit files ✧"}</span></code></pre>
            </div>
            <div className="editor-footer"><span><i className="status-pip"/> all is well-ish</span><span>Ln 7, Col 18</span><span>spaces: 2</span></div>
          </section>

          {visibility.inspector && <section className="window-card inspector-window">
            <div className="window-heading"><span className="window-glyph yellow">✧</span><div><strong>little observatory</strong><small>looking closer</small></div><button className="window-dots" onClick={() => toggleObject("inspector")} aria-label="Hide Inspector">•••</button></div>
            <div className="observatory-art"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="planet">✦</div><span className="starlet s1">✧</span><span className="starlet s2">·</span><span className="starlet s3">✳</span></div>
            <div className="inspector-section"><span className="eyebrow">CURRENTLY LOOKING AT</span><strong>{activeFile}</strong><span className="muted-text">A tiny thing with potential.</span></div>
            <div className="inspector-tags"><span>curious</span><span>unfinished</span><span>alive-ish</span></div>
            <button className="inspector-action" onClick={() => setShowPalette(true)}>open the little toolbox <span>↗</span></button>
          </section>}

          {visibility.notebook && <section className="window-card notebook-window">
            <div className="window-heading"><span className="window-glyph mint">✎</span><div><strong>pocket notebook</strong><small>thoughts before they fly away</small></div><button className="window-dots" onClick={() => toggleObject("notebook")} aria-label="Hide Notebook">•••</button></div>
            <textarea aria-label="Personal scratch note" value={note} onChange={(event) => setNote(event.target.value)} />
            <div className="note-footer"><span>✿ a note to future-you</span><span>local prototype only</span></div>
          </section>}

          {visibility.console && <section className={`window-card console-window ${consoleOpen ? "" : "collapsed"}`}>
            <div className="window-heading console-heading"><span className="window-glyph coral">⌘</span><div><strong>the basement</strong><small>console &amp; mysterious machinery</small></div><span className="console-ready"><i/> resting</span><button className="window-dots" onClick={() => setConsoleOpen(!consoleOpen)} aria-label={consoleOpen ? "Collapse console" : "Expand console"}>{consoleOpen ? "⌄" : "⌃"}</button></div>
            {consoleOpen && <div className="console-body"><span className="console-prompt">✦</span><span className="console-command">sina</span><span className="console-output">welcome home. no commands have been run yet.</span><span className="console-cursor"/></div>}
          </section>}
        </section>
      </div>

      <footer className="statusbar"><div><span className="status-flower">✿</span><span>little-world</span><span className="status-divider">/</span><span>no git repo yet</span></div><div><span className="status-heart">♥</span><span>made for curiosity</span><span className="status-divider">·</span><span>v0.1.0 / the beginning</span></div></footer>

      {showPalette && <div className="palette-scrim" onClick={() => setShowPalette(false)}><section className="command-palette" onClick={(event) => event.stopPropagation()}><div className="palette-title"><span>✧</span><input autoFocus placeholder="what are we looking for?" aria-label="Search commands" /><kbd>ESC</kbd></div><div className="palette-label">LITTLE THINGS YOU CAN DO</div><button onClick={() => { setTheme(theme === "midnight" ? "garden" : "midnight"); setShowPalette(false); }}><span>☾</span><span>Change the atmosphere</span><kbd>↵</kbd></button><button onClick={() => { setVisibility(initialVisibility); setShowPalette(false); }}><span>✿</span><span>Bring all the objects back</span><kbd>↵</kbd></button><button onClick={() => { setConsoleOpen(!consoleOpen); setVisibility((v) => ({ ...v, console: true })); setShowPalette(false); }}><span>⌘</span><span>Peek into the basement</span><kbd>↵</kbd></button><p>more little powers will appear here.</p></section></div>}
    </main>
  );
}

export default App;
