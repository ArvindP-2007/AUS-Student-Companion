import { z } from "zod";
import type { DataSet } from "./types";

const id = z.uuid();
const text = z.string().trim().min(1);
const optional = z.string().nullable().optional();
const date = z.iso.date();
const dateTime = z.iso.datetime({ offset: true });
const common = {
  id,
  is_demo: z.boolean().optional(),
  created_at: dateTime.optional(),
};
const semester = z
  .object({
    ...common,
    name: text,
    academic_year: text,
    start_date: date,
    end_date: date,
    is_active: z.boolean().optional(),
  })
  .refine(
    (v) => v.end_date >= v.start_date,
    "Semester end date is before start date",
  );
const course = z.object({
  ...common,
  semester_id: id,
  code: text,
  name: text,
  credits: z.number().min(0).max(30),
  instructor: optional,
  section: optional,
  location: optional,
  color: z.string().optional(),
  final_grade: optional,
});
const meeting = z
  .object({
    id,
    course_id: id,
    day_of_week: z.number().int().min(0).max(6),
    start_time: text,
    end_time: text,
    location: optional,
    is_demo: z.boolean().optional(),
  })
  .refine(
    (v) => v.end_time > v.start_time,
    "Class end time is before start time",
  );
const category = z.object({
  id,
  course_id: id,
  name: text,
  weight: z.number().min(0).max(100),
  is_demo: z.boolean().optional(),
});
const item = z
  .object({
    ...common,
    course_id: id,
    title: text,
    kind: z.enum([
      "assignment",
      "quiz",
      "midterm",
      "final",
      "practical",
      "lab",
      "project",
      "participation",
      "other",
    ]),
    description: optional,
    due_at: dateTime.nullable().optional(),
    starts_at: dateTime.nullable().optional(),
    ends_at: dateTime.nullable().optional(),
    location: optional,
    topics: optional,
    status: z.enum(["not_started", "in_progress", "completed"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    category_id: id.nullable().optional(),
    score: z.number().min(0).nullable().optional(),
    max_score: z.number().positive().nullable().optional(),
    is_demo: z.boolean().optional(),
  })
  .refine(
    (v) => v.score == null || (v.max_score != null && v.score <= v.max_score),
    "Invalid score",
  );
const note = z.object({
  ...common,
  semester_id: id.nullable().optional(),
  course_id: id.nullable().optional(),
  title: text,
  content: z.string(),
  pinned: z.boolean().optional(),
  updated_at: dateTime.optional(),
});
const event = z
  .object({
    id,
    semester_id: id.nullable().optional(),
    title: text,
    description: optional,
    starts_at: dateTime,
    ends_at: dateTime.nullable().optional(),
    location: optional,
    is_demo: z.boolean().optional(),
  })
  .refine(
    (v) => !v.ends_at || v.ends_at > v.starts_at,
    "Event end time is before start time",
  );
const settings = z
  .object({
    theme: z.enum(["light", "dark", "system"]),
    grade_scale: z.record(z.string(), z.number().min(0).max(4)),
  })
  .nullable();
export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: dateTime,
  activeSemesterId: id.nullable(),
  data: z.object({
    semesters: z.array(semester),
    courses: z.array(course),
    meetings: z.array(meeting),
    categories: z.array(category),
    items: z.array(item),
    notes: z.array(note),
    events: z.array(event),
    settings,
  }),
});
export type Backup = z.infer<typeof backupSchema>;

export function validateBackup(input: unknown): Backup {
  const backup = backupSchema.parse(input);
  const all = [
    backup.data.semesters,
    backup.data.courses,
    backup.data.meetings,
    backup.data.categories,
    backup.data.items,
    backup.data.notes,
    backup.data.events,
  ];
  const ids = all.flatMap((rows) => rows.map((row) => row.id));
  if (new Set(ids).size !== ids.length)
    throw new Error("Backup contains duplicate record IDs.");
  const semesters = new Set(backup.data.semesters.map((s) => s.id));
  const courses = new Set(backup.data.courses.map((c) => c.id));
  const categories = new Map(
    backup.data.categories.map((c) => [c.id, c.course_id]),
  );
  if (backup.data.courses.some((c) => !semesters.has(c.semester_id)))
    throw new Error("A course refers to a missing semester.");
  if (
    backup.data.meetings.some((m) => !courses.has(m.course_id)) ||
    backup.data.categories.some((c) => !courses.has(c.course_id)) ||
    backup.data.items.some((i) => !courses.has(i.course_id))
  )
    throw new Error("A record refers to a missing course.");
  if (
    backup.data.items.some(
      (i) => i.category_id && categories.get(i.category_id) !== i.course_id,
    )
  )
    throw new Error(
      "An assessment refers to a category in another course or a missing category.",
    );
  if (
    backup.data.notes.some(
      (n) =>
        (n.course_id && !courses.has(n.course_id)) ||
        (n.semester_id && !semesters.has(n.semester_id)),
    ) ||
    backup.data.events.some(
      (e) => e.semester_id && !semesters.has(e.semester_id),
    )
  )
    throw new Error("A note or event has a missing parent.");
  if (
    backup.data.notes.some(
      (n) =>
        n.course_id &&
        n.semester_id &&
        backup.data.courses.find((c) => c.id === n.course_id)?.semester_id !==
          n.semester_id,
    )
  )
    throw new Error("A note is linked to a course in another semester.");
  if (backup.activeSemesterId && !semesters.has(backup.activeSemesterId))
    throw new Error("Active semester is missing from the backup.");
  for (const course of backup.data.courses)
    if (
      course.final_grade &&
      ![
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
      ].includes(course.final_grade)
    )
      throw new Error(`Invalid final grade in ${course.code}.`);
  for (const course of courses) {
    const total = backup.data.categories
      .filter((c) => c.course_id === course)
      .reduce((sum, c) => sum + c.weight, 0);
    if (total > 100.001)
      throw new Error("A course has category weights over 100%.");
  }
  return backup;
}
export function makeBackup(data: DataSet): Backup {
  return validateBackup({
    version: 1,
    exportedAt: new Date().toISOString(),
    activeSemesterId: data.semesters.find((s) => s.is_active)?.id ?? null,
    data,
  });
}
export function summarizeBackup(backup: Backup) {
  const d = backup.data;
  return {
    semesters: d.semesters.length,
    courses: d.courses.length,
    meetings: d.meetings.length,
    categories: d.categories.length,
    items: d.items.length,
    notes: d.notes.length,
    events: d.events.length,
  };
}
