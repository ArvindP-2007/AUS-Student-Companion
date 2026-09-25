"use client";
import { useRef, useState } from "react";
import { Download, Upload, Database, Trash2 } from "lucide-react";
import { useApp } from "./companion";
import {
  makeBackup,
  summarizeBackup,
  validateBackup,
  type Backup,
} from "@/lib/backup";
import { makeDemoBackup } from "@/lib/demo";
import { supabase } from "@/lib/supabase";

export function BackupSettings() {
  const { data, refresh, notice } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exportedBeforeReplace, setExportedBeforeReplace] = useState(false);
  const counts = backup ? summarizeBackup(backup) : null;
  const changes = backup
    ? (() => {
        const existingIds = [
          ...data.semesters.map((r) => r.id),
          ...data.courses.map((r) => r.id),
          ...data.meetings.map((r) => r.id),
          ...data.categories.map((r) => r.id),
          ...data.items.map((r) => r.id),
          ...data.notes.map((r) => r.id),
          ...data.events.map((r) => r.id),
        ];
        const incoming = [
          ...backup.data.semesters.map((r) => r.id),
          ...backup.data.courses.map((r) => r.id),
          ...backup.data.meetings.map((r) => r.id),
          ...backup.data.categories.map((r) => r.id),
          ...backup.data.items.map((r) => r.id),
          ...backup.data.notes.map((r) => r.id),
          ...backup.data.events.map((r) => r.id),
        ];
        const existing = new Set(existingIds);
        const matched = incoming.filter((id) => existing.has(id)).length;
        return {
          added: incoming.length - matched,
          updated: matched,
          removed: existingIds.length - matched,
        };
      })()
    : null;
  const demoCount =
    data.semesters.filter((s) => s.is_demo).length +
    data.courses.filter((c) => c.is_demo).length +
    data.items.filter((i) => i.is_demo).length +
    data.notes.filter((n) => n.is_demo).length;
  function download() {
    try {
      const json = JSON.stringify(makeBackup(data), null, 2);
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `aus-companion-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportedBeforeReplace(true);
      notice("Backup downloaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }
  async function chooseFile(file?: File) {
    setError("");
    setBackup(null);
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError("Backup file is too large (20 MB maximum).");
      return;
    }
    try {
      setBackup(validateBackup(JSON.parse(await file.text())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid backup file");
    }
  }
  async function importData() {
    if (!backup) return;
    if (mode === "replace" && !exportedBeforeReplace) {
      setError(
        "Download a fresh backup of your current data before replacing it.",
      );
      return;
    }
    if (
      !window.confirm(
        mode === "replace"
          ? "Replace all existing academic data with this backup? This cannot be undone."
          : "Merge this backup into your current data? Matching record IDs will be updated.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const { error: importError } = await supabase().rpc("restore_backup", {
        backup,
        import_mode: mode,
      });
      if (importError) throw importError;
      await refresh();
      setBackup(null);
      notice("Backup imported successfully");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  async function loadDemo() {
    if (demoCount) {
      setError("Remove the existing demo data before loading another set.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const demo = makeDemoBackup();
      const { error: demoError } = await supabase().rpc("restore_backup", {
        backup: demo,
        import_mode: "merge",
      });
      if (demoError) throw demoError;
      await refresh();
      notice("Demo data loaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo load failed");
    } finally {
      setBusy(false);
    }
  }
  async function removeDemo() {
    if (
      !window.confirm(
        "Remove demo records? This cannot be undone. The app will prevent deletion if real records are linked to them.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await supabase().rpc("remove_demo_data");
      if (deleteError) throw deleteError;
      await refresh();
      notice("Demo data removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove demo data");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="backup-settings">
      <p className="muted">
        Your database is online. Download JSON backups regularly and store them
        somewhere safe.
      </p>
      <div className="backup-actions">
        <button className="secondary-button" onClick={download}>
          <Download size={17} /> Export data
        </button>
        <button
          className="secondary-button"
          onClick={() => input.current?.click()}
        >
          <Upload size={17} /> Choose backup
        </button>
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept=".json,application/json"
          onChange={(e) => void chooseFile(e.target.files?.[0])}
        />
      </div>
      {backup && counts && changes && (
        <div className="import-preview">
          <div className="eyebrow">IMPORT PREVIEW</div>
          <h3>Backup from {new Date(backup.exportedAt).toLocaleString()}</h3>
          <div className="import-counts">
            {Object.entries(counts).map(([name, count]) => (
              <span key={name}>
                <strong>{count}</strong> {name}
              </span>
            ))}
          </div>
          <div className="radio-options">
            <label>
              <input
                type="radio"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
              />{" "}
              Merge · add new IDs and update matching records
            </label>
            <label>
              <input
                type="radio"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />{" "}
              Replace · remove current data first
            </label>
          </div>
          <p className="field-hint">
            {mode === "merge"
              ? `${changes.added} new records and ${changes.updated} matching records will be updated. Existing records not in the backup stay.`
              : `${changes.removed} current records not in the backup will be removed. Download your current data above before replacing it.`}
          </p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void importData()}
          >
            {busy ? "Importing…" : `Confirm ${mode} import`}
          </button>
        </div>
      )}
      <div className="demo-controls">
        <div>
          <Database size={19} />
          <span>
            <strong>Optional demo data</strong>
            <small>
              Five sample courses, class times, assignments, quizzes, and a
              note.
            </small>
          </span>
        </div>
        {demoCount ? (
          <button
            className="danger-button"
            disabled={busy}
            onClick={() => void removeDemo()}
          >
            <Trash2 size={16} /> Remove demo data
          </button>
        ) : (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void loadDemo()}
          >
            Load demo data
          </button>
        )}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
