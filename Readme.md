1. Project Overview
We are building a small, beautiful, single-purpose web app called TauntTable. It is designed to live permanently on your phone as a real app (PWA) and does only two main things every single day:

You write your daily timetable and it reminds you at the exact times with encouraging quotes.
At the end of the day you write a short note about what you actually achieved, and the app instantly checks your performance and either praises you or roasts you brutally if you failed.

Everything stays 100% private on whichever phone you install it. Your sister can install the exact same app on her phone and her timetable, reminders, journal, and roasts will never mix with yours. There is no login, no accounts, no server database, and no way for data to collide between devices.
The entire experience is built to feel premium, calm, and addictive — exactly like a high-end Apple app or modern SaaS product. The moment you open it you should feel “I actually want to use this and write here every day.”
2. Core Goals

Make you stick to your daily plan with gentle reminders + motivational quotes.
Hold you accountable at night with honest (sometimes savage) feedback.
Feel so clean, beautiful, and frictionless that using it becomes a daily pleasure.
Work perfectly offline on any phone.
Cost exactly zero rupees or dollars — no paid services, no subscriptions, no hidden fees.
Support both light and dark themes with a simple toggle.
Run smoothly as a real installed app on iOS (and Android) with proper notifications and alarms.

3. Key Features (User Flow)

Today’s Timetable Screen
You see a clean daily planner. You type any task and pick the exact time. The app schedules a notification for that moment. When the time arrives, your phone shows the task plus a short motivational quote. You can mark tasks as done with a simple checkbox.
End-of-Day Journal Screen
At night you open this screen, write a short honest note about what you actually did, and tap “Save & Review”. The app instantly looks at your timetable:
If you completed everything → a rare, calm “good job” notification.
If you missed anything → a brutally honest roast notification that taunts you (we keep a list of sharp, funny roast lines inside the app).

Local-Only Storage
All tasks and journal notes are saved directly inside the phone’s own storage. No cloud, no server, no internet required after the first load.
Theme Toggle
A clean switch in the top-right corner lets you instantly change between Light and Dark mode. Both modes look premium and follow Apple-level design standards.
Zero-Cost Notifications & Alarms
We use only the browser’s built-in Web Notifications API together with a tiny Service Worker. This is completely free and part of every modern browser (including Safari on iOS). Once you add the app to your home screen, notifications fire even when the app is closed, exactly like a native alarm. No Firebase, no OneSignal, no paid push services — zero rupees spent.

4. UI/UX Design Principles (Premium Apple-Style SaaS Look)
The entire interface is deliberately minimal, spacious, and beautiful so you actually enjoy opening the app and writing in it.

Overall Feel: Clean like Apple Notes or Notion — generous white space, large readable typography, nothing cluttered. Every screen feels calm and focused so you love spending time there.
Theme Toggle: Light mode uses soft off-white backgrounds with deep charcoal text. Dark mode uses deep charcoal backgrounds with crisp white text. A simple toggle icon sits at the top and instantly switches both colors and accents.
Color Psychology (Best for Motivation & Focus):
Primary accent: Soft teal / sage green (promotes calm focus and growth).
Secondary accent: Warm muted purple (encourages creativity without being aggressive).
Neutral backgrounds: Pure white or very light gray in light mode; rich dark charcoal in dark mode.
Success states: Gentle green.
Warning/roast states: Subtle warm amber (never angry red).
These colors are chosen because they feel premium, trustworthy, and energizing — exactly what makes you want to keep using the app daily.

Icons: We use clean, modern Tabler Icons. Every icon is line-style, lightweight, and perfectly matched to the theme (they automatically change color in light/dark mode).
Visual Elements:
Avatars: A very light, minimalist circular avatar (just your first initial in a soft-colored circle) appears in the top bar for a personal touch.
Skeletons: When anything is loading (very rare because everything is local), elegant skeleton placeholders appear — thin rounded gray bars that perfectly match the final content layout.
Breadcrumbs: Small, clean breadcrumbs appear on the Journal screen (example: Home → Journal → 19 April) so you always know where you are. They are light, rounded, and use subtle gray text.
Chips: Task tags or status indicators use small, fully rounded chips with very light backgrounds and soft borders. They look premium and never feel heavy.
Cards & Containers: All content sits inside softly rounded cards with extremely subtle shadows (almost invisible) so the design stays flat and clean like Apple.
No Animations: Zero fancy transitions, fades, or motion effects. Every interaction is instant and static — the screen simply updates cleanly. This keeps the app feeling fast, professional, and distraction-free.

Typography: Large, highly readable headings and body text with perfect spacing. The journal writing area feels like a beautiful blank notebook page.
Responsiveness: The design is fully responsive. It looks perfect on iPhone, Android phones, and even desktop browsers. Because it is meant to be installed as a PWA, the mobile experience is the primary focus.

The final result is an app that feels expensive, calming, and motivating — the kind of app you open because you want to, not because you have to.
5. Notification System (Completely Free)
We are using the standard Web Notifications API that every browser already provides.

A tiny Service Worker runs in the background and allows notifications to appear even when the app is closed.
On iOS you simply open the website in Safari, tap Share → “Add to Home Screen”, and it becomes a real app icon with full notification support.
No third-party services are involved.
No cost whatsoever — this is a built-in browser feature used by millions of apps.

6. Zero-Cost Approach (No Money Spent Anywhere)

Hosting: Vercel free hobby tier (unlimited for our small app).
All libraries: Open-source and free (Next.js, MUI, Dexie for local storage, Tabler Icons).
Storage: Phone’s own built-in storage (no database server).
Notifications: Browser’s own Web Notifications API + Service Worker.
Domain: You can use the free Vercel URL forever, or add a free custom domain later if you want.

Nothing in this project requires payment at any stage.
7. How the App Will Feel in Daily Use

Morning: Open TauntTable → instantly see today’s clean timetable → add tasks → done.
During the day: Phone quietly notifies you with your task + a short uplifting quote.
Night: Open Journal → write your short note → tap save → receive either a calm pat on the back or a sharp roast that makes you smile (and motivates you for tomorrow).
Every time you open it, the clean Apple-style design and perfect spacing make you feel good about being there.

8. Future-Proof Notes
The app is deliberately kept tiny and simple. Because everything is local and offline-first, it will keep working for years even if you never touch the code again. Adding new roast quotes or motivational quotes later is just a matter of editing a list inside the app.
This document gives the complete, crystal-clear picture of exactly what we are building: a premium, zero-cost, local-only, Apple-quality daily discipline PWA that reminds you, holds you accountable, and feels so good to use that you actually look forward to writing in it every day.
Ready to build it step by step in plain English whenever you are.