import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import JsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import CssWorker from "monaco-editor/language/css/css.worker.js?worker";
import HtmlWorker from "monaco-editor/language/html/html.worker.js?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker.js?worker";
import type { Document } from "./types";
globalThis.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === "json"
      ? new JsonWorker()
      : ["css", "scss", "less"].includes(label)
        ? new CssWorker()
        : ["html", "handlebars", "razor"].includes(label)
          ? new HtmlWorker()
          : ["typescript", "javascript"].includes(label)
            ? new TsWorker()
            : new EditorWorker(),
};
export { monaco };
export function language(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  return (
    (
      {
        php: "php",
        html: "html",
        htm: "html",
        css: "css",
        js: "javascript",
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
        json: "json",
        sql: "pgsql",
        rs: "rust",
        c: "c",
        h: "c",
        cpp: "cpp",
        hpp: "cpp",
        cs: "csharp",
        md: "markdown",
        xml: "xml",
        yml: "yaml",
        yaml: "yaml",
        toml: "ini",
        py: "python",
        sh: "shell",
      } as Record<string, string>
    )[ext ?? ""] ?? "plaintext"
  );
}
monaco.editor.defineTheme("sina-midnight", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "A493B2", fontStyle: "italic" },
    { token: "string", foreground: "A8E7CE" },
    { token: "keyword", foreground: "D6A7FF" },
    { token: "number", foreground: "F5D78E" },
  ],
  colors: {
    "editor.background": "#211b2c",
    "editor.foreground": "#eee8f6",
    "editorLineNumber.foreground": "#857591",
    "editor.selectionBackground": "#60456e",
    "editor.lineHighlightBackground": "#2b2237",
    "editorCursor.foreground": "#f6a5cb",
    "editorWidget.background": "#282135",
    "editorWidget.border": "#60456e",
  },
});
monaco.editor.defineTheme("sina-garden", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#f7efe5",
    "editor.foreground": "#35293c",
    "editor.selectionBackground": "#dfc6de",
  },
});
monaco.editor.defineTheme("sina-berry", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#251c28",
    "editor.foreground": "#fce9ee",
    "editorCursor.foreground": "#ffb0c7",
    "editor.selectionBackground": "#684558",
  },
});
type Props = {
  docs: Document[];
  active: string;
  theme: string;
  fontSize: number;
  disabled: boolean;
  onChange: (path: string, text: string) => void;
  onPosition: (line: number, column: number) => void;
  onReady: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onBreakpoint: (path: string, line: number) => void;
  breakpoints: Record<string, number[]>;
};
export default function Editor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const owned = useRef(new Map<string, monaco.editor.ITextModel>());
  const views = useRef(new Map<string, monaco.editor.ICodeEditorViewState>());
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(
    null,
  );
  useEffect(() => {
    const e = monaco.editor.create(host.current!, {
      automaticLayout: true,
      fontFamily: '"DM Mono", monospace',
      fontSize: latest.current.fontSize,
      lineHeight: 23,
      minimap: { enabled: false },
      padding: { top: 16 },
      scrollBeyondLastLine: false,
      glyphMargin: true,
      tabSize: 2,
      ariaLabel: "File editor",
      renderWhitespace: "selection",
      fixedOverflowWidgets: true,
      smoothScrolling: false,
    });
    editor.current = e;
    decorations.current = e.createDecorationsCollection();
    const change = e.onDidChangeModelContent(() => {
      const model = e.getModel();
      const originalUri = [...owned.current].find(
        ([, value]) => value === model,
      )?.[0];
      if (model && originalUri)
        latest.current.onChange(originalUri, model.getValue());
    });
    const pos = e.onDidChangeCursorPosition((p) =>
      latest.current.onPosition(p.position.lineNumber, p.position.column),
    );
    const mouse = e.onMouseDown((event) => {
      if (
        event.target.type ===
          monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
        event.target.position
      ) {
        const d = latest.current.docs.find(
          (d) => owned.current.get(d.uri) === e.getModel(),
        );
        if (d)
          latest.current.onBreakpoint(d.path, event.target.position.lineNumber);
      }
    });
    latest.current.onReady(e);
    return () => {
      change.dispose();
      pos.dispose();
      mouse.dispose();
      e.dispose();
      for (const model of owned.current.values()) model.dispose();
      owned.current.clear();
    };
  }, []);
  useEffect(() => {
    const e = editor.current;
    if (!e) return;
    const previous = e.getModel();
    if (previous) {
      const view = e.saveViewState();
      if (view) views.current.set(previous.uri.toString(), view);
    }
    for (const doc of props.docs) {
      if (!owned.current.has(doc.uri))
        owned.current.set(
          doc.uri,
          monaco.editor.createModel(
            doc.contents,
            language(doc.path),
            monaco.Uri.parse(doc.uri),
          ),
        );
    }
    const current = props.docs.find((d) => d.path === props.active);
    const model = current ? owned.current.get(current.uri)! : null;
    if (e.getModel() !== model) {
      e.setModel(model);
      if (model && views.current.has(model.uri.toString()))
        e.restoreViewState(views.current.get(model.uri.toString())!);
    }
    for (const [uri, model] of owned.current)
      if (!props.docs.some((d) => d.uri === uri)) {
        model.dispose();
        owned.current.delete(uri);
        views.current.delete(uri);
      }
  }, [props.docs.map((d) => d.uri).join("|"), props.active]);
  useEffect(() => {
    monaco.editor.setTheme(`sina-${props.theme}`);
    editor.current?.updateOptions({
      fontSize: props.fontSize,
      readOnly: props.disabled,
    });
  }, [props.theme, props.fontSize, props.disabled]);
  useEffect(() => {
    decorations.current?.set(
      (props.breakpoints[props.active] ?? []).map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          glyphMarginClassName: "breakpoint-dot",
          glyphMarginHoverMessage: { value: "Breakpoint (click to remove)" },
        },
      })),
    );
  }, [props.breakpoints, props.active]);
  return <div className="monaco-host" ref={host} />;
}
