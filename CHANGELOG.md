# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-10-29

A usability, accessibility and correctness release built around how the app is used at rehearsal: students check in from their phones, and teachers run roll call from the field.

> **Upgrade note:** run migration `024_leave_requests.sql` before deploying. Leave requests depend on the new `leave_requests` table.

### Highlights

- **One-tap check-in for students**: a single button finds your location and checks you in. Before the window opens it shows when check-in starts. Once you are past the on-time cut-off, it warns that you will be marked late.
- **Full-screen QR for teachers**: a large QR code to hold up or project, with a live "here / expected" counter and the latest check-ins.
- **Roll call by section**: the teacher roster is grouped by section ("Brass 11/32"), puts students who still need attention first, and can be filtered and searched.
- **Leave requests**: students type a reason in the app, and the teacher approves or rejects it.

### Added

**Students**
- Leave request with a reason: students can edit or cancel it while it is pending. When the teacher approves it, the session is recorded as excused.
- Inline location status under the check-in button: in-area distance, or how far outside the allowed radius you are
- Late warning on the check-in button and the dashboard quick check-in

**Teachers**
- Full-screen QR presenter:
  - live check-in counter and last five arrivals
  - warning when the session is not accepting check-ins
  - optional browser fullscreen
- Roster filters with counts (all / not here yet / here / leave), search by name, nickname, student code or instrument, and triage ordering
- Roster grouped by section with a per-section count and the section colour
- Pending leave requests: a count on the roster header, a badge on each student, and approve / reject inside the status dialog
- Undo for status changes, from the confirmation toast
- Dashboard card for each of today's sessions:
  - here / expected and late
  - "not checked yet" while open, "absent" after it closes
  - "ดูรายชื่อ" opens that session's roster directly

**Platform**
- `leave_requests` table with Row Level Security (migration 024): students cannot approve their own requests
- Semantic colour tokens (`success`, `warning`, `danger`, `info`, `holiday`, `brand-text`) for light and dark themes
- Touch-device sizing (`coarse:`): controls, tabs and switches get 44px targets on phones and tablets, and stay compact with a mouse
- Route-level code splitting, with a retry screen if a page fails to load after a deploy

### Changed

- Check-in openness is decided by one rule everywhere. Dashboard, attendance page and check-in now agree.
- Pages refresh their time-dependent state every 30 seconds, so check-in opens without a manual reload
- The schedule page shows on-time and late cut-offs taken from the actual attendance rules
- Thursday club headcounts exclude students attending ร.ด. They are shown as "ไป ร.ด. N (ไม่นับ)".
- The teacher roster flows with the page (no nested scroll box) and collapses per session
- Error messages name the failed action and translate common Supabase and network errors into Thai
- Typography:
  - single UI font (Noto Sans Thai), loaded without blocking render
  - Thai-tuned line heights
  - minimum text size of 12px
- Motion respects `prefers-reduced-motion`. The check-in animation no longer overshoots.
- PDF export:
  - table header repeats on every page, and the legend sits in each page footer
  - week numbering no longer clashes with page numbers
- Reports:
  - status colours match the rest of the app
  - pie chart legend no longer clips
  - full section names on the bar chart

### Fixed

- **Status override could silently mis-mark a student.**
  - The dialog always preselected "present" and carried the choice over to the next student.
  - It now starts from the current status and shows it.
  - It keeps the real check-in time.
- Extra sessions appeared open on the attendance page after they had ended
- Student accounts sent a rejected (403) auto-absent request every minute
- The dashboard quick check-in card stayed visible after a successful check-in
- Avatar initials showed "UNDEFINED" for names with repeated spaces
- The admin user list overflowed the screen on phones
- Location results outside the area were reused for five minutes. Students had to wait even after walking into range.
- Opening the QR presenter crashed the page, caused by a duplicate realtime channel
- Accessibility:
  - form labels are linked to their inputs
  - icon-only buttons and switches have names
  - the mobile drawer is a proper dialog with focus return
  - status choices are announced as a radio group

### Removed

- Students can no longer mark themselves excused directly. Leave now goes through teacher approval.
- Duplicate check-in shortcut in the dashboard header
- Unused styles and the legacy `gold` colour alias (the button and badge variant is now `brand`)

## [1.0.0] - 2026-10-27

First stable release. A mobile-first, installable PWA for marching band rehearsal attendance, backed by Supabase and deployed on Netlify.

### Highlights

- **Two ways to check in**: GPS (inside the configured radius of the music room) or by scanning the QR code a teacher displays. Both are validated against the rehearsal time window.
- **Automatic attendance**: rehearsal sessions are generated nightly by `pg_cron`, and students who never check in are marked absent after the window closes. Holidays and term breaks are respected.
- **Live roster and reports**: teachers see attendance update in real time, and can export Thai PDF reports per section or per student.

### Added

**Students**
- GPS check-in with radius validation
- QR check-in (GPS is verified as well), with a check-in success animation
- Absence reason submission (status becomes *excused*)
- Attendance history, personal calendar, and multi-year academic report view
- Streak counter and badges for consecutive attendance, plus a dashboard summary
- Profile picture upload and password change / reset
- Installable PWA with app-shell caching and theme color

**Teachers**
- Live per-session attendance via Supabase Realtime
- Status override with a note
- Per-session QR code that refreshes automatically
- Extra rehearsal sessions, holidays, and term breaks
- Student list management and academic-year promotion (year level + 1, M.6 → graduated)
- Section reports, per-student calendar, and PDF export (redesigned layout)
- Classes and rooms

**Admins**
- Create user accounts (student / teacher / admin), change roles, enable / disable accounts
- Manage academic terms (semester 1 / 2), sections, and instruments
- Configure the GPS location and allowed radius

**Platform**
- Supabase schema with Row Level Security, SQL functions, and triggers (`create_daily_sessions`, `auto_mark_absent`, `recalc_student_streak`), shipped as sequentially numbered, descriptively named migrations
- Idle timeout that signs out inactive sessions
- Morning check-in window starts at 08:30; Thursday afternoon ร.ด. exemption
- English and Thai README with system flow diagrams

### Fixed

- Login loop that sent signed-in users back to the login page; improved session restoration and profile fetching
- Time zone bug in session dates and the practice schedule
- Teacher check, absent marking, and attendance-rule bugs
- PDF export bug and font rendering issues
- TypeScript errors that broke Netlify deploys
- Loading-state glitches and database performance (query optimization and UI caching)

### Removed

- Special attendance type

[1.1.0]: https://github.com/wachirawitraksa/marching-band-attendance/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/wachirawitraksa/marching-band-attendance/releases/tag/v1.0.0
