# TauntTable

TauntTable is an offline-first daily discipline PWA. Plan tasks for the day,
get local reminders, review what you completed or skipped, and keep a short
end-of-day journal.

No accounts, no app server, no Firebase, no hosted database. Your tasks,
journals, settings, food logs, and API keys stay in the browser's IndexedDB on
your own device.

## Current Features

- Daily task planner with HH:mm reminders and recurring weekday/weekend/everyday schedules.
- Local notification scheduler backed by a service worker and IndexedDB pending queue.
- Journal history with praise/roast review based on completed and skipped tasks.
- AI journal enhancement that rewrites a rough note into a 100 to 150 word daily summary.
- BYOK AI setup for Groq, Gemini, or OpenRouter. Keys are stored locally and sent directly to the chosen provider.
- Summary dashboard with completion KPIs, calendar heatmap, selected-day drilldown, and stored day snapshots so old summaries survive task edits/deletes.
- Diet tracker is hidden by default and can be activated from Settings when needed.
- Optional calorie logging, USDA food search, and AI nutrition reports after diet activation.
- Browser-only install prompt that hides automatically inside the installed PWA.
- Light and dark themes with a compact MUI + Tabler Icons interface.
- GitHub repo link in Settings for starring the project.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | MUI 9, Emotion, Tabler Icons |
| Storage | Dexie over IndexedDB |
| Notifications | Web Notifications API + service worker |
| AI providers | Groq, Gemini, OpenRouter through user-owned keys |
| PWA | Manifest + service worker + install prompt |

## Local Development

Requirements: Node 20+ and npm 10+.

```powershell
npm install
npm run dev
# open http://localhost:3000
```

Production build:

```powershell
npm run build
npm run start
```

Run a dependency security check:

```powershell
npm audit --audit-level=moderate
```

Regenerate PWA icons after editing `public/icons/icon.svg`:

```powershell
node scripts/gen-icons.js
```

## Main Workflows

### Tasks and Reminders

1. Open Today.
2. Add a task, time, optional note, and repeat days.
3. Mark tasks done from the Today list.
4. Enable notifications from the reminder banner or Settings.

Recurring tasks are marked complete per date. A Monday task completed today
returns clean next Monday.

### Summary Calendar

1. Open Summary.
2. Choose Week, Month, Year, or Custom.
3. Use the calendar arrows to move through months.
4. Click any past or current date to see completed and skipped tasks for that day.

The app stores day snapshots as you use it, so historical summaries keep their
task names even after you edit or delete tasks later.

### AI Journal Enhancement

1. Open Settings from the gear icon.
2. In AI writing, choose Groq, Gemini, or OpenRouter.
3. Create a key from the provider's key page and paste it into TauntTable.
4. Save the key.
5. Open Journal, write a rough note, then tap Enhance.
6. Keep the generated draft, edit it, or restore your original text.

The prompt includes only the selected day's completed/skipped task titles and
your note. It asks the provider for a 100 to 150 word JSON response.

### Diet Tracker Activation

The diet tracker is off by default.

1. Open Settings.
2. Switch on Diet tracker and save.
3. Open Calories from navigation.
4. Add your profile.
5. Add an AI key if you want nutrition analysis.
6. Log foods by USDA search or free text.
7. Run daily, weekly, or monthly reports.

### Install As A PWA

In a normal browser tab, TauntTable shows an install prompt on Today. You can
install it or dismiss the prompt. Once running as an installed PWA, the prompt
stays hidden.

On iOS Safari, use Share, then Add to Home Screen. On Android Chrome or Edge,
use Install app from the browser menu or the in-app install button when shown.

## Project Layout

```text
public/
  manifest.json
  sw.js
  icons/
scripts/
  gen-icons.js
src/
  app/
    page.js
    journal/page.js
    summary/page.js
    calories/page.js
    calories/settings/page.js
    calories/reports/page.js
  components/
    AppShell.js
    TopBar.js
    BottomNav.js
    SettingsDialog.js
    AIProviderSettings.js
    InstallPrompt.js
    TaskRow.js
  hooks/
    useToday.js
    useDietFeatureEnabled.js
  lib/
    db.js
    notifications.js
    aiProviders.js
    dailySummary.js
    calories.js
    foodSearch.js
    features.js
    theme.js
```

## Privacy And Security

- No login, analytics, telemetry, or app-owned backend.
- IndexedDB is the source of truth for user data.
- AI keys are BYOK, stored locally, and never sent to a TauntTable server.
- External AI requests go directly from the browser to Groq, Gemini, or OpenRouter.
- Security headers include CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, COOP, and CORP.
- `npm audit --audit-level=moderate` is clean after the PostCSS override.

## Repository

GitHub: https://github.com/Bhav-ikkk/TimeManager

## License

MIT.