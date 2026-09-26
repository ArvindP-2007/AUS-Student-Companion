"use client";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  FileText,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import {
  calculateGpa,
  calculateWeightedGrade,
  deadlineState,
  dubaiNow,
  formatDate,
  formatTime,
  AUS_SCALE,
  NON_GPA_GRADES,
} from "@/lib/calculations";
import type { AcademicItem, Course, Meeting, Note } from "@/lib/types";
import { useApp } from "./companion";
import { BackupSettings } from "./views_backup";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const schedulePixelsPerMinute = 1.2;
const minutesOfDay = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
function positionDayMeetings(meetings: Meeting[]) {
  const sorted = [...meetings].sort(
    (a, b) =>
      minutesOfDay(a.start_time) - minutesOfDay(b.start_time) ||
      minutesOfDay(a.end_time) - minutesOfDay(b.end_time),
  );
  const positioned: { meeting: Meeting; lane: number; laneCount: number }[] =
    [];
  let group: Meeting[] = [];
  let groupEnd = -1;

  const finishGroup = () => {
    const laneEnds: number[] = [];
    const placements = group.map((meeting) => {
      const start = minutesOfDay(meeting.start_time);
      const end = minutesOfDay(meeting.end_time);
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      return { meeting, lane };
    });
    positioned.push(
      ...placements.map((placement) => ({
        ...placement,
        laneCount: laneEnds.length,
      })),
    );
  };

  for (const meeting of sorted) {
    const start = minutesOfDay(meeting.start_time);
    if (group.length && start >= groupEnd) {
      finishGroup();
      group = [];
    }
    group.push(meeting);
    groupEnd = Math.max(groupEnd, minutesOfDay(meeting.end_time));
  }
  if (group.length) finishGroup();
  return positioned;
}
const kindLabel = (kind: string) =>
  kind.charAt(0).toUpperCase() + kind.slice(1);
const calendarDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const record = (value: object) => value as unknown as Record<string, unknown>;
function Heading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="primary-button" onClick={onClick}>
      <Plus size={17} />
      {label}
    </button>
  );
}
function Empty({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: typeof BookOpen;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function CourseTag({ course }: { course?: Course }) {
  return course ? (
    <span className="course-tag">
      <i style={{ backgroundColor: course.color }} />
      {course.code}
    </span>
  ) : (
    <span className="muted">No course</span>
  );
}
function fmtNumber(value: number | null, digits = 2) {
  return value === null ? "—" : value.toFixed(digits);
}

export function DashboardView() {
  const { data, semester, edit, setSection } = useApp();
  const courses = data.courses.filter((c) => c.semester_id === semester?.id);
  const ids = new Set(courses.map((c) => c.id));
  const today = dubaiNow().getDay();
  const todayKey = calendarDay(dubaiNow());
  const meetings = data.meetings
    .filter(
      (m) =>
        ids.has(m.course_id) &&
        m.day_of_week === today &&
        semester &&
        semester.start_date <= todayKey &&
        semester.end_date >= todayKey,
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const assignments = data.items
    .filter(
      (i) =>
        ids.has(i.course_id) &&
        i.kind === "assignment" &&
        i.status !== "completed" &&
        i.due_at,
    )
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!))
    .slice(0, 4);
  const exams = data.items
    .filter(
      (i) =>
        ids.has(i.course_id) &&
        i.kind !== "assignment" &&
        i.starts_at &&
        new Date(i.starts_at) >= new Date(),
    )
    .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))
    .slice(0, 3);
  const semesterGpa = calculateGpa(
    courses,
    data.settings?.grade_scale ?? AUS_SCALE,
  );
  const cumulative = calculateGpa(
    data.courses,
    data.settings?.grade_scale ?? AUS_SCALE,
  );
  const semesterAssignments = data.items.filter(
    (i) => ids.has(i.course_id) && i.kind === "assignment",
  );
  const done = semesterAssignments.filter(
    (i) => i.status === "completed",
  ).length;
  const notes = data.notes
    .filter((n) => !n.semester_id || n.semester_id === semester?.id)
    .slice(0, 3);
  return (
    <>
      <Heading
        eyebrow="YOUR ACADEMIC HOME"
        title={`Good ${dubaiNow().getHours() < 12 ? "morning" : dubaiNow().getHours() < 17 ? "afternoon" : "evening"}.`}
        subtitle={
          semester
            ? `Here's what's happening in ${semester.name}.`
            : "Start by creating your first semester."
        }
        action={
          <AddButton
            label="Add assignment"
            onClick={() => edit({ table: "items", kind: "assignment" })}
          />
        }
      />
      {!semester ? (
        <Empty
          icon={BookOpen}
          title="Your workspace is ready"
          detail="Create a semester, then add courses to begin tracking your university life."
          action={
            <AddButton
              label="Create semester"
              onClick={() => edit({ table: "semesters" })}
            />
          }
        />
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              label="Current GPA"
              value={fmtNumber(semesterGpa.gpa)}
              detail={`${semesterGpa.credits} graded credits`}
            />
            <Stat
              label="Cumulative GPA"
              value={fmtNumber(cumulative.gpa)}
              detail="Across all semesters"
            />
            <Stat
              label="Assignments done"
              value={`${done}/${semesterAssignments.length}`}
              detail={
                semesterAssignments.length
                  ? `${Math.round((done / semesterAssignments.length) * 100)}% completed`
                  : "Nothing assigned yet"
              }
            />
            <Stat
              label="Today's classes"
              value={String(meetings.length)}
              detail={
                meetings.length ? "On your schedule" : "A clear day ahead"
              }
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">TODAY</div>
                  <h2>Class schedule</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setSection("schedule")}
                >
                  Full schedule <ArrowRight size={15} />
                </button>
              </div>
              {meetings.length ? (
                meetings.map((m) => {
                  const c = data.courses.find((c) => c.id === m.course_id);
                  return (
                    <div className="meeting-row" key={m.id}>
                      <span className="meeting-time">
                        {m.start_time.slice(0, 5)}
                      </span>
                      <i
                        className="meeting-line"
                        style={{ backgroundColor: c?.color }}
                      />
                      <div>
                        <strong>{c?.name}</strong>
                        <small>
                          {c?.code} ·{" "}
                          {m.location || c?.location || "Location not set"}
                        </small>
                      </div>
                      <span className="muted meeting-end">
                        {m.end_time.slice(0, 5)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="inline-empty">
                  No classes today. Enjoy the breathing room.
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">COMING UP</div>
                  <h2>Assignments</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setSection("assignments")}
                >
                  View all <ArrowRight size={15} />
                </button>
              </div>
              {assignments.length ? (
                assignments.map((i) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    course={data.courses.find((c) => c.id === i.course_id)}
                    onClick={() => edit({ table: "items", record: record(i) })}
                  />
                ))
              ) : (
                <div className="inline-empty">You’re all caught up.</div>
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">AHEAD</div>
                  <h2>Exams & quizzes</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setSection("exams")}
                >
                  View all <ArrowRight size={15} />
                </button>
              </div>
              {exams.length ? (
                exams.map((i) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    course={data.courses.find((c) => c.id === i.course_id)}
                    onClick={() => edit({ table: "items", record: record(i) })}
                  />
                ))
              ) : (
                <div className="inline-empty">No exams scheduled.</div>
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">YOUR THOUGHTS</div>
                  <h2>Recent notes</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setSection("notes")}
                >
                  All notes <ArrowRight size={15} />
                </button>
              </div>
              {notes.length ? (
                notes.map((n) => (
                  <button
                    className="note-preview"
                    key={n.id}
                    onClick={() => edit({ table: "notes", record: record(n) })}
                  >
                    <FileText size={17} />
                    <span>
                      <strong>{n.title}</strong>
                      <small>
                        {n.content.slice(0, 70) || "No content yet"}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <div className="inline-empty">
                  No notes yet. Capture a thought to see it here.
                </div>
              )}
            </section>
          </div>
          <div className="quick-actions">
            <span>QUICK ACTIONS</span>
            <button onClick={() => edit({ table: "courses" })}>
              <Plus size={17} /> Course
            </button>
            <button onClick={() => edit({ table: "items", kind: "quiz" })}>
              <Plus size={17} /> Exam or quiz
            </button>
            <button onClick={() => edit({ table: "notes" })}>
              <Plus size={17} /> Note
            </button>
          </div>
        </>
      )}
    </>
  );
}
function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function ItemRow({
  item,
  course,
  onClick,
}: {
  item: AcademicItem;
  course?: Course;
  onClick: () => void;
}) {
  const date = item.kind === "assignment" ? item.due_at : item.starts_at;
  const state =
    item.kind === "assignment" ? deadlineState(date, item.status) : "";
  const daysAway =
    date && item.kind !== "assignment"
      ? Math.max(
          0,
          Math.ceil((new Date(date).getTime() - Date.now()) / 86400000),
        )
      : null;
  return (
    <button className="item-row" onClick={onClick}>
      <div className="item-dot" style={{ backgroundColor: course?.color }} />
      <span className="item-main">
        <strong>{item.title}</strong>
        <small>
          {course?.code ?? "Course"} · {kindLabel(item.kind)}
        </small>
      </span>
      <span className={`item-date ${state === "overdue" ? "danger-text" : ""}`}>
        {daysAway !== null
          ? daysAway === 0
            ? "Today"
            : `${daysAway} day${daysAway === 1 ? "" : "s"}`
          : date
            ? formatDate(date)
            : "No date"}
      </span>
    </button>
  );
}

export function SemesterView() {
  const { data, semester, edit, refresh, notice } = useApp();
  const [busy, setBusy] = useState(false);
  async function makeActive(id: string) {
    setBusy(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase().rpc("set_active_semester", {
        target_id: id,
      });
      if (error) throw error;
      await refresh();
      notice("Active semester updated");
    } catch (e) {
      notice(e instanceof Error ? e.message : "Could not switch semester");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="ACADEMIC YEARS"
        title="Semesters"
        subtitle="Keep each term organized, from the first class to the final grade."
        action={
          <AddButton
            label="New semester"
            onClick={() => edit({ table: "semesters" })}
          />
        }
      />
      {data.semesters.length ? (
        <div className="card-grid">
          {data.semesters.map((s) => {
            const count = data.courses.filter(
              (c) => c.semester_id === s.id,
            ).length;
            const gpa = calculateGpa(
              data.courses.filter((c) => c.semester_id === s.id),
              data.settings?.grade_scale ?? AUS_SCALE,
            );
            return (
              <div className="entity-card" key={s.id}>
                <div className="card-top">
                  <div className="card-icon">
                    <CalendarDays size={20} />
                  </div>
                  {s.is_active && <span className="badge green">Active</span>}
                </div>
                <h3>{s.name}</h3>
                <p>{s.academic_year}</p>
                <div className="card-meta">
                  <span>
                    {formatDate(s.start_date)} – {formatDate(s.end_date)}
                  </span>
                  <span>
                    {count} courses · GPA {fmtNumber(gpa.gpa)}
                  </span>
                </div>
                <div className="card-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      edit({ table: "semesters", record: record(s) })
                    }
                  >
                    Edit
                  </button>
                  {!s.is_active && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void makeActive(s.id)}
                    >
                      Set active
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={CalendarDays}
          title="No semesters yet"
          detail="Create your first semester to organize courses and deadlines."
          action={
            <AddButton
              label="Create semester"
              onClick={() => edit({ table: "semesters" })}
            />
          }
        />
      )}
    </>
  );
}

export function CourseView() {
  const { data, semester, edit } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const courses = data.courses.filter((c) => c.semester_id === semester?.id);
  const focused = courses.find((c) => c.id === selected);
  return (
    <>
      <Heading
        eyebrow="YOUR CLASSES"
        title={focused ? focused.name : "Courses"}
        subtitle={
          focused
            ? `${focused.code} · ${focused.credits} credit hours`
            : `Everything you're taking${semester ? ` in ${semester.name}` : ""}.`
        }
        action={
          focused ? (
            <button
              className="secondary-button"
              onClick={() => setSelected(null)}
            >
              Back to courses
            </button>
          ) : (
            <AddButton
              label="Add course"
              onClick={() => edit({ table: "courses" })}
            />
          )
        }
      />
      {focused ? (
        <CourseDetail course={focused} />
      ) : courses.length ? (
        <div className="card-grid">
          {courses.map((c) => {
            const count = data.items.filter(
              (i) =>
                i.course_id === c.id &&
                i.kind === "assignment" &&
                i.status !== "completed",
            ).length;
            return (
              <button
                className="entity-card course-card"
                key={c.id}
                onClick={() => setSelected(c.id)}
              >
                <div
                  className="course-color"
                  style={{ backgroundColor: c.color }}
                />
                <div className="eyebrow">{c.code}</div>
                <h3>{c.name}</h3>
                <p>{c.instructor || "Instructor not set"}</p>
                <div className="card-meta">
                  <span>{c.credits} credit hours</span>
                  <span>{count} open assignments</span>
                </div>
                <span className="course-card-arrow">
                  <ArrowRight size={18} />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={BookOpen}
          title="No courses yet"
          detail="Add courses to see your schedule, work, notes, and grades together."
          action={
            <AddButton
              label="Add course"
              onClick={() => edit({ table: "courses" })}
            />
          }
        />
      )}
    </>
  );
}
function CourseDetail({ course }: { course: Course }) {
  const { data, edit } = useApp();
  const meetings = data.meetings.filter((m) => m.course_id === course.id);
  const items = data.items.filter((i) => i.course_id === course.id);
  const notes = data.notes.filter((n) => n.course_id === course.id);
  const result = calculateWeightedGrade(
    data.categories.filter((c) => c.course_id === course.id),
    items,
  );
  return (
    <div className="detail-grid">
      <section className="panel">
        <div className="panel-head">
          <h2>Course details</h2>
          <button
            className="text-button"
            onClick={() => edit({ table: "courses", record: record(course) })}
          >
            Edit
          </button>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Instructor</dt>
            <dd>{course.instructor || "—"}</dd>
          </div>
          <div>
            <dt>Section</dt>
            <dd>{course.section || "—"}</dd>
          </div>
          <div>
            <dt>Classroom</dt>
            <dd>{course.location || "—"}</dd>
          </div>
          <div>
            <dt>Final grade</dt>
            <dd>{course.final_grade || "Not entered"}</dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Current grade</h2>
          <span className="badge">
            {result.provisional ? "Provisional" : "Complete"}
          </span>
        </div>
        <div className="big-metric">
          {result.percent === null ? "—" : `${result.percent.toFixed(1)}%`}
        </div>
        <p className="muted">
          {result.countedWeight}% of category weight currently counted.
        </p>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Class times</h2>
          <button
            className="text-button"
            onClick={() =>
              edit({ table: "meetings", record: { course_id: course.id } })
            }
          >
            Add
          </button>
        </div>
        {meetings.length ? (
          meetings.map((m) => (
            <button
              className="simple-row"
              key={m.id}
              onClick={() => edit({ table: "meetings", record: record(m) })}
            >
              {days[m.day_of_week]} · {m.start_time.slice(0, 5)}–
              {m.end_time.slice(0, 5)} <span>{m.location || ""}</span>
            </button>
          ))
        ) : (
          <p className="inline-empty">No class times added.</p>
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Assignments & assessments</h2>
          <button
            className="text-button"
            onClick={() =>
              edit({ table: "items", record: { course_id: course.id } })
            }
          >
            Add
          </button>
        </div>
        {items.length ? (
          items.map((i) => (
            <ItemRow
              key={i.id}
              item={i}
              course={course}
              onClick={() => edit({ table: "items", record: record(i) })}
            />
          ))
        ) : (
          <p className="inline-empty">Nothing added yet.</p>
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Notes</h2>
          <button
            className="text-button"
            onClick={() =>
              edit({
                table: "notes",
                record: {
                  course_id: course.id,
                  semester_id: course.semester_id,
                },
              })
            }
          >
            Add
          </button>
        </div>
        {notes.length ? (
          notes.map((n) => (
            <button
              key={n.id}
              className="simple-row"
              onClick={() => edit({ table: "notes", record: record(n) })}
            >
              {n.title}
            </button>
          ))
        ) : (
          <p className="inline-empty">No course notes yet.</p>
        )}
      </section>
    </div>
  );
}

export function ScheduleView() {
  const { data, semester, edit } = useApp();
  const ids = new Set(
    data.courses.filter((c) => c.semester_id === semester?.id).map((c) => c.id),
  );
  const meetings = data.meetings.filter((m) => ids.has(m.course_id));
  const firstHour = meetings.length
    ? Math.floor(
        Math.min(...meetings.map((m) => minutesOfDay(m.start_time))) / 60,
      )
    : 8;
  const lastHour = meetings.length
    ? Math.ceil(Math.max(...meetings.map((m) => minutesOfDay(m.end_time))) / 60)
    : 18;
  const startMinute = firstHour * 60;
  const trackHeight = (lastHour - firstHour) * 60 * schedulePixelsPerMinute;
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (_, index) => firstHour + index,
  );
  const coursesById = new Map(
    data.courses.map((course) => [course.id, course]),
  );
  return (
    <>
      <Heading
        eyebrow="WEEK AT A GLANCE"
        title="Class schedule"
        subtitle="Your recurring classes on a shared time scale. Blank space is free time."
        action={
          <AddButton
            label="Add class time"
            onClick={() => edit({ table: "meetings" })}
          />
        }
      />
      {meetings.length ? (
        <div className="schedule-scroll">
          <div className="schedule-grid">
            <div className="schedule-time-column" aria-label="Time of day">
              <h2>Time</h2>
              <div
                className="schedule-time-track"
                style={{ height: trackHeight }}
              >
                {hours.map((hour, index) => (
                  <span
                    className="schedule-time-label"
                    key={hour}
                    style={{ top: index * 60 * schedulePixelsPerMinute }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
            </div>
            {days.map((day, index) => (
              <section className="day-column" key={day} aria-label={day}>
                <h2>{day}</h2>
                <div className="day-timeline" style={{ height: trackHeight }}>
                  {positionDayMeetings(
                    meetings.filter((m) => m.day_of_week === index),
                  ).map(({ meeting, lane, laneCount }) => {
                    const course = coursesById.get(meeting.course_id);
                    const duration =
                      minutesOfDay(meeting.end_time) -
                      minutesOfDay(meeting.start_time);
                    const location = meeting.location || course?.location;
                    return (
                      <button
                        className={`meeting-card${duration < 45 ? " meeting-card-short" : ""}`}
                        style={{
                          borderLeftColor: course?.color,
                          top:
                            (minutesOfDay(meeting.start_time) - startMinute) *
                            schedulePixelsPerMinute,
                          height: duration * schedulePixelsPerMinute,
                          left: `calc(${(lane / laneCount) * 100}% + 3px)`,
                          width: `calc(${100 / laneCount}% - 6px)`,
                        }}
                        key={meeting.id}
                        title={`${course?.code || "Class"} · ${meeting.start_time.slice(0, 5)}–${meeting.end_time.slice(0, 5)}${location ? ` · ${location}` : ""}`}
                        onClick={() =>
                          edit({ table: "meetings", record: record(meeting) })
                        }
                      >
                        <strong>{course?.code || "Class"}</strong>
                        <span>
                          {meeting.start_time.slice(0, 5)}–
                          {meeting.end_time.slice(0, 5)}
                        </span>
                        {duration >= 45 && <small>{course?.name}</small>}
                        {duration >= 75 && location && (
                          <small>{location}</small>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <Empty
          icon={Clock3}
          title="Your week is open"
          detail="Add meeting times to build your class schedule."
          action={
            <AddButton
              label="Add class time"
              onClick={() => edit({ table: "meetings" })}
            />
          }
        />
      )}
    </>
  );
}

export function ItemsView({ kind }: { kind: "assignment" | "exam" }) {
  const { data, semester, edit } = useApp();
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [due, setDue] = useState("");
  const ids = new Set(
    data.courses.filter((c) => c.semester_id === semester?.id).map((c) => c.id),
  );
  const items = data.items
    .filter(
      (i) =>
        ids.has(i.course_id) &&
        (kind === "assignment"
          ? i.kind === "assignment"
          : i.kind !== "assignment"),
    )
    .filter((i) => !course || i.course_id === course)
    .filter((i) => !status || i.status === status)
    .filter((i) => !priority || i.priority === priority)
    .filter((i) => !due || (i.due_at ?? i.starts_at ?? "").slice(0, 10) === due)
    .sort((a, b) =>
      (a.due_at ?? a.starts_at ?? "9999").localeCompare(
        b.due_at ?? b.starts_at ?? "9999",
      ),
    );
  return (
    <>
      <Heading
        eyebrow={kind === "assignment" ? "KEEP MOVING" : "BE PREPARED"}
        title={kind === "assignment" ? "Assignments" : "Exams & quizzes"}
        subtitle={
          kind === "assignment"
            ? "Every deadline, one clear list."
            : "Know what's next and what you've completed."
        }
        action={
          <AddButton
            label={
              kind === "assignment" ? "New assignment" : "New exam or quiz"
            }
            onClick={() =>
              edit({
                table: "items",
                kind: kind === "assignment" ? "assignment" : "quiz",
              })
            }
          />
        }
      />
      <div className="filters">
        <select
          aria-label="Filter by course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">All courses</option>
          {data.courses
            .filter((c) => ids.has(c.id))
            .map((c) => (
              <option value={c.id} key={c.id}>
                {c.code}
              </option>
            ))}
        </select>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Any status</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
        <select
          aria-label="Filter by priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">Any priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          type="date"
          aria-label="Filter by date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </div>
      {items.length ? (
        <div className="panel list-panel">
          {items.map((i) => {
            const c = data.courses.find((c) => c.id === i.course_id);
            const date = i.kind === "assignment" ? i.due_at : i.starts_at;
            const state =
              i.kind === "assignment"
                ? deadlineState(date, i.status)
                : new Date(date ?? 0) < new Date()
                  ? "Past"
                  : "Upcoming";
            return (
              <button
                className="list-row"
                key={i.id}
                onClick={() => edit({ table: "items", record: record(i) })}
              >
                <span
                  className={`status-icon ${i.status === "completed" ? "done" : ""}`}
                >
                  {i.status === "completed" ? <Check size={17} /> : <span />}
                </span>
                <span className="list-main">
                  <strong>{i.title}</strong>
                  <small>
                    <CourseTag course={c} /> · {kindLabel(i.kind)} ·{" "}
                    {i.priority} priority
                  </small>
                </span>
                <span className="row-right">
                  <span
                    className={`badge ${state === "overdue" ? "red" : state === "due today" ? "amber" : ""}`}
                  >
                    {state}
                  </span>
                  <small>
                    {date
                      ? `${formatDate(date)}${i.kind !== "assignment" ? ` · ${formatTime(date)}` : ""}`
                      : "No date"}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={kind === "assignment" ? ClipboardListIcon : CalendarDays}
          title={
            kind === "assignment"
              ? "No assignments found"
              : "No exams scheduled"
          }
          detail="Try another filter or add your first item."
          action={
            <AddButton
              label="Add item"
              onClick={() =>
                edit({
                  table: "items",
                  kind: kind === "assignment" ? "assignment" : "quiz",
                })
              }
            />
          }
        />
      )}
    </>
  );
}
const ClipboardListIcon = BookOpen;

export function GradesView() {
  const { data, semester, edit } = useApp();
  const [courseId, setCourseId] = useState("");
  const courses = data.courses.filter((c) => c.semester_id === semester?.id);
  const course = courses.find((c) => c.id === courseId) ?? courses[0];
  const categories = data.categories.filter((c) => c.course_id === course?.id);
  const items = data.items.filter((i) => i.course_id === course?.id);
  const grade = calculateWeightedGrade(categories, items);
  return (
    <>
      <Heading
        eyebrow="KNOW WHERE YOU STAND"
        title="Grade tracker"
        subtitle="A transparent view of your graded work and category weights."
        action={
          course && (
            <AddButton
              label="Add category"
              onClick={() =>
                edit({ table: "categories", record: { course_id: course.id } })
              }
            />
          )
        }
      />
      {courses.length ? (
        <>
          <div className="segmented course-tabs">
            {courses.map((c) => (
              <button
                key={c.id}
                className={course?.id === c.id ? "selected" : ""}
                onClick={() => setCourseId(c.id)}
              >
                {c.code}
              </button>
            ))}
          </div>
          <div className="grade-overview">
            <div className="panel grade-hero">
              <div className="eyebrow">CURRENT WEIGHTED GRADE</div>
              <div className="grade-number">
                {grade.percent === null ? "—" : `${grade.percent.toFixed(1)}%`}
              </div>
              <p>
                {grade.percent === null
                  ? "Add categories and graded work to calculate a current grade."
                  : grade.provisional
                    ? "Provisional estimate based on graded work only."
                    : "All configured weight is currently represented."}
              </p>
              <div className="grade-meter">
                <span
                  style={{ width: `${Math.min(grade.countedWeight, 100)}%` }}
                />
              </div>
              <small>
                {grade.countedWeight}% counted · {grade.configuredWeight}%
                configured · {grade.ungradedCount} ungraded ·{" "}
                {grade.uncategorizedCount} uncategorized
              </small>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h2>Category breakdown</h2>
              </div>
              {grade.breakdown.length ? (
                grade.breakdown.map((b) => {
                  const c = categories.find((c) => c.name === b.name);
                  return (
                    <button
                      className="grade-category-row"
                      key={c?.id}
                      onClick={() =>
                        c && edit({ table: "categories", record: record(c) })
                      }
                    >
                      <span>
                        <strong>{b.name}</strong>
                        <small>
                          {b.weight}% of course · {b.gradedCount} graded
                        </small>
                      </span>
                      <strong>
                        {b.percent === null
                          ? "Not graded"
                          : `${b.percent.toFixed(1)}%`}
                      </strong>
                    </button>
                  );
                })
              ) : (
                <p className="inline-empty">No category weights yet.</p>
              )}
              {grade.configuredWeight < 100 && (
                <p className="field-hint">
                  {(100 - grade.configuredWeight).toFixed(1)}% of the syllabus
                  is not configured. The displayed grade is provisional.
                </p>
              )}
              {grade.uncategorizedCount > 0 && (
                <p className="field-hint">
                  {grade.uncategorizedCount} item(s) have no category and are
                  excluded from this calculation.
                </p>
              )}
            </div>
          </div>
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">SCORES</div>
                <h2>Assessment records</h2>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  edit({ table: "items", record: { course_id: course.id } })
                }
              >
                Add assessment
              </button>
            </div>
            {items.length ? (
              items.map((i) => (
                <button
                  className="simple-row"
                  key={i.id}
                  onClick={() => edit({ table: "items", record: record(i) })}
                >
                  <span>
                    <strong>{i.title}</strong>
                    <small>
                      {categories.find((c) => c.id === i.category_id)?.name ||
                        "Uncategorized"}
                    </small>
                  </span>
                  <strong>
                    {i.score === null
                      ? "Not graded"
                      : `${i.score}/${i.max_score}`}
                  </strong>
                </button>
              ))
            ) : (
              <p className="inline-empty">No assessments added yet.</p>
            )}
          </section>
        </>
      ) : (
        <Empty
          icon={TrendingUp}
          title="No courses to grade"
          detail="Add a course, then define its grading categories."
        />
      )}
    </>
  );
}

export function GpaView() {
  const { data, semester, edit } = useApp();
  const scale = data.settings?.grade_scale ?? AUS_SCALE;
  const courses = data.courses.filter((c) => c.semester_id === semester?.id);
  const semesterResult = calculateGpa(courses, scale);
  const overall = calculateGpa(data.courses, scale);
  return (
    <>
      <Heading
        eyebrow="AUS ACADEMIC RECORD"
        title="GPA calculator"
        subtitle="Based on final letter grades you enter for each course."
      />
      <div className="stats-grid two">
        <Stat
          label={`${semester?.name ?? "Current semester"} GPA`}
          value={fmtNumber(semesterResult.gpa)}
          detail={`${semesterResult.credits} attempted credits · ${semesterResult.qualityPoints.toFixed(2)} quality points`}
        />
        <Stat
          label="Cumulative GPA"
          value={fmtNumber(overall.gpa)}
          detail={`${overall.credits} attempted credits across ${data.semesters.length} semesters`}
        />
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Course quality points</h2>
          <span className="muted">Quality points = credits × grade points</span>
        </div>
        {courses.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Credits</th>
                  <th>Final grade</th>
                  <th>Grade points</th>
                  <th>Quality points</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.code}</strong>
                      <small>{c.name}</small>
                    </td>
                    <td>{c.credits}</td>
                    <td>{c.final_grade ?? "Pending"}</td>
                    <td>
                      {c.final_grade && scale[c.final_grade] !== undefined
                        ? scale[c.final_grade].toFixed(2)
                        : "—"}
                    </td>
                    <td>
                      {c.final_grade && scale[c.final_grade] !== undefined
                        ? (scale[c.final_grade] * c.credits).toFixed(2)
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() =>
                          edit({ table: "courses", record: record(c) })
                        }
                      >
                        Enter grade
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="inline-empty">Add courses to calculate GPA.</p>
        )}
      </div>
      <div className="info-note">
        AUS grades {NON_GPA_GRADES.join(", ")} do not contribute to GPA.
        Individual assessment scores do not automatically set a final course
        grade.
      </div>
    </>
  );
}

type CalendarEntry = {
  id: string;
  date: string;
  title: string;
  type: "class" | "assignment" | "assessment" | "event";
  course?: Course;
  item?: AcademicItem;
  note?: string;
  event?: Record<string, unknown>;
};
export function CalendarView() {
  const { data, semester, edit } = useApp();
  const [month, setMonth] = useState(() => {
    const now = dubaiNow();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [mode, setMode] = useState<"month" | "agenda">("month");
  const ids = new Set(
    data.courses.filter((c) => c.semester_id === semester?.id).map((c) => c.id),
  );
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const dates = Array.from(
    { length: first.getDay() + last.getDate() },
    (_, index) =>
      new Date(
        month.getFullYear(),
        month.getMonth(),
        index - first.getDay() + 1,
      ),
  );
  const entries = useMemo(() => {
    const list: CalendarEntry[] = [];
    for (const item of data.items.filter((i) => ids.has(i.course_id))) {
      const date = item.kind === "assignment" ? item.due_at : item.starts_at;
      if (date)
        list.push({
          id: item.id,
          date: new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Dubai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(date)),
          title: item.title,
          type: item.kind === "assignment" ? "assignment" : "assessment",
          course: data.courses.find((c) => c.id === item.course_id),
          item,
        });
    }
    for (const event of data.events.filter(
      (e) => !e.semester_id || e.semester_id === semester?.id,
    ))
      list.push({
        id: event.id,
        date: new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Dubai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(event.starts_at)),
        title: event.title,
        type: "event",
        event: record(event),
      });
    for (const date of dates.filter(
      (d) =>
        d.getMonth() === month.getMonth() &&
        semester &&
        calendarDay(d) >= semester.start_date &&
        calendarDay(d) <= semester.end_date,
    ))
      for (const meeting of data.meetings.filter(
        (m) => ids.has(m.course_id) && m.day_of_week === date.getDay(),
      )) {
        const c = data.courses.find((c) => c.id === meeting.course_id);
        list.push({
          id: `${meeting.id}-${calendarDay(date)}`,
          date: calendarDay(date),
          title: c?.code ?? "Class",
          type: "class",
          course: c,
          note: `${meeting.start_time.slice(0, 5)} · ${meeting.location || c?.location || ""}`,
        });
      }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [data, semester?.id, month.getMonth(), month.getFullYear()]);
  const open = (entry: CalendarEntry) => {
    if (entry.item) edit({ table: "items", record: record(entry.item) });
    else if (entry.event) edit({ table: "events", record: entry.event });
    else if (entry.course)
      edit({ table: "courses", record: record(entry.course) });
  };
  return (
    <>
      <Heading
        eyebrow="EVERYTHING IN ONE PLACE"
        title="Calendar"
        subtitle="Classes, deadlines, assessments, and your own events."
        action={
          <AddButton
            label="Add event"
            onClick={() => edit({ table: "events" })}
          />
        }
      />
      <div className="calendar-toolbar">
        <div className="month-controls">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={20} />
          </button>
          <h2>
            {new Intl.DateTimeFormat("en-AE", {
              month: "long",
              year: "numeric",
            }).format(month)}
          </h2>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="segmented">
          <button
            className={mode === "month" ? "selected" : ""}
            onClick={() => setMode("month")}
          >
            Month
          </button>
          <button
            className={mode === "agenda" ? "selected" : ""}
            onClick={() => setMode("agenda")}
          >
            Agenda
          </button>
        </div>
      </div>
      {mode === "month" ? (
        <div className="calendar-grid">
          {days.map((day) => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ))}
          {dates.map((date, index) => {
            const key = calendarDay(date);
            const dayEntries = entries.filter((e) => e.date === key);
            return (
              <div
                className={`calendar-day ${date.getMonth() !== month.getMonth() ? "outside" : ""}`}
                key={index}
              >
                <span
                  className={`day-number ${key === calendarDay(dubaiNow()) ? "today" : ""}`}
                >
                  {date.getDate()}
                </span>
                {dayEntries.slice(0, 3).map((entry) => (
                  <button
                    className={`calendar-chip ${entry.type}`}
                    key={entry.id}
                    onClick={() => open(entry)}
                    title={entry.title}
                  >
                    {entry.title}
                  </button>
                ))}
                {dayEntries.length > 3 && (
                  <small>+{dayEntries.length - 3} more</small>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel agenda-list">
          {entries.filter(
            (e) => e.date.slice(0, 7) === calendarDay(month).slice(0, 7),
          ).length ? (
            entries
              .filter(
                (e) => e.date.slice(0, 7) === calendarDay(month).slice(0, 7),
              )
              .map((entry) => (
                <button
                  className="list-row"
                  key={entry.id}
                  onClick={() => open(entry)}
                >
                  <span className={`calendar-marker ${entry.type}`} />
                  <span className="list-main">
                    <strong>{entry.title}</strong>
                    <small>
                      {entry.course?.code || kindLabel(entry.type)}{" "}
                      {entry.note && `· ${entry.note}`}
                    </small>
                  </span>
                  <span className="row-right">
                    {formatDate(`${entry.date}T12:00:00+04:00`)}
                  </span>
                </button>
              ))
          ) : (
            <div className="inline-empty">Nothing scheduled this month.</div>
          )}
        </div>
      )}
    </>
  );
}

export function NotesView() {
  const { data, semester, edit } = useApp();
  const [query, setQuery] = useState("");
  const notes = data.notes.filter(
    (n) =>
      (!n.semester_id || n.semester_id === semester?.id) &&
      `${n.title} ${n.content}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow="CAPTURE WHAT MATTERS"
        title="Notes"
        subtitle="A simple place for ideas, reminders, and course notes."
        action={
          <AddButton
            label="New note"
            onClick={() => edit({ table: "notes" })}
          />
        }
      />
      <div className="search-field">
        <Search size={18} />
        <input
          aria-label="Search notes"
          placeholder="Search your notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {notes.length ? (
        <div className="card-grid note-grid">
          {notes.map((n) => (
            <button
              className="entity-card note-card"
              key={n.id}
              onClick={() => edit({ table: "notes", record: record(n) })}
            >
              <div className="note-card-top">
                <FileText size={20} />
                {n.pinned && <span className="badge green">Pinned</span>}
              </div>
              <h3>{n.title}</h3>
              <p>{n.content || "No content yet"}</p>
              <small>
                {formatDate(n.updated_at)}{" "}
                {n.course_id &&
                  `· ${data.courses.find((c) => c.id === n.course_id)?.code ?? ""}`}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          icon={FileText}
          title={query ? "No matching notes" : "No notes yet"}
          detail={
            query
              ? "Try a different search."
              : "Capture your first idea or course reminder."
          }
          action={
            !query && (
              <AddButton
                label="Create note"
                onClick={() => edit({ table: "notes" })}
              />
            )
          }
        />
      )}
    </>
  );
}

export function AnalyticsView() {
  const { data, semester } = useApp();
  const ids = new Set(
    data.courses.filter((c) => c.semester_id === semester?.id).map((c) => c.id),
  );
  const assignments = data.items.filter(
    (i) => ids.has(i.course_id) && i.kind === "assignment",
  );
  const done = assignments.filter((i) => i.status === "completed").length;
  const rate = assignments.length
    ? Math.round((done / assignments.length) * 100)
    : 0;
  const all = data.semesters
    .slice()
    .reverse()
    .map((s) => ({
      name: s.name,
      ...calculateGpa(
        data.courses.filter((c) => c.semester_id === s.id),
        data.settings?.grade_scale ?? AUS_SCALE,
      ),
    }));
  const currentCourses = data.courses.filter((c) => ids.has(c.id));
  return (
    <>
      <Heading
        eyebrow="YOUR PROGRESS"
        title="Analytics"
        subtitle="A useful view of how your semester is going."
      />
      <div className="stats-grid two">
        <Stat
          label="Assignment completion"
          value={`${rate}%`}
          detail={`${done} of ${assignments.length} completed`}
        />
        <Stat
          label="Open assignments"
          value={String(assignments.length - done)}
          detail={`${assignments.filter((i) => deadlineState(i.due_at, i.status) === "overdue").length} overdue`}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>GPA over time</h2>
          </div>
          {all.some((s) => s.gpa !== null) ? (
            <div className="bar-chart">
              {all.map((s) => (
                <div className="bar-row" key={s.name}>
                  <span>{s.name}</span>
                  <div className="bar-track">
                    <div style={{ width: `${((s.gpa ?? 0) / 4) * 100}%` }} />
                  </div>
                  <strong>{fmtNumber(s.gpa)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="inline-empty">
              Enter final course grades to see your GPA trend.
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Grades by course</h2>
          </div>
          {currentCourses.length ? (
            currentCourses.map((c) => {
              const result = calculateWeightedGrade(
                data.categories.filter((cat) => cat.course_id === c.id),
                data.items.filter((i) => i.course_id === c.id),
              );
              return (
                <div className="bar-row" key={c.id}>
                  <span>{c.code}</span>
                  <div className="bar-track">
                    <div
                      style={{
                        width: `${result.percent ?? 0}%`,
                        backgroundColor: c.color,
                      }}
                    />
                  </div>
                  <strong>
                    {result.percent === null
                      ? "—"
                      : `${result.percent.toFixed(0)}%`}
                  </strong>
                </div>
              );
            })
          ) : (
            <div className="inline-empty">No courses in this semester.</div>
          )}
        </section>
      </div>
    </>
  );
}

export function SearchView() {
  const { data, edit, setSection } = useApp();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = (value: string) => value.toLowerCase().includes(q);
  const courses = q
    ? data.courses.filter((c) =>
        matches(`${c.code} ${c.name} ${c.instructor ?? ""}`),
      )
    : [];
  const items = q
    ? data.items.filter((i) =>
        matches(`${i.title} ${i.description ?? ""} ${i.topics ?? ""}`),
      )
    : [];
  const notes = q
    ? data.notes.filter((n) => matches(`${n.title} ${n.content}`))
    : [];
  return (
    <>
      <Heading
        eyebrow="FIND IT FAST"
        title="Search"
        subtitle="Find courses, assignments, assessments, and notes across all semesters."
      />
      <div className="search-field large">
        <Search size={20} />
        <input
          autoFocus
          aria-label="Search everything"
          placeholder="Search everything…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {q ? (
        <div className="search-results">
          {courses.length > 0 && (
            <section className="panel">
              <h2>Courses</h2>
              {courses.map((c) => (
                <button
                  className="simple-row"
                  key={c.id}
                  onClick={() => {
                    edit({ table: "courses", record: record(c) });
                    setSection("courses");
                  }}
                >
                  <strong>
                    {c.code} · {c.name}
                  </strong>
                  <span>
                    {data.semesters.find((s) => s.id === c.semester_id)?.name}
                  </span>
                </button>
              ))}
            </section>
          )}
          {items.length > 0 && (
            <section className="panel">
              <h2>Assignments & assessments</h2>
              {items.map((i) => (
                <button
                  className="simple-row"
                  key={i.id}
                  onClick={() => edit({ table: "items", record: record(i) })}
                >
                  <strong>{i.title}</strong>
                  <span>
                    {kindLabel(i.kind)} ·{" "}
                    {data.courses.find((c) => c.id === i.course_id)?.code}
                  </span>
                </button>
              ))}
            </section>
          )}
          {notes.length > 0 && (
            <section className="panel">
              <h2>Notes</h2>
              {notes.map((n) => (
                <button
                  className="simple-row"
                  key={n.id}
                  onClick={() => edit({ table: "notes", record: record(n) })}
                >
                  <strong>{n.title}</strong>
                  <span>{n.content.slice(0, 70)}</span>
                </button>
              ))}
            </section>
          )}
          {!courses.length && !items.length && !notes.length && (
            <Empty
              icon={Search}
              title="No results"
              detail="Try another word or phrase."
            />
          )}
        </div>
      ) : (
        <Empty
          icon={Search}
          title="Everything is searchable"
          detail="Start typing to find something in your workspace."
        />
      )}
    </>
  );
}

export function SettingsView({
  saveSettings,
}: {
  saveSettings: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const { data, user } = useApp();
  const [theme, setTheme] = useState(data.settings?.theme ?? "system");
  const [scale, setScale] = useState(data.settings?.grade_scale ?? AUS_SCALE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (
        Object.values(scale).some((v) => !Number.isFinite(v) || v < 0 || v > 4)
      )
        throw new Error("Grade points must be between 0 and 4.");
      await saveSettings({
        theme,
        grade_scale: scale,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="MAKE IT YOURS"
        title="Settings"
        subtitle="Appearance, academic rules, data, and account."
      />
      <div className="settings-stack">
        <section className="panel">
          <h2>Appearance</h2>
          <p className="muted">Choose how your workspace looks.</p>
          <div className="segmented">
            {(["light", "dark", "system"] as const).map((option) => (
              <button
                key={option}
                className={theme === option ? "selected" : ""}
                onClick={() => setTheme(option)}
              >
                {kindLabel(option)}
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>AUS GPA scale</h2>
          <p className="muted">
            Official default points are shown below. Change them only if your
            academic rules differ.
          </p>
          <div className="scale-grid">
            {Object.entries(scale).map(([letter, points]) => (
              <label className="field" key={letter}>
                <span>{letter}</span>
                <input
                  type="number"
                  min="0"
                  max="4"
                  step="0.01"
                  value={points}
                  onChange={(e) =>
                    setScale((previous) => ({
                      ...previous,
                      [letter]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <button className="text-button" onClick={() => setScale(AUS_SCALE)}>
            Restore AUS defaults
          </button>
          <p className="field-hint">
            Non-GPA grades: {NON_GPA_GRADES.join(", ")}.
          </p>
        </section>
        <section className="panel">
          <h2>Data and backup</h2>
          <BackupSettings />
        </section>
        <section className="panel">
          <h2>Account</h2>
          <dl className="detail-list">
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Account type</dt>
              <dd>Private, single-user</dd>
            </div>
          </dl>
          <button
            className="secondary-button"
            onClick={() =>
              void (async () => {
                const password = window.prompt(
                  "Enter a new password (at least 8 characters):",
                );
                if (!password) return;
                if (password.length < 8) {
                  window.alert("Use at least 8 characters.");
                  return;
                }
                const { error } = await (
                  await import("@/lib/supabase")
                )
                  .supabase()
                  .auth.updateUser({ password });
                window.alert(error ? error.message : "Password updated.");
              })()
            }
          >
            Change password
          </button>
        </section>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button
          className="primary-button settings-save"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </>
  );
}
