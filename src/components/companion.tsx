"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  Home,
  Layers3,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { loadData, remove, saveSettings, upsert, type Table } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { activeSemester } from "@/lib/calculations";
import type { DataSet, Section, Semester } from "@/lib/types";
import { Editor, type EditorTarget } from "./editor";
import {
  DashboardView,
  SemesterView,
  CourseView,
  ScheduleView,
  ItemsView,
  GradesView,
  GpaView,
  CalendarView,
  NotesView,
  AnalyticsView,
  SearchView,
  SettingsView,
} from "./views";

const emptyData: DataSet = {
  semesters: [],
  courses: [],
  meetings: [],
  categories: [],
  items: [],
  notes: [],
  events: [],
  settings: null,
};
type AppContextValue = {
  data: DataSet;
  user: User;
  semester: Semester | undefined;
  section: Section;
  setSection: (s: Section) => void;
  selectedSemesterId: string;
  setSelectedSemesterId: (id: string) => void;
  edit: (target: EditorTarget) => void;
  save: (table: Table, payload: Record<string, unknown>) => Promise<void>;
  del: (table: Table, id: string) => Promise<void>;
  refresh: () => Promise<void>;
  notice: (message: string) => void;
};
const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Missing app context");
  return value;
}

const nav: { section: Section; label: string; icon: typeof Home }[] = [
  { section: "dashboard", label: "Overview", icon: Home },
  { section: "semesters", label: "Semesters", icon: Layers3 },
  { section: "courses", label: "Courses", icon: BookOpen },
  { section: "schedule", label: "Class schedule", icon: Clock3 },
  { section: "assignments", label: "Assignments", icon: ClipboardList },
  { section: "exams", label: "Exams & quizzes", icon: GraduationCap },
  { section: "grades", label: "Grades", icon: ChartNoAxesCombined },
  { section: "gpa", label: "GPA calculator", icon: ShieldCheck },
  { section: "calendar", label: "Calendar", icon: CalendarDays },
  { section: "notes", label: "Notes", icon: FileText },
  { section: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { section: "search", label: "Search", icon: Search },
  { section: "settings", label: "Settings", icon: Settings2 },
];

export function Companion() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<DataSet>(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [section, setSectionState] = useState<Section>("dashboard");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadData());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load data");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!configured) {
      setAuthReady(true);
      return;
    }
    const db = supabase();
    db.auth.getUser().then(({ data: auth, error: authError }) => {
      setUser(auth.user);
      setAuthReady(true);
      if (authError && authError.message !== "Auth session missing!")
        setError(authError.message);
    });
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    const hash = window.location.hash.slice(1) as Section;
    if (nav.some((item) => item.section === hash)) setSectionState(hash);
    return () => listener.subscription.unsubscribe();
  }, [configured]);
  useEffect(() => {
    if (user) void refresh();
    else setData(emptyData);
  }, [user?.id, refresh]);
  useEffect(() => {
    const theme = data.settings?.theme ?? "system";
    document.documentElement.dataset.theme = theme;
  }, [data.settings?.theme]);
  useEffect(() => {
    if (!selectedSemesterId && data.semesters.length)
      setSelectedSemesterId(activeSemester(data.semesters)?.id ?? "");
  }, [data.semesters, selectedSemesterId]);
  const semester =
    data.semesters.find((s) => s.id === selectedSemesterId) ??
    activeSemester(data.semesters);
  const setSection = (next: Section) => {
    setSectionState(next);
    setMobileMenu(false);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const notice = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  };
  const save = async (table: Table, payload: Record<string, unknown>) => {
    if (!user) return;
    await upsert(table, payload, user.id);
    await refresh();
    notice("Saved successfully");
  };
  const del = async (table: Table, id: string) => {
    await remove(table, id);
    await refresh();
    notice("Deleted");
  };
  const context = useMemo<AppContextValue>(
    () => ({
      data,
      user: user!,
      semester,
      section,
      setSection,
      selectedSemesterId,
      setSelectedSemesterId,
      edit: setEditor,
      save,
      del,
      refresh,
      notice,
    }),
    [data, user, semester, section, selectedSemesterId],
  );

  if (!authReady)
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p>Opening your companion…</p>
      </div>
    );
  if (!configured)
    return (
      <div className="center-screen">
        <div className="brand-mark">A</div>
        <h1>Connect your workspace</h1>
        <p>
          Add your Supabase URL and publishable key to <code>.env.local</code>,
          then restart the app.
        </p>
        <p>Follow the setup steps in README.md.</p>
      </div>
    );
  if (!user) return <SignIn error={error} setError={setError} />;

  const current = nav.find((item) => item.section === section) ?? nav[0];
  return (
    <AppContext.Provider value={context}>
      <div className="app-shell">
        <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
          <div className="brand">
            <div className="brand-mark">A</div>
            <div>
              <strong>AUS Companion</strong>
              <span>Student workspace</span>
            </div>
            <button
              className="icon-button mobile-only"
              onClick={() => setMobileMenu(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Main navigation">
            {nav.map((item) => (
              <button
                key={item.section}
                className={`nav-item ${section === item.section ? "active" : ""}`}
                onClick={() => setSection(item.section)}
              >
                <item.icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="account-avatar">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="account-text">
              <strong>My account</strong>
              <small>{user.email}</small>
            </div>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => void supabase().auth.signOut()}
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>
        {mobileMenu && (
          <button
            className="scrim mobile-only"
            aria-label="Close menu"
            onClick={() => setMobileMenu(false)}
          />
        )}
        <div className="main-wrap">
          <header className="topbar">
            <button
              className="icon-button mobile-only"
              aria-label="Open menu"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={22} />
            </button>
            <div className="breadcrumb">
              Workspace <span>/</span> <strong>{current.label}</strong>
            </div>
            <div className="top-actions">
              {data.semesters.length > 0 && (
                <label className="semester-picker">
                  <span className="sr-only">Selected semester</span>
                  <select
                    value={semester?.id ?? ""}
                    onChange={(e) => setSelectedSemesterId(e.target.value)}
                  >
                    {data.semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </label>
              )}
              <button
                className="icon-button"
                aria-label="Search"
                onClick={() => setSection("search")}
              >
                <Search size={20} />
              </button>
              <button
                className="primary-button top-add"
                onClick={() =>
                  setEditor({ table: "items", kind: "assignment" })
                }
              >
                <Plus size={17} /> New assignment
              </button>
            </div>
          </header>
          <main className="content">
            {error && (
              <div className="error-banner" role="alert">
                {error}
                <button onClick={() => setError("")}>Dismiss</button>
              </div>
            )}
            {loading && <div className="loading-bar" />}
            {section === "dashboard" && <DashboardView />}
            {section === "semesters" && <SemesterView />}
            {section === "courses" && <CourseView />}
            {section === "schedule" && <ScheduleView />}
            {section === "assignments" && <ItemsView kind="assignment" />}
            {section === "exams" && <ItemsView kind="exam" />}
            {section === "grades" && <GradesView />}
            {section === "gpa" && <GpaView />}
            {section === "calendar" && <CalendarView />}
            {section === "notes" && <NotesView />}
            {section === "analytics" && <AnalyticsView />}
            {section === "search" && <SearchView />}
            {section === "settings" && (
              <SettingsView
                saveSettings={async (payload) => {
                  await saveSettings(payload, user.id);
                  await refresh();
                  notice("Settings saved");
                }}
              />
            )}
          </main>
        </div>
        {editor && <Editor target={editor} onClose={() => setEditor(null)} />}
        {message && (
          <div className="toast" role="status">
            {message}
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}

function SignIn({
  error,
  setError,
}: {
  error: string;
  setError: (value: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: signInError } = await supabase().auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) setError(signInError.message);
    setBusy(false);
  }
  return (
    <div className="signin-page">
      <div className="signin-brand">
        <div className="brand-mark large">A</div>
        <h1>A little more room to think.</h1>
        <p>
          Classes, deadlines, notes, and progress—all in one personal workspace.
        </p>
        <div className="signin-decoration">
          <div>
            <span>01</span>
            <strong>Stay on top of what matters.</strong>
          </div>
          <div>
            <span>02</span>
            <strong>See the whole semester clearly.</strong>
          </div>
          <div>
            <span>03</span>
            <strong>Make every day count.</strong>
          </div>
        </div>
      </div>
      <div className="signin-panel">
        <div className="signin-card">
          <div className="eyebrow">AUS STUDENT COMPANION</div>
          <h2>Welcome back</h2>
          <p>Sign in to pick up where you left off.</p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <small>
            Your account is created privately. Public signup is unavailable.
          </small>
        </div>
      </div>
    </div>
  );
}
