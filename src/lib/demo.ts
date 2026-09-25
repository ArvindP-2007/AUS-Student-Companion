import type { Backup } from "./backup";

export function makeDemoBackup(): Backup {
  const id = () => crypto.randomUUID();
  const semester = id();
  const courseNames = [
    ["MTH 221", "Linear Algebra", "#477a77"],
    ["NGN 211", "Probability and Statistics", "#6677a5"],
    ["CMP 220", "Programming II", "#b07357"],
    ["COE 221", "Digital Systems", "#9a6a84"],
    ["MTH 212", "Discrete Mathematics", "#8d8060"],
  ];
  const courses = courseNames.map(([code, name, color]) => ({
    id: id(),
    semester_id: semester,
    code,
    name,
    credits: 3,
    instructor: null,
    section: "01",
    location: null,
    color,
    final_grade: null,
    is_demo: true,
  }));
  const meetings = courses.flatMap((course, index) =>
    [1, 3].map((day) => ({
      id: id(),
      course_id: course.id,
      day_of_week: day,
      start_time: `${String(9 + index).padStart(2, "0")}:00`,
      end_time: `${String(9 + index).padStart(2, "0")}:50`,
      location: `EB ${201 + index}`,
      is_demo: true,
    })),
  );
  const categories = courses.flatMap((course) =>
    ["Assignments", "Quizzes", "Midterm", "Final"].map((name, index) => ({
      id: id(),
      course_id: course.id,
      name,
      weight: [20, 20, 25, 35][index],
      is_demo: true,
    })),
  );
  const future = (days: number, hour = 16) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hour - 4, 0, 0, 0);
    return d.toISOString();
  };
  const items = courses.flatMap((course, index) => [
    {
      id: id(),
      course_id: course.id,
      title: `${course.name} problem set`,
      kind: "assignment" as const,
      description:
        "Review the latest lecture material and submit your solutions.",
      due_at: future(3 + index * 2),
      starts_at: null,
      ends_at: null,
      location: null,
      topics: null,
      status: "in_progress" as const,
      priority: "medium" as const,
      category_id: categories.find(
        (c) => c.course_id === course.id && c.name === "Assignments",
      )!.id,
      score: null,
      max_score: 20,
      is_demo: true,
    },
    {
      id: id(),
      course_id: course.id,
      title: `${course.name} quiz`,
      kind: "quiz" as const,
      description: null,
      due_at: null,
      starts_at: future(8 + index * 2, 10),
      ends_at: future(8 + index * 2, 11),
      location: `EB ${201 + index}`,
      topics: "Weeks 1–4",
      status: "not_started" as const,
      priority: "high" as const,
      category_id: categories.find(
        (c) => c.course_id === course.id && c.name === "Quizzes",
      )!.id,
      score: null,
      max_score: 20,
      is_demo: true,
    },
  ]);
  const notes = [
    {
      id: id(),
      semester_id: semester,
      course_id: courses[0].id,
      title: "Linear algebra study plan",
      content:
        "Review vector spaces, matrix transformations, and eigenvalues before the next quiz.",
      pinned: true,
      is_demo: true,
    },
  ];
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    activeSemesterId: semester,
    data: {
      semesters: [
        {
          id: semester,
          name: "Fall 2026",
          academic_year: "2026–2027",
          start_date: "2026-08-24",
          end_date: "2026-12-18",
          is_active: false,
          is_demo: true,
        },
      ],
      courses,
      meetings,
      categories,
      items,
      notes,
      events: [],
      settings: null,
    },
  };
}
