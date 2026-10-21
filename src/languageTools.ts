import { monaco, language } from "./Editor";
import { Protocol } from "./protocol";
import type { ToolConfig, Document } from "./types";
export class LanguageTools {
  connection: Protocol;
  private disposables: monaco.IDisposable[] = [];
  private versions = new Map<string, number>();
  private languages: string[];
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    languages: string[],
    private log: (s: string) => void,
    private jump: (uri: string, line: number) => void,
  ) {
    this.languages = languages;
    this.connection = new Protocol(
      "lsp",
      (m) => {
        if (m.method === "textDocument/publishDiagnostics") {
          const model = monaco.editor.getModel(monaco.Uri.parse(m.params.uri));
          if (model)
            monaco.editor.setModelMarkers(
              model,
              "sina-lsp",
              (m.params.diagnostics ?? []).map((d: any) => ({
                startLineNumber: d.range.start.line + 1,
                startColumn: d.range.start.character + 1,
                endLineNumber: d.range.end.line + 1,
                endColumn: d.range.end.character + 1,
                message: d.message,
                severity:
                  d.severity === 1
                    ? monaco.MarkerSeverity.Error
                    : d.severity === 2
                      ? monaco.MarkerSeverity.Warning
                      : monaco.MarkerSeverity.Info,
                source: d.source,
              })),
            );
        }
        if (
          m.method === "window/logMessage" ||
          m.method === "window/showMessage"
        )
          log(m.params.message);
      },
      log,
    );
  }
  async start(config: ToolConfig, rootUri: string, docs: Document[]) {
    await this.connection.start(config);
    const result = await this.connection.request("initialize", {
      processId: null,
      rootUri,
      capabilities: {
        textDocument: {
          synchronization: { didSave: true },
          publishDiagnostics: {},
          hover: { contentFormat: ["plaintext"] },
          completion: { completionItem: { snippetSupport: false } },
        },
        workspace: { configuration: true },
      },
      workspaceFolders: [{ uri: rootUri, name: "SinaIDE project" }],
    });
    await this.connection.notify("initialized", {});
    this.log("Language server connected.");
    const request = (
      model: monaco.editor.ITextModel,
      position: monaco.Position,
    ) => ({
      textDocument: { uri: model.uri.toString() },
      position: {
        line: position.lineNumber - 1,
        character: position.column - 1,
      },
    });
    for (const lang of this.languages) {
      if (result?.capabilities?.hoverProvider)
        this.disposables.push(
          monaco.languages.registerHoverProvider(lang, {
            provideHover: async (m, p) => {
              try {
                await this.flush(m.uri.toString());
                const r = await this.connection.request(
                  "textDocument/hover",
                  request(m, p),
                );
                if (!r?.contents) return null;
                const parts = Array.isArray(r.contents)
                  ? r.contents
                  : [r.contents];
                return {
                  contents: parts.map((x: any) => ({
                    value: typeof x === "string" ? x : x.value,
                    isTrusted: false,
                    supportHtml: false,
                  })),
                };
              } catch {
                return null;
              }
            },
          }),
        );
      if (result?.capabilities?.completionProvider)
        this.disposables.push(
          monaco.languages.registerCompletionItemProvider(lang, {
            triggerCharacters:
              result.capabilities.completionProvider.triggerCharacters,
            provideCompletionItems: async (m, p) => {
              try {
                await this.flush(m.uri.toString());
                const r = await this.connection.request(
                  "textDocument/completion",
                  request(m, p),
                );
                const word = m.getWordUntilPosition(p);
                return {
                  suggestions: (Array.isArray(r) ? r : (r?.items ?? []))
                    .slice(0, 200)
                    .map((c: any) => ({
                      label: c.label,
                      kind: monaco.languages.CompletionItemKind.Text,
                      insertText: c.insertText ?? c.label,
                      detail: c.detail,
                      range: new monaco.Range(
                        p.lineNumber,
                        word.startColumn,
                        p.lineNumber,
                        word.endColumn,
                      ),
                    })),
                };
              } catch {
                return { suggestions: [] };
              }
            },
          }),
        );
    }
    for (const doc of docs) await this.open(doc);
  }
  async open(doc: Document) {
    if (
      !this.languages.includes(language(doc.path)) ||
      this.versions.has(doc.uri)
    )
      return;
    this.versions.set(doc.uri, 1);
    await this.connection.notify("textDocument/didOpen", {
      textDocument: {
        uri: doc.uri,
        languageId: language(doc.path),
        version: 1,
        text: doc.contents,
      },
    });
  }
  change(uri: string) {
    if (!this.versions.has(uri)) return;
    clearTimeout(this.timers.get(uri));
    this.timers.set(
      uri,
      setTimeout(
        () => void this.flush(uri).catch((e) => this.log(String(e))),
        250,
      ),
    );
  }
  async flush(uri: string) {
    clearTimeout(this.timers.get(uri));
    this.timers.delete(uri);
    const model = monaco.editor.getModel(monaco.Uri.parse(uri));
    if (!model || !this.versions.has(uri)) return;
    const version = this.versions.get(uri)! + 1;
    this.versions.set(uri, version);
    await this.connection.notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text: model.getValue() }],
    });
  }
  async saved(doc: Document) {
    if (this.versions.has(doc.uri)) {
      await this.flush(doc.uri);
      await this.connection.notify("textDocument/didSave", {
        textDocument: { uri: doc.uri },
      });
    }
  }
  async definition(editor: monaco.editor.IStandaloneCodeEditor) {
    const m = editor.getModel(),
      p = editor.getPosition();
    if (!m || !p) return;
    await this.flush(m.uri.toString());
    const r = await this.connection.request("textDocument/definition", {
      textDocument: { uri: m.uri.toString() },
      position: { line: p.lineNumber - 1, character: p.column - 1 },
    });
    const location = Array.isArray(r) ? r[0] : r;
    if (location)
      this.jump(
        location.uri ?? location.targetUri,
        (location.range ?? location.targetSelectionRange).start.line + 1,
      );
    else this.log("No definition returned.");
  }
  async closeDocument(uri: string) {
    clearTimeout(this.timers.get(uri));
    this.timers.delete(uri);
    if (this.versions.delete(uri))
      await this.connection.notify("textDocument/didClose", {
        textDocument: { uri },
      });
  }
  async close() {
    for (const d of this.disposables) d.dispose();
    for (const t of this.timers.values()) clearTimeout(t);
    for (const model of monaco.editor.getModels())
      monaco.editor.setModelMarkers(model, "sina-lsp", []);
    await this.connection.close();
  }
}
