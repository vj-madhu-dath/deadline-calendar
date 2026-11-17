/* UI wiring. All state stays in localStorage. */

(function () {
  "use strict";

  const STORAGE_KEY = "deadline-calendar.v1";
  const DAY = 24 * 60 * 60 * 1000;

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("profile"),
    entity: $("entity"),
    employees: $("employees"),
    contractors: $("contractors"),
    state: $("state"),
    salesTax: $("salesTax"),
    caMonth: $("caMonth"),
    caYear: $("caYear"),
    caFields: $("ca-fields"),
    list: $("list"),
    count: $("count"),
    download: $("download"),
    print: $("print"),
    clear: $("clear"),
    note: $("form-note"),
    results: $("results"),
  };

  const defaults = {
    entity: "sole",
    employees: 0,
    contractors: false,
    state: "CA",
    salesTax: false,
    caMonth: "",
    caYear: "",
  };

  let state = load();
  let events = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { profile: { ...defaults }, done: {} };
      const parsed = JSON.parse(raw);
      return {
        profile: { ...defaults, ...(parsed.profile || {}) },
        done: parsed.done && typeof parsed.done === "object" ? parsed.done : {},
      };
    } catch {
      return { profile: { ...defaults }, done: {} };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode: keep working in memory */
    }
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function profileFromForm() {
    return {
      entity: els.entity.value,
      employees: Math.max(0, Number.parseInt(els.employees.value, 10) || 0),
      contractors: els.contractors.checked,
      state: els.state.value,
      salesTax: els.salesTax.checked,
      caMonth: Number.parseInt(els.caMonth.value, 10) || 0,
      caYear: Number.parseInt(els.caYear.value, 10) || 0,
    };
  }

  function fillForm() {
    const p = state.profile;
    els.entity.value = p.entity;
    els.employees.value = String(p.employees);
    els.contractors.checked = Boolean(p.contractors);
    els.state.value = p.state;
    els.salesTax.checked = Boolean(p.salesTax);
    els.caMonth.value = p.caMonth ? String(p.caMonth) : "";
    els.caYear.value = p.caYear ? String(p.caYear) : "";
    syncCaVisibility();
  }

  function syncCaVisibility() {
    els.caFields.hidden = els.state.value !== "CA";
  }

  function buildMonthOptions() {
    const frag = document.createDocumentFragment();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Month";
    frag.append(blank);
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
        new Date(2024, m - 1, 1)
      );
      frag.append(opt);
    }
    els.caMonth.append(frag);
  }

  function formatMonth(iso) {
    const [y, m] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
      new Date(y, m - 1, 1)
    );
  }

  function formatDay(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return {
      day: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date),
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
    };
  }

  function daysUntil(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    return Math.round((target - startOfToday()) / DAY);
  }

  function render() {
    const from = startOfToday();
    const to = addDays(from, 365);
    events = buildDeadlines(state.profile, isoDate(from), isoDate(to));

    renderCount();
    renderNote();

    els.download.disabled = events.length === 0;

    if (events.length === 0) {
      els.list.innerHTML =
        '<p class="empty"><strong>No dates apply yet.</strong>Check the entity type, add employees or a California seller\'s permit, and deadlines will appear here.</p>';
      return;
    }

    const groups = new Map();
    for (const event of events) {
      const key = event.date.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    }

    let html = "";
    for (const [month, items] of groups) {
      html += `<div class="month"><h3 class="month__head">${escapeHtml(formatMonth(month + "-01"))}</h3><ul class="items">`;
      for (const event of items) {
        html += renderItem(event);
      }
      html += "</ul></div>";
    }
    els.list.innerHTML = html;
  }

  function renderItem(event) {
    const done = Boolean(state.done[event.key]);
    const { day, weekday } = formatDay(event.date);
    const [y, m, d] = event.date.split("-").map(Number);
    const weekdayIndex = new Date(y, m - 1, d).getDay();
    const weekend = weekdayIndex === 0 || weekdayIndex === 6;
    const label = `Mark "${event.title}" on ${day} as done`;
    return `
      <li class="item${done ? " item--done" : ""}">
        <input type="checkbox" id="c-${event.key}" data-key="${escapeHtml(event.key)}"
          ${done ? "checked" : ""} aria-label="${escapeHtml(label)}">
        <label class="item__date" for="c-${event.key}">
          ${escapeHtml(day)}<span>${escapeHtml(weekday)}</span>
        </label>
        <div class="item__body">
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.why)}</p>
          ${
            weekend
              ? '<p class="item__meta">Falls on a weekend. The real due date moves to the next business day.</p>'
              : ""
          }
          <p class="item__meta">
            ${escapeHtml(event.agency)} ·
            <a href="${escapeHtml(event.source)}" target="_blank" rel="noopener noreferrer">Official source</a>
          </p>
        </div>
      </li>`;
  }

  function renderCount() {
    const doneCount = events.filter((e) => state.done[e.key]).length;
    const next = events.find((e) => !state.done[e.key]);
    let text = `${events.length} ${events.length === 1 ? "date" : "dates"} in the next twelve months`;
    if (doneCount) text += ` · ${doneCount} ticked`;
    if (next) {
      const gap = daysUntil(next.date);
      text += gap === 0 ? " · next one is today" : ` · next in ${gap} ${gap === 1 ? "day" : "days"}`;
    }
    els.count.textContent = text;
  }

  function renderNote() {
    const p = state.profile;
    const needsSoi =
      p.state === "CA" && ["llc", "smllc", "ccorp", "scorp"].includes(p.entity);

    if (needsSoi && !p.caMonth) {
      els.note.textContent =
        "Add your registration month above to schedule your California Statement of Information.";
    } else if (p.state === "none") {
      els.note.textContent = "Federal dates only. Switch to California to include state filings.";
    } else {
      els.note.textContent = "";
    }
  }

  function handleChange() {
    state.profile = profileFromForm();
    save();
    syncCaVisibility();
    render();
  }

  function handleTick(event) {
    const input = event.target.closest('input[type="checkbox"][data-key]');
    if (!input) return;
    const key = input.dataset.key;
    if (input.checked) state.done[key] = true;
    else delete state.done[key];
    input.closest(".item").classList.toggle("item--done", input.checked);
    save();
    renderCount();
  }

  function download() {
    if (!events.length) return;
    const calendar = buildICS(events, new Date());
    const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `business-deadlines-${isoDate(startOfToday())}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function init() {
    buildMonthOptions();
    fillForm();
    render();

    els.form.addEventListener("input", handleChange);
    els.form.addEventListener("change", handleChange);
    els.list.addEventListener("change", handleTick);
    els.download.addEventListener("click", download);
    els.print.addEventListener("click", () => window.print());
    els.clear.addEventListener("click", () => {
      state.done = {};
      save();
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
