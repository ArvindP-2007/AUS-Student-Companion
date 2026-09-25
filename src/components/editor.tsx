"use client";
import { useEffect, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { useApp } from "./companion";
import type { Table } from "@/lib/data";
import type { AcademicItem } from "@/lib/types";

export type EditorTarget = {
  table: Table;
  record?: Record<string, unknown>;
  kind?: AcademicItem["kind"];
};
const labels: Record<Table, string> = {
  semesters: "semester",
  courses: "course",
  meetings: "class meeting",
  categories: "grade category",
  items: "academic item",
  notes: "note",
  events: "calendar event",
};
const colors = [
  "#477a77",
  "#6677a5",
  "#b07357",
  "#9a6a84",
  "#8d8060",
  "#5d879a",
];
const itemKinds = [
  "assignment",
  "quiz",
  "midterm",
  "final",
  "practical",
  "lab",
  "project",
  "participation",
  "other",
];
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const asText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);
const localInput = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Dubai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(new Date(String(value)))
        .replace(" ", "T")
    : "";
const toUtc = (value: string) =>
  value ? new Date(`${value}:00+04:00`).toISOString() : null;

export function Editor({
  target,
  onClose,
}: {
  target: EditorTarget;
  onClose: () => void;
}) {
  const { data, semester, save, del } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState<Record<string, string>>(() => ({
    ...(target.table === "items"
      ? {
          kind: target.kind ?? "assignment",
          status: "not_started",
          priority: "medium",
        }
      : {}),
    ...(target.table === "courses" && semester
      ? { semester_id: semester.id }
      : {}),
    ...Object.fromEntries(
      Object.entries(target.record ?? {}).map(([key, val]) => [
        key,
        ["due_at", "starts_at", "ends_at"].includes(key)
          ? localInput(val)
          : asText(val),
      ]),
    ),
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    return () => node.close();
  }, []);
  const set = (key: string, val: string) =>
    setValue((previous) => ({ ...previous, [key]: val }));
  const input = (
    name: string,
    label: string,
    type = "text",
    required = false,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
        required={required}
        {...extra}
      />
    </label>
  );
  const select = (
    name: string,
    label: string,
    options: { value: string; label: string }[],
    required = false,
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        name={name}
        value={value[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
        required={required}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
  const courseOptions = data.courses
    .filter((c) => c.semester_id === semester?.id || c.id === value.course_id)
    .map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }));
  const semesterOptions = data.semesters.map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const categoryOptions = data.categories
    .filter((c) => c.course_id === value.course_id)
    .map((c) => ({ value: c.id, label: `${c.name} · ${c.weight}%` }));
  const isAssignment =
    (value.kind || target.kind || "assignment") === "assignment";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const v = { ...value };
    const trimmed = (key: string) => (v[key] ?? "").trim();
    let payload: Record<string, unknown> = target.record?.id
      ? { id: target.record.id }
      : {};
    try {
      if (target.table === "semesters") {
        if (!trimmed("name") || !trimmed("academic_year"))
          throw new Error("Name and academic year are required.");
        if (!v.start_date || !v.end_date || v.end_date < v.start_date)
          throw new Error("Enter valid semester dates in order.");
        payload = {
          ...payload,
          name: trimmed("name"),
          academic_year: trimmed("academic_year"),
          start_date: v.start_date,
          end_date: v.end_date,
          is_active: target.record?.is_active ?? data.semesters.length === 0,
        };
      } else if (target.table === "courses") {
        const credits = Number(v.credits);
        if (!trimmed("code") || !trimmed("name") || !v.semester_id)
          throw new Error("Code, name, and semester are required.");
        if (!Number.isFinite(credits) || credits < 0 || credits > 30)
          throw new Error("Credits must be between 0 and 30.");
        payload = {
          ...payload,
          semester_id: v.semester_id,
          code: trimmed("code").toUpperCase(),
          name: trimmed("name"),
          credits,
          instructor: trimmed("instructor") || null,
          section: trimmed("section") || null,
          location: trimmed("location") || null,
          color: v.color || colors[0],
          final_grade: v.final_grade || null,
        };
      } else if (target.table === "meetings") {
        if (
          !v.course_id ||
          !v.day_of_week ||
          !v.start_time ||
          !v.end_time ||
          v.end_time <= v.start_time
        )
          throw new Error("Select a course, day, and valid time range.");
        payload = {
          ...payload,
          course_id: v.course_id,
          day_of_week: Number(v.day_of_week),
          start_time: v.start_time,
          end_time: v.end_time,
          location: trimmed("location") || null,
        };
      } else if (target.table === "categories") {
        const weight = Number(v.weight);
        if (
          !v.course_id ||
          !trimmed("name") ||
          !Number.isFinite(weight) ||
          weight < 0 ||
          weight > 100
        )
          throw new Error(
            "Enter a course, category name, and weight from 0 to 100.",
          );
        const otherWeight = data.categories
          .filter(
            (c) => c.course_id === v.course_id && c.id !== target.record?.id,
          )
          .reduce((sum, c) => sum + c.weight, 0);
        if (otherWeight + weight > 100.001)
          throw new Error(
            `Category weights cannot exceed 100%. Remaining: ${(100 - otherWeight).toFixed(1)}%.`,
          );
        payload = {
          ...payload,
          course_id: v.course_id,
          name: trimmed("name"),
          weight,
        };
      } else if (target.table === "items") {
        if (!v.course_id || !trimmed("title"))
          throw new Error("Course and title are required.");
        const kind = v.kind || target.kind || "assignment";
        const score =
          v.score === "" || v.score === undefined ? null : Number(v.score);
        const max =
          v.max_score === "" || v.max_score === undefined
            ? null
            : Number(v.max_score);
        if (max !== null && (!Number.isFinite(max) || max <= 0))
          throw new Error("Maximum score must be greater than zero.");
        if (
          score !== null &&
          (!Number.isFinite(score) || score < 0 || max === null || score > max)
        )
          throw new Error("Score must be between zero and the maximum score.");
        if (v.ends_at && (!v.starts_at || v.ends_at <= v.starts_at))
          throw new Error("End time must come after start time.");
        if (
          v.category_id &&
          !data.categories.some(
            (c) => c.id === v.category_id && c.course_id === v.course_id,
          )
        )
          throw new Error("The grade category must belong to this course.");
        payload = {
          ...payload,
          course_id: v.course_id,
          title: trimmed("title"),
          kind,
          description: trimmed("description") || null,
          due_at: toUtc(v.due_at),
          starts_at: toUtc(v.starts_at),
          ends_at: toUtc(v.ends_at),
          location: trimmed("location") || null,
          topics: trimmed("topics") || null,
          status: v.status || "not_started",
          priority: v.priority || "medium",
          category_id: v.category_id || null,
          score,
          max_score: max,
        };
      } else if (target.table === "notes") {
        if (!trimmed("title")) throw new Error("Note title is required.");
        if (
          v.course_id &&
          v.semester_id &&
          data.courses.find((c) => c.id === v.course_id)?.semester_id !==
            v.semester_id
        )
          throw new Error("The selected course belongs to another semester.");
        payload = {
          ...payload,
          title: trimmed("title"),
          content: v.content ?? "",
          semester_id: v.semester_id || null,
          course_id: v.course_id || null,
          pinned: v.pinned === "true",
          updated_at: new Date().toISOString(),
        };
      } else if (target.table === "events") {
        if (!trimmed("title") || !v.starts_at)
          throw new Error("Event title and start are required.");
        if (v.ends_at && v.ends_at <= v.starts_at)
          throw new Error("End time must come after start time.");
        payload = {
          ...payload,
          title: trimmed("title"),
          description: trimmed("description") || null,
          starts_at: toUtc(v.starts_at),
          ends_at: toUtc(v.ends_at),
          location: trimmed("location") || null,
          semester_id: v.semester_id || null,
        };
      }
      setBusy(true);
      await save(target.table, payload);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  async function deleteRecord() {
    if (!target.record?.id) return;
    const label = labels[target.table];
    if (
      !window.confirm(
        `Delete this ${label}? Related records may also be deleted. This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await del(target.table, String(target.record.id));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="editor-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-head">
        <div>
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h2>
            {target.record?.id ? "Edit" : "Add"} {labels[target.table]}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close editor"
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="dialog-fields">
          {target.table === "semesters" && (
            <>
              {input("name", "Semester name", "text", true, {
                placeholder: "Fall 2026",
              })}
              {input("academic_year", "Academic year", "text", true, {
                placeholder: "2026–2027",
              })}
              <div className="form-grid">
                {input("start_date", "Start date", "date", true)}
                {input("end_date", "End date", "date", true)}
              </div>
            </>
          )}
          {target.table === "courses" && (
            <>
              {select("semester_id", "Semester", semesterOptions, true)}
              <div className="form-grid">
                {input("code", "Course code", "text", true, {
                  placeholder: "CMP 220",
                })}
                {input("credits", "Credit hours", "number", true, {
                  min: 0,
                  max: 30,
                  step: 0.5,
                })}
              </div>
              {input("name", "Course name", "text", true)}
              <div className="form-grid">
                {input("instructor", "Instructor")}
                {input("section", "Section")}
              </div>
              {input("location", "Classroom / location")}
              {select(
                "final_grade",
                "Final letter grade",
                [
                  "A",
                  "A-",
                  "B+",
                  "B",
                  "B-",
                  "C+",
                  "C",
                  "C-",
                  "D",
                  "F",
                  "XF",
                  "WF",
                  "AUD",
                  "AW",
                  "I",
                  "IP",
                  "N",
                  "P",
                  "TR",
                  "W",
                  "WV",
                ].map((grade) => ({ value: grade, label: grade })),
              )}
              <p className="field-hint">
                Enter this only after receiving your official final course
                grade.
              </p>
              <label className="field">
                <span>Course color</span>
                <div className="color-options">
                  {colors.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={`color-swatch ${(value.color || colors[0]) === color ? "selected" : ""}`}
                      style={{ backgroundColor: color }}
                      onClick={() => set("color", color)}
                      aria-label={`Select ${color}`}
                    />
                  ))}
                </div>
              </label>
            </>
          )}
          {target.table === "meetings" && (
            <>
              {select("course_id", "Course", courseOptions, true)}
              {select(
                "day_of_week",
                "Day",
                days.map((day, index) => ({
                  value: String(index),
                  label: day,
                })),
                true,
              )}
              <div className="form-grid">
                {input("start_time", "Start time", "time", true)}
                {input("end_time", "End time", "time", true)}
              </div>
              {input("location", "Location")}
            </>
          )}
          {target.table === "categories" && (
            <>
              {select("course_id", "Course", courseOptions, true)}
              {input("name", "Category name", "text", true, {
                placeholder: "Quizzes",
              })}
              {input("weight", "Weight (%)", "number", true, {
                min: 0,
                max: 100,
                step: 0.01,
              })}
            </>
          )}
          {target.table === "items" && (
            <>
              {select("course_id", "Course", courseOptions, true)}
              <div className="form-grid">
                {input("title", "Title", "text", true)}
                {select(
                  "kind",
                  "Type",
                  itemKinds.map((kind) => ({
                    value: kind,
                    label: kind.charAt(0).toUpperCase() + kind.slice(1),
                  })),
                  true,
                )}
              </div>
              <label className="field">
                <span>Description / notes</span>
                <textarea
                  value={value.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                  rows={3}
                />
              </label>
              {isAssignment ? (
                input("due_at", "Due date and time", "datetime-local")
              ) : (
                <div className="form-grid">
                  {input("starts_at", "Start date and time", "datetime-local")}
                  {input("ends_at", "End date and time", "datetime-local")}
                </div>
              )}
              <div className="form-grid">
                {select("status", "Status", [
                  { value: "not_started", label: "Not started" },
                  { value: "in_progress", label: "In progress" },
                  { value: "completed", label: "Completed" },
                ])}
                {select("priority", "Priority", [
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ])}
              </div>
              {!isAssignment && (
                <>
                  {input("location", "Location")}
                  {input("topics", "Topics")}
                </>
              )}
              {select("category_id", "Grade category", categoryOptions)}
              <div className="form-grid">
                {input("score", "Score received", "number", false, {
                  min: 0,
                  step: 0.01,
                })}
                {input("max_score", "Maximum score", "number", false, {
                  min: 0.01,
                  step: 0.01,
                })}
              </div>
              <p className="field-hint">
                Leave score blank until graded. Ungraded work never counts as
                zero.
              </p>
            </>
          )}
          {target.table === "notes" && (
            <>
              {input("title", "Title", "text", true)}
              <label className="field">
                <span>Content</span>
                <textarea
                  value={value.content ?? ""}
                  onChange={(e) => set("content", e.target.value)}
                  rows={10}
                  placeholder="Start writing…"
                />
              </label>
              <div className="form-grid">
                {select("semester_id", "Semester (optional)", semesterOptions)}
                {select("course_id", "Course (optional)", courseOptions)}
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={value.pinned === "true"}
                  onChange={(e) => set("pinned", String(e.target.checked))}
                />{" "}
                Pin this note
              </label>
            </>
          )}
          {target.table === "events" && (
            <>
              {input("title", "Event title", "text", true)}
              <div className="form-grid">
                {input("starts_at", "Starts", "datetime-local", true)}
                {input("ends_at", "Ends", "datetime-local")}
              </div>
              {input("location", "Location")}
              {select("semester_id", "Semester (optional)", semesterOptions)}
              <label className="field">
                <span>Description</span>
                <textarea
                  value={value.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                  rows={3}
                />
              </label>
            </>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="dialog-actions">
          {Boolean(target.record?.id) && (
            <button
              type="button"
              className="danger-button"
              onClick={() => void deleteRecord()}
              disabled={busy}
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
