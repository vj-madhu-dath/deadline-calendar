# Deadline Calendar

A single static page that turns a short business profile into a twelve-month list of
US federal and California filing deadlines, then exports them as an `.ics` calendar and
a printable checklist.

No backend, no accounts, no network calls. The profile and ticked items live in
`localStorage` on the user's machine.

## Run locally

```bash
python3 -m http.server 8899
```

Open <http://127.0.0.1:8899/>.

## Files

```text
.
├── index.html    markup and copy
├── styles.css    layout, print styles
├── rules.js      deadline rules + date logic (pure, no DOM)
├── ics.js        RFC 5545 writer (pure, no DOM)
└── app.js        form, rendering, storage, download
```

`rules.js` and `ics.js` export their functions when loaded in Node, so the date logic
and calendar output can be tested without a browser:

```bash
node -e "const {buildDeadlines} = require('./rules.js'); console.log(buildDeadlines({entity:'llc',employees:4,contractors:true,state:'CA',salesTax:true,caMonth:5,caYear:2019}, '2026-11-18', '2027-11-18').length)"
```

## Scope and accuracy

- Covers US federal rules and California. Other states fall back to federal only.
- Assumes a December fiscal year and a calendar-quarter filing schedule.
- Statutory dates are shown as written in the statute. Weekend and holiday extensions
  are flagged in the UI, not silently applied.
- California DE 9/DE 9C uses the nominal due date (the first of the month), with the
  one-month delinquency window described on the item.
- Every item links to the agency page it came from. The app is not tax or legal advice.

## Deploy

Push to a public repo named `deadline-calendar`, then in Settings → Pages publish from
the `main` branch at the repo root. The site appears at
`https://vj-madhu-dath.github.io/deadline-calendar/`. No build step, no `.nojekyll`
needed beyond the empty file already here.
