# AUS Student Companion

A private, single-user academic workspace for the American University of Sharjah. It brings semesters, courses, class times, assignments, exams, grades, GPA, calendar events, notes, analytics, search, and JSON backups into one browser app. Academic data lives in **Supabase PostgreSQL**; browser storage is used only by Supabase Auth to keep the sign-in session.

## What you need

- [Node.js LTS](https://nodejs.org/) (Node 22 or newer)
- [Git](https://git-scm.com/downloads)
- A free [Supabase](https://supabase.com/) account
- A free [GitHub](https://github.com/) account for deployment
- A free [Vercel](https://vercel.com/) Hobby account
- An email address for your single app account

You do **not** need to enter payment details or use a paid plan. Supabase Free currently has a 500 MB database, 5 GB egress per month, and may pause after low activity; resume it from the dashboard if that happens. It does not provide the paid plan's managed daily backups, so export JSON backups regularly. Vercel Hobby is for personal, noncommercial projects. Check each provider's current terms before setting up.

## 1. Install and run locally

Open PowerShell in this project folder:

```powershell
corepack pnpm install
```

This runs pnpm through Corepack without writing a launcher into `C:\Program Files\nodejs`, so an administrator PowerShell window is not needed. The project pins pnpm 11.25.0 in `package.json` and uses `pnpm-lock.yaml` for repeatable installs. If `corepack` is unavailable, follow the [pnpm installation instructions](https://pnpm.io/installation).

Do not start the app until you complete the Supabase steps below. Then:

```powershell
corepack pnpm dev
```

Open <http://localhost:3000>. For a production build, run `corepack pnpm build` followed by `corepack pnpm start`. Run `corepack pnpm typecheck` and `corepack pnpm test` to check the code.

## 2. Create the central database

1. Create a Supabase Free account and a **new project**. Choose a strong database password and save it in your own password manager. Never put it in this repository. After the project is ready, **click its name to open it**. You need the project dashboard, not the organization overview.
2. In the project dashboard's left sidebar, open **SQL Editor**. Copy and run the entire [`supabase/schema.sql`](supabase/schema.sql) file **once**. It creates the tables, relationships, constraints, indexes, Row Level Security policies, and three database functions for safe semester selection, import, and demo removal.
3. In that same left sidebar, click **Authentication** (lock icon), then **Users**. Click **Add user** and create your one user account. If the menu offers an invitation instead, send one to yourself and follow its email link to set a password. Use a strong password; do not share it or commit it to Git.
4. Still under **Authentication**, find the **Configuration** group and open **Sign In / Providers**, then **Email**. Email/password is enabled by default. Turn **Allow new users to sign up** **off** and save. You do **not** need to find a separate **Authentication → Settings** page. If the sidebar is collapsed, expand it or look for the lock icon first. [Supabase Auth configuration guide](https://supabase.com/docs/guides/auth/general-configuration)
5. Click **Connect** at the top of your project dashboard. Copy the **Project URL** and **publishable key**. The publishable key is designed for browser use. Never use a secret or `service_role` key in this app.
6. Copy `.env.example` to `.env.local` and fill in the two values:

```powershell
Copy-Item .env.example .env.local
```

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`.env.local` is ignored by Git. The database password and service-role key are never needed by this application.

The schema grants authenticated users access only to rows with their own `user_id`. Child records also use owner-aware foreign keys, so they cannot point to another user's semester or course. The import function runs under the signed-in user's permissions and applies its changes atomically.

## 3. Start using the app

1. Sign in with the user you created in Supabase.
2. Create a semester and set it active.
3. Add courses, meeting times, category weights, assignments, quizzes, exams, and notes.
4. Enter assessment scores when received. Blank scores are excluded from the current grade.
5. Enter each **final course letter grade manually** when official results arrive. Semester and cumulative GPA use those grades and credit hours.

In **Settings → Data and backup**, you can load sample Fall 2026 data. It is tagged as demo data and can be removed there. The app prevents demo removal if real records are linked to it. For the cleanest start, remove the demo set before entering real coursework.

### Grade calculations

Each course can have categories with weights totaling up to 100%. The current category percentage is earned points divided by possible points among **graded** items. Graded categories are weighted, then normalized by the category weight currently counted. The UI labels the result provisional if some categories or items are ungraded or less than 100% of weight is configured. An assessment without a score is never treated as zero. Final GPA uses the AUS point scale configured in Settings; non-GPA grades do not count toward attempted GPA credits.

## 4. Back up and restore

- **Export data** downloads a versioned JSON file with semesters, courses, meetings, grade categories, academic items, notes, events, and settings. Save the file somewhere private, such as your own encrypted storage.
- **Import data** validates the file and shows counts before you confirm. **Merge** adds new record IDs and updates matching ones. **Replace** removes the current academic data and restores the backup. The app requires you to download a fresh backup before replacement.
- Import is a single database transaction. If a record violates a database rule, the import fails without leaving a partial restore.
- The JSON export is for your academic records. It does not include the Supabase Auth account or password. Create the account first when restoring to a new Supabase project.
- For an additional full PostgreSQL backup, follow [Supabase's `db dump` guide](https://supabase.com/docs/guides/platform/backups). Free-plan projects should keep their own backups.

## 5. Put it online with GitHub and Vercel

After local sign-in and data operations work:

1. Create a **private**, empty GitHub repository. Do not add a README, `.gitignore`, or license on GitHub; those files already exist locally. Copy the repository URL from GitHub. In PowerShell inside this folder, set your Git author identity **for this repository** (use your own name and an email associated with your GitHub account):

```powershell
git config --local user.name "Your Name"
git config --local user.email "you@example.com"
git add .
git commit -m "Build AUS Student Companion"
git branch -M main
git remote set-url origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

Replace the sample GitHub URL with the real URL of the repository you created. This project already has a local Git repository and an `origin` remote, so use `git remote set-url origin` to correct it. If `git push` opens a browser sign-in, complete the GitHub sign-in there. GitHub does not accept your account password directly as a Git HTTPS password.

2. Create a Vercel Hobby account, choose **Add New → Project**, connect GitHub if prompted, and import that repository. Vercel should detect Next.js automatically.
3. Before clicking **Deploy**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Vercel project's **Environment Variables**. Copy their values from your local `.env.local` file. Select Production (and Preview if you use it). Do not upload `.env.local` itself or add a secret/service-role key.
4. Deploy. Vercel gives you a `*.vercel.app` URL. Open it on your computer and phone and sign in with the same Supabase user.
5. Test cross-device persistence: add an assignment on one device; reload the page on the other. The same assignment should appear.
6. Check that Supabase public signup remains disabled and that no other account has been created.

Your academic data is stored in Supabase, so edits made on one device are available on another after it reloads the page. GitHub and Vercel publish changes to the app's code; they do not sync your academic records. For later code updates: edit locally, run checks, commit, and `git push`. Vercel redeploys automatically. Database schema changes require applying a reviewed SQL migration in Supabase; do not rerun the initial schema file as a migration.

## App structure

```text
src/app/                 Next.js entry, metadata, and responsive styles
src/components/          App shell, editors, views, backup UI
src/lib/types.ts         Academic record types
src/lib/calculations.ts  GPA, weighted grade, and deadline logic
src/lib/backup.ts        Versioned backup validation
src/lib/data.ts          Supabase data access
src/lib/demo.ts          Optional sample records
supabase/schema.sql      Database and security setup
public/                  PWA manifest and icon
```

The app displays English and interprets academic date and time inputs in **Asia/Dubai**. It supports light, dark, and system appearance. The PWA manifest allows home-screen installation where supported. There is no offline write queue: reconnect and reload to get the latest database state.

## Troubleshooting

- **Sign-in fails:** Check the user's email/password, whether the account was created and confirmed, and whether the Supabase URL and anon key match the same project.
- **Tables not found or permission denied:** Run the complete SQL setup in the correct Supabase project. Check that you are signed in and RLS policies exist.
- **Project seems unavailable after inactivity:** Check whether Supabase paused the Free project and resume it from its dashboard.
- **Import fails:** Read the validation message. The backup must be version 1 and keep valid relationships and score ranges. Export a new backup from this app if the format is uncertain.
- **Vercel shows old configuration:** Update environment variables, then redeploy. Public Next.js variables are embedded at build time.

The repository does not contain a Supabase account, live database, or deployed URL. Live authentication, database operations, and cross-device checks require connecting your own accounts using the steps above.
