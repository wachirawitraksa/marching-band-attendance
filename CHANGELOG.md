# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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

[1.0.0]: https://github.com/wachirawitraksa/marching-band-attendance/releases/tag/v1.0.0
