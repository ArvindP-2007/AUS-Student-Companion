export type Semester = {
  id: string;
  user_id: string;
  name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
};
export type Course = {
  id: string;
  user_id: string;
  semester_id: string;
  code: string;
  name: string;
  credits: number;
  instructor: string | null;
  section: string | null;
  location: string | null;
  color: string;
  final_grade: string | null;
  is_demo: boolean;
  created_at: string;
};
export type Meeting = {
  id: string;
  user_id: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
  is_demo: boolean;
};
export type GradeCategory = {
  id: string;
  user_id: string;
  course_id: string;
  name: string;
  weight: number;
  is_demo: boolean;
};
export type AcademicItem = {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  kind:
    | "assignment"
    | "quiz"
    | "midterm"
    | "final"
    | "practical"
    | "lab"
    | "project"
    | "participation"
    | "other";
  description: string | null;
  due_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  topics: string | null;
  status: "not_started" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  category_id: string | null;
  score: number | null;
  max_score: number | null;
  is_demo: boolean;
  created_at: string;
};
export type Note = {
  id: string;
  user_id: string;
  semester_id: string | null;
  course_id: string | null;
  title: string;
  content: string;
  pinned: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};
export type CalendarEvent = {
  id: string;
  user_id: string;
  semester_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  is_demo: boolean;
};
export type UserSettings = {
  user_id: string;
  theme: "light" | "dark" | "system";
  grade_scale: Record<string, number>;
  updated_at: string;
};
export type DataSet = {
  semesters: Semester[];
  courses: Course[];
  meetings: Meeting[];
  categories: GradeCategory[];
  items: AcademicItem[];
  notes: Note[];
  events: CalendarEvent[];
  settings: UserSettings | null;
};
export type Section =
  | "dashboard"
  | "semesters"
  | "courses"
  | "schedule"
  | "assignments"
  | "exams"
  | "grades"
  | "gpa"
  | "calendar"
  | "notes"
  | "analytics"
  | "search"
  | "settings";
