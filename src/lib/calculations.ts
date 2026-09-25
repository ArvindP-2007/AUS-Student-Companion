import type { AcademicItem, Course, GradeCategory, Semester } from "./types";

export const AUS_SCALE: Record<string, number> = {
  A: 4,
  "A-": 3.7,
  "B+": 3.3,
  B: 3,
  "B-": 2.7,
  "C+": 2.3,
  C: 2,
  "C-": 1.7,
  D: 1,
  F: 0,
  XF: 0,
  WF: 0,
};
export const NON_GPA_GRADES = [
  "AUD",
  "AW",
  "I",
  "IP",
  "N",
  "P",
  "TR",
  "W",
  "WV",
];

export function calculateGpa(
  courses: Pick<Course, "credits" | "final_grade">[],
  scale = AUS_SCALE,
) {
  const counted = courses.filter(
    (c) => c.final_grade && scale[c.final_grade] !== undefined && c.credits > 0,
  );
  const credits = counted.reduce((sum, c) => sum + c.credits, 0);
  const qualityPoints = counted.reduce(
    (sum, c) => sum + c.credits * scale[c.final_grade!],
    0,
  );
  return {
    credits,
    qualityPoints,
    gpa: credits ? qualityPoints / credits : null,
    courseCount: counted.length,
  };
}

export function calculateWeightedGrade(
  categories: Pick<GradeCategory, "id" | "name" | "weight">[],
  items: Pick<AcademicItem, "category_id" | "score" | "max_score">[],
) {
  const configuredWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  let countedWeight = 0;
  let weightedTotal = 0;
  const breakdown = categories.map((category) => {
    const graded = items.filter(
      (i) =>
        i.category_id === category.id &&
        i.score !== null &&
        i.max_score !== null &&
        i.max_score > 0,
    );
    const earned = graded.reduce((sum, i) => sum + i.score!, 0);
    const possible = graded.reduce((sum, i) => sum + i.max_score!, 0);
    const percent = possible ? (earned / possible) * 100 : null;
    if (percent !== null) {
      countedWeight += category.weight;
      weightedTotal += percent * category.weight;
    }
    return {
      name: category.name,
      weight: category.weight,
      earned,
      possible,
      percent,
      gradedCount: graded.length,
    };
  });
  const ungradedCount = items.filter(
    (i) => i.score === null && i.category_id !== null,
  ).length;
  const uncategorizedCount = items.filter((i) => i.category_id === null).length;
  return {
    percent: countedWeight ? weightedTotal / countedWeight : null,
    configuredWeight,
    countedWeight,
    ungradedCount,
    uncategorizedCount,
    breakdown,
    provisional:
      configuredWeight !== 100 ||
      countedWeight !== 100 ||
      ungradedCount > 0 ||
      uncategorizedCount > 0,
  };
}

export function deadlineState(
  dueAt: string | null,
  status: AcademicItem["status"],
  now = new Date(),
) {
  if (status === "completed") return "completed";
  if (!dueAt) return "unscheduled";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "unscheduled";
  if (due.getTime() < now.getTime()) return "overdue";
  const dubaiDay = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dubai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  return dubaiDay(due) === dubaiDay(now) ? "due today" : "upcoming";
}

export function activeSemester(semesters: Semester[]) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    semesters.find((s) => s.is_active) ??
    semesters.find((s) => s.start_date <= today && s.end_date >= today) ??
    semesters[0]
  );
}
export function formatDate(
  date: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  return date
    ? new Intl.DateTimeFormat("en-AE", {
        timeZone: "Asia/Dubai",
        dateStyle: "medium",
        ...options,
      }).format(new Date(date))
    : "—";
}
export function formatTime(date: string | null) {
  return date
    ? new Intl.DateTimeFormat("en-AE", {
        timeZone: "Asia/Dubai",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(date))
    : "—";
}
export function dubaiNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" }),
  );
}
