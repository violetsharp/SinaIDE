import { useEffect, useRef, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { isDesktop, native } from "./native";
import { APP_VERSION } from "./version";

type Props = {
  beforeInstall: () => Promise<boolean>;
  afterInstall: () => void;
  onNotice: (message: string) => void;
};
export default function Updates({
  beforeInstall,
  afterInstall,
  onNotice,
}: Props) {
  const [automatic, setAutomatic] = useState(() => {
    try {
      return localStorage.getItem("sinaide.updates.auto") !== "false";
    } catch {
      return true;
    }
  });
  const [status, setStatus] = useState(
    "Updates arrive here like little letters.",
  );
  const [available, setAvailable] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const update = useRef<Update | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const automaticRef = useRef(automatic);
  automaticRef.current = automatic;
  async function download(u: Update) {
    let bytes = 0,
      total = 0;
    setStatus("Bringing the update home…");
    await u.download(
      (event) => {
        if (!alive.current) return;
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          bytes += event.data.chunkLength;
          setStatus(
            total
              ? `Downloading · ${Math.min(100, Math.round((bytes / total) * 100))}%`
              : `Downloading · ${Math.round(bytes / 1024)} KB`,
          );
        }
      },
      { timeout: 120000 },
    );
    if (alive.current) {
      setReady(true);
      setStatus("Signature verified. Ready when you are.");
      onNotice(
        `SinaIDE ${u.version} is ready. Open World to install your update.`,
      );
    }
  }
  async function perform(action: () => Promise<void>) {
    if (lock.current || !isDesktop()) return;
    lock.current = true;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      if (alive.current)
        setStatus(
          `Update unavailable: ${String(e)}. You can keep working and retry.`,
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function look() {
    await perform(async () => {
      setStatus("Checking the letterbox…");
      await update.current?.close();
      update.current = null;
      setReady(false);
      setAvailable("");
      const u = await check({ timeout: 15000 });
      if (!alive.current) {
        await u?.close();
        return;
      }
      update.current = u;
      if (!u) {
        setStatus("You’re all caught up. ✿");
        return;
      }
      setAvailable(u.version);
      setStatus(`SinaIDE ${u.version} is available.`);
      if (automaticRef.current) await download(u);
    });
  }
  useEffect(() => {
    alive.current = true;
    const startup = setTimeout(() => {
      if (automaticRef.current) void look();
    }, 8000);
    const periodic = setInterval(
      () => {
        if (automaticRef.current && !update.current) void look();
      },
      4 * 60 * 60 * 1000,
    );
    return () => {
      alive.current = false;
      clearTimeout(startup);
      clearInterval(periodic);
      void update.current?.close();
    };
  }, []);
  return (
    <section className="update-letter" aria-label="SinaIDE updates">
      <h3>✉ A little newer · {APP_VERSION}</h3>
      <label>
        <input
          type="checkbox"
          checked={automatic}
          onChange={(e) => {
            setAutomatic(e.target.checked);
            try {
              localStorage.setItem(
                "sinaide.updates.auto",
                String(e.target.checked),
              );
            } catch {
              setStatus(
                "Update preference could not be saved on this computer.",
              );
            }
          }}
        />{" "}
        Check & download updates automatically
      </label>
      <p role="status">
        {isDesktop()
          ? status
          : "Updates are available in the installed desktop app."}
      </p>
      <div className="tool-actions">
        <button
          disabled={busy || !isDesktop() || installed}
          onClick={() => void look()}
        >
          Check for updates
        </button>
        {available && !ready && (
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                if (update.current) await download(update.current);
              })
            }
          >
            Download {available}
          </button>
        )}
        {ready && !installed && (
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                if (!(await beforeInstall())) return;
                try {
                  await native("prepare_update");
                  await update.current!.install();
                  setInstalled(true);
                  setStatus("Installed. Restart to open your updated studio.");
                  await native("restart_app");
                } finally {
                  afterInstall();
                }
              })
            }
          >
            Install & restart
          </button>
        )}
        {installed && (
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                if (await beforeInstall()) {
                  try {
                    await native("restart_app");
                  } finally {
                    afterInstall();
                  }
                }
              })
            }
          >
            Restart now
          </button>
        )}
      </div>
      <small>
        Only published, signed releases arrive here. Installation asks first.
        These installers have no Windows publisher certificate or Apple
        notarization yet.
      </small>
    </section>
  );
}
