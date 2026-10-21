import { useEffect, useRef } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { native } from "./native";
import type { ProcessPoll } from "./types";
export default function Terminal({
  id,
  onError,
}: {
  id: number;
  onError: (s: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const report = useRef(onError);
  report.current = onError;
  useEffect(() => {
    let alive = true,
      polling = false,
      finished = false;
    const terminal = new XTerminal({
      fontFamily: '"DM Mono", monospace',
      fontSize: 12,
      cursorBlink: false,
      scrollback: 3000,
      theme: {
        background: "#211b2c",
        foreground: "#eee8f6",
        cursor: "#f6a5cb",
        selectionBackground: "#60456e",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host.current!);
    const resize = () => {
      if (!alive) return;
      fit.fit();
      void native("resize_terminal", {
        id,
        cols: terminal.cols,
        rows: terminal.rows,
      }).catch((e) => {
        if (alive) report.current(String(e));
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current!);
    resize();
    const input = terminal.onData((data) => {
      void native("send_process", { id, data }).catch((e) => {
        if (alive) report.current(String(e));
      });
    });
    const poll = async () => {
      if (polling || finished) return;
      polling = true;
      try {
        const p = await native<ProcessPoll>("poll_process", { id });
        if (!alive) return;
        for (const chunk of p.chunks) terminal.write(chunk);
        for (const chunk of p.errors) terminal.write(chunk);
        if (p.dropped) terminal.writeln("\r\n[Older output was trimmed.]");
        if (p.finished) {
          finished = true;
          terminal.writeln(`\r\n[Session ended: ${p.exitCode}]`);
        }
      } catch (e) {
        finished = true;
        if (alive) report.current(String(e));
      } finally {
        polling = false;
      }
    };
    const timer = setInterval(() => void poll(), 70);
    void poll();
    return () => {
      alive = false;
      clearInterval(timer);
      observer.disconnect();
      input.dispose();
      terminal.dispose();
    };
  }, [id]);
  return <div className="terminal-host" ref={host} />;
}
