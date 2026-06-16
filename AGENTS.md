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

## Common Commands

- `npm run lint`: run ESLint across the repository.
- `./messagingmenu.sh zip`: build `messagingmenu@lauinger-clan.de.shell-extension.zip`.
- `./messagingmenu.sh install`: build if needed, install, and enable the extension locally.
- `./messagingmenu.sh translate`: regenerate `po/messagingmenu.pot` and update existing `.po` files.

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
- Check `gnome-extension-review.md` when changing runtime, preferences,
  metadata, schema, packaging, or user-data behavior that may affect
  extensions.gnome.org review.

## Translations

If a change adds, removes, or edits user-visible strings wrapped for translation, remind the user to run:

```sh
./messagingmenu.sh translate
```

Do not update translations automatically unless the user asks, because it may touch many `po/` files.

## Style

- Follow `.editorconfig` and `.prettierrc`: spaces, LF, final newline, 4-space
  indentation for JS/CSS, double quotes, semicolons, and 120-column print width.
- ESLint config is in `eslint.config.js` and includes GJS-specific globals and
  restrictions. Prefer satisfying `npm run lint` over adding disables.
- Keep code idiomatic for modern GJS: classes, `const`/`let`, ES module imports,
  arrow functions where appropriate, and `this.getLogger()` for extension logging.
- Avoid broad refactors in this repo. The extension is compact, and targeted
  changes are easier to verify across GNOME Shell versions.

## Manual Testing Checklist

When a change touches runtime behavior:

1. Run `npm run lint`.
2. Build with `./messagingmenu.sh zip`.
3. Install with `./messagingmenu.sh install` on a GNOME Shell session when available.
4. Restart GNOME Shell or log out/in if needed.
5. Verify the indicator appears, the menu opens, settings opens, and notification
   color/wiggle behavior still works for the affected app categories.

When a change touches preferences:

1. Run `npm run lint`.
2. Open the extension preferences from GNOME Extensions or middle-click the panel
   indicator.
3. Verify switches, color selection, app add/select/scan flows, reset behavior,
   and list population.

When a change touches translations:

1. Run `./messagingmenu.sh translate`.
2. Review changes in `po/messagingmenu.pot` and existing `.po` files.
3. Do not hand-edit unrelated translated strings.

## Repository Hygiene

- Do not commit generated extension zip files unless explicitly requested.
- Do not change `metadata.json` version or shell compatibility casually; those
  values affect release and extensions.gnome.org behavior.
- Respect existing user changes in the working tree. Read before editing files
  that are already modified.
