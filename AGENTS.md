# AGENTS.md

Guidance for AI agents working in this repository.

## Project Overview

This repository contains the GNOME Shell extension `messagingmenu@lauinger-clan.de`.
It adds a panel indicator for installed email, chat, and microblogging apps and
changes the indicator state when matching notifications are present.

The code is a small GJS/GTK project, not a web app. Prefer GNOME Shell and GJS
APIs over browser or Node patterns.

## Important Paths

- `messagingmenu@lauinger-clan.de/extension.js`: runtime GNOME Shell extension.
- `messagingmenu@lauinger-clan.de/prefs.js`: preferences window, built with GTK4/libadwaita.
- `messagingmenu@lauinger-clan.de/metadata.json`: extension metadata, UUID, shell versions, release version.
- `messagingmenu@lauinger-clan.de/schemas/org.gnome.shell.extensions.messagingmenu.gschema.xml`: GSettings schema and defaults.
- `messagingmenu@lauinger-clan.de/ui/prefs.ui`: GtkBuilder UI for preferences.
- `po/`: gettext template and translations.
- `messagingmenu.sh`: helper for packing, installing, uploading, and updating translations.
- `.github/workflows/`: CI, release, and stale issue workflows.

## Useful Commands

- `./messagingmenu.sh install-dependencies`: install the locked JavaScript dependencies.
- `npm run lint`: run ESLint across the repository.
- `./messagingmenu.sh zip`: build `messagingmenu@lauinger-clan.de.shell-extension.zip`.
- `./messagingmenu.sh install`: build if needed, install, and enable the extension locally.
- `./messagingmenu.sh translate`: regenerate `po/messagingmenu.pot` and update existing `.po` files.

Run `./messagingmenu.sh install-dependencies` after pulling or rebasing remote
changes that modify `package-lock.json`, particularly Renovate updates.

There is no useful automated test suite at the moment. `npm test` intentionally
fails with the default placeholder script. For behavioral changes, use linting
plus manual GNOME Shell testing where possible.

## Development Notes

- The package uses ES modules (`"type": "module"`) and GJS imports such as
  `gi://Gio` and `resource:///org/gnome/shell/...`.
- Keep compatibility with the shell versions listed in `metadata.json`.
- Runtime code lives in `extension.js`; preferences UI behavior lives in `prefs.js`.
- App matching is driven by semicolon-delimited GSettings strings in the schema.
  When changing defaults, update the schema and consider whether preferences UI
  display, scanning, and translations need corresponding changes.
- Notification matching happens through GNOME Shell's `Main.messageTray` sources.
  Be careful with null/undefined checks because sources can differ by app and
  GNOME Shell version.
- The extension uses gettext. Wrap new user-visible strings with `_()` or
  `ngettext()` as appropriate, then run `./messagingmenu.sh translate` when the
  string set changes.
- The release workflow builds with `dbus-run-session -- ./messagingmenu.sh zip`.
  Avoid changing packaging behavior without checking `.github/workflows/release.yml`.
- Use `$review-gnome-shell-extension` when changing runtime, preferences,
  metadata, schema, packaging, or user-data behavior that may affect
  extensions.gnome.org review.

## Style

- Follow `.editorconfig` and `.prettierrc`: spaces, LF, final newline, 4-space
  indentation for JS/CSS, double quotes, semicolons, and 120-column print width.
- ESLint config is in `eslint.config.js` and includes GJS-specific globals and
  restrictions. Prefer satisfying `npm run lint` over adding disables.
- Keep code idiomatic for modern GJS: classes, `const`/`let`, ES module imports,
  arrow functions where appropriate, and `this.getLogger()` for extension logging.
- Avoid broad refactors in this repo. The extension is compact, and targeted
  changes are easier to verify across GNOME Shell versions.

## Validation Checklist

Before finishing changes, run the validations that match the edit:

- JavaScript changes: `npm run lint`.
- Schema, metadata, packaging, icon, UI, or translation changes:
  `./messagingmenu.sh zip`.
- User-visible strings: `./messagingmenu.sh translate`, then review changes in
  `po/messagingmenu.pot` and existing `.po` files. Do not hand-edit unrelated
  translated strings.
- Runtime behavior: install the extension with `./messagingmenu.sh install` in a
  GNOME Shell session, restart GNOME Shell or log out and in if needed, and verify
  that the indicator appears, the menu and settings open, and notification
  color/wiggle behavior works for the affected app categories.
- Preferences behavior: open the extension preferences from GNOME Extensions or
  middle-click the panel indicator, then verify switches, color selection, app
  add/select/scan flows, reset behavior, and list population.
- Submission-oriented changes: use `$review-gnome-shell-extension` to check
  lifecycle cleanup, process boundaries, metadata, schemas, privacy, licensing,
  maintainability, and packaging requirements, including the ZIP contents.

If a required GNOME or gettext command is unavailable in the environment, state
that clearly in the final response.

## Repository Hygiene

- Do not commit generated extension zip files unless explicitly requested.
- Do not change `metadata.json` version or shell compatibility casually; those
  values affect release and extensions.gnome.org behavior.
- Respect existing user changes in the working tree. Read before editing files
  that are already modified.
