/*
  Deadline rules for US federal and California.
  Pure data + date logic. No DOM, no network, no dependencies.

  Every rule carries a source URL. Dates are calendar-year assumptions:
  if your fiscal year is not December, treat these as a starting point and
  confirm with your accountant.
*/

const ENTITIES = [
  { id: "sole", label: "Sole proprietor" },
  { id: "smllc", label: "Single-member LLC" },
  { id: "llc", label: "Multi-member LLC" },
  { id: "partnership", label: "Partnership" },
  { id: "scorp", label: "S corporation" },
  { id: "ccorp", label: "C corporation" },
  { id: "nonprofit", label: "Nonprofit" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PASS_THROUGH = ["sole", "smllc", "llc", "partnership", "scorp"];
const CA_TAXABLE = ["smllc", "llc", "partnership", "scorp", "ccorp"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function ymd(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

// m is 1-based. Day 0 of the next month is the last day of this one.
function endOfMonth(y, m) {
  return ymd(y, m, new Date(y, m, 0).getDate());
}

const RULES = [
  {
    id: "fed-941",
    title: "Form 941 — quarterly payroll tax",
    agency: "IRS",
    category: "Payroll",
    why: "Reports federal income tax withheld plus Social Security and Medicare. File even for a zero quarter if you paid wages.",
    source: "https://www.irs.gov/forms-pubs/about-form-941",
    applies: (p) => p.employees > 0,
    dates: (p, y) => [`${y}-04-30`, `${y}-07-31`, `${y}-10-31`, `${y}-01-31`],
  },
  {
    id: "fed-940",
    title: "Form 940 — annual FUTA",
    agency: "IRS",
    category: "Payroll",
    why: "Federal unemployment tax for the prior calendar year. Most small employers get the full credit and owe little, but the return is still due.",
    source: "https://www.irs.gov/forms-pubs/about-form-940",
    applies: (p) => p.employees > 0,
    dates: (p, y) => [`${y}-01-31`],
  },
  {
    id: "fed-w2",
    title: "W-2s to employees and SSA",
    agency: "IRS / SSA",
    category: "Payroll",
    why: "Give each employee their W-2 and file Copy A with the Social Security Administration for the prior year.",
    source: "https://www.irs.gov/forms-pubs/about-form-w-2",
    applies: (p) => p.employees > 0,
    dates: (p, y) => [`${y}-01-31`],
  },
  {
    id: "fed-1099nec",
    title: "1099-NEC to contractors",
    agency: "IRS",
    category: "Payroll",
    why: "Anyone paid $600 or more for services gets a copy. Paper filing to the IRS is also due this day; electronic filing is due March 31.",
    source: "https://www.irs.gov/forms-pubs/about-form-1099-nec",
    applies: (p) => p.contractors === true,
    dates: (p, y) => [`${y}-01-31`],
  },
  {
    id: "fed-est-ind",
    title: "Estimated income tax",
    agency: "IRS",
    category: "Income tax",
    why: "Quarterly payment for owners of pass-through businesses. Underpaying can trigger a penalty even if you file on time.",
    source: "https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes",
    applies: (p) => PASS_THROUGH.includes(p.entity),
    dates: (p, y) => [`${y}-04-15`, `${y}-06-15`, `${y}-09-15`, `${y}-01-15`],
  },
  {
    id: "fed-est-corp",
    title: "Estimated corporate income tax",
    agency: "IRS",
    category: "Income tax",
    why: "Quarterly payment for a C corporation. The fourth installment lands in December, not January.",
    source: "https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes",
    applies: (p) => p.entity === "ccorp",
    dates: (p, y) => [`${y}-04-15`, `${y}-06-15`, `${y}-09-15`, `${y}-12-15`],
  },
  {
    id: "fed-1065",
    title: "Form 1065 — partnership return",
    agency: "IRS",
    category: "Income tax",
    why: "Information return for multi-member LLCs and partnerships. K-1s go to the owners so they can file their own returns.",
    source: "https://www.irs.gov/forms-pubs/about-form-1065",
    applies: (p) => ["llc", "partnership"].includes(p.entity),
    dates: (p, y) => [`${y}-03-15`],
  },
  {
    id: "fed-1065-ext",
    title: "Form 1065 extension deadline",
    agency: "IRS",
    category: "Income tax",
    why: "Last day to file a partnership return on a timely extension (Form 7004).",
    source: "https://www.irs.gov/forms-pubs/about-form-7004",
    applies: (p) => ["llc", "partnership"].includes(p.entity),
    dates: (p, y) => [`${y}-09-15`],
  },
  {
    id: "fed-1120s",
    title: "Form 1120-S — S corporation return",
    agency: "IRS",
    category: "Income tax",
    why: "Information return for the S election. K-1s go to shareholders.",
    source: "https://www.irs.gov/forms-pubs/about-form-1120-s",
    applies: (p) => p.entity === "scorp",
    dates: (p, y) => [`${y}-03-15`],
  },
  {
    id: "fed-1120s-ext",
    title: "Form 1120-S extension deadline",
    agency: "IRS",
    category: "Income tax",
    why: "Last day to file an S corporation return on a timely extension.",
    source: "https://www.irs.gov/forms-pubs/about-form-7004",
    applies: (p) => p.entity === "scorp",
    dates: (p, y) => [`${y}-09-15`],
  },
  {
    id: "fed-1120",
    title: "Form 1120 — C corporation return",
    agency: "IRS",
    category: "Income tax",
    why: "Annual corporate income tax return for the prior year.",
    source: "https://www.irs.gov/forms-pubs/about-form-1120",
    applies: (p) => p.entity === "ccorp",
    dates: (p, y) => [`${y}-04-15`],
  },
  {
    id: "fed-1120-ext",
    title: "Form 1120 extension deadline",
    agency: "IRS",
    category: "Income tax",
    why: "Last day to file a C corporation return on a timely extension.",
    source: "https://www.irs.gov/forms-pubs/about-form-7004",
    applies: (p) => p.entity === "ccorp",
    dates: (p, y) => [`${y}-10-15`],
  },
  {
    id: "fed-1040",
    title: "Form 1040 — personal return",
    agency: "IRS",
    category: "Income tax",
    why: "Sole proprietors and single-member LLCs report business income on Schedule C with the owner's personal return.",
    source: "https://www.irs.gov/forms-pubs/about-form-1040",
    applies: (p) => ["sole", "smllc"].includes(p.entity),
    dates: (p, y) => [`${y}-04-15`],
  },
  {
    id: "fed-1040-ext",
    title: "Form 1040 extension deadline",
    agency: "IRS",
    category: "Income tax",
    why: "Last day to file a personal return on a timely extension. The extension is to file, not to pay.",
    source: "https://www.irs.gov/forms-pubs/about-form-4868",
    applies: (p) => ["sole", "smllc"].includes(p.entity),
    dates: (p, y) => [`${y}-10-15`],
  },
  {
    id: "fed-990",
    title: "Form 990 series — nonprofit return",
    agency: "IRS",
    category: "Income tax",
    why: "Annual information return. Which 990 version applies depends on gross receipts and assets.",
    source: "https://www.irs.gov/charities-non-profits/return-due-dates-for-exempt-organizations-annual-return",
    applies: (p) => p.entity === "nonprofit",
    dates: (p, y) => [`${y}-05-15`],
  },
  {
    id: "fed-990-ext",
    title: "Form 990 extension deadline",
    agency: "IRS",
    category: "Income tax",
    why: "Last day to file a nonprofit return on a timely extension.",
    source: "https://www.irs.gov/forms-pubs/about-form-8868",
    applies: (p) => p.entity === "nonprofit",
    dates: (p, y) => [`${y}-11-15`],
  },
  {
    id: "fed-osha",
    title: "Post OSHA Form 300A",
    agency: "OSHA",
    category: "Workplace",
    why: "Post the annual summary of work-related injuries from February 1 through April 30. Required for most employers with 11 or more employees.",
    source: "https://www.osha.gov/recordkeeping",
    applies: (p) => p.employees >= 11,
    dates: (p, y) => [`${y}-02-01`],
  },
  {
    id: "ca-de9",
    title: "DE 9 and DE 9C — quarterly payroll",
    agency: "CA EDD",
    category: "Payroll",
    why: "California payroll tax return and wage report. The nominal due date is the first of the month; penalties start a month later. File even for a zero quarter if you are registered as an employer.",
    source: "https://edd.ca.gov/en/payroll_taxes/Due_Dates_Calendar",
    applies: (p) => p.state === "CA" && p.employees > 0,
    dates: (p, y) => [`${y}-01-01`, `${y}-04-01`, `${y}-07-01`, `${y}-10-01`],
  },
  {
    id: "ca-sales",
    title: "Sales and use tax return",
    agency: "CA CDTFA",
    category: "Sales tax",
    why: "Quarterly return and payment for a calendar-quarter account. Larger accounts are on a monthly or prepayment schedule.",
    source: "https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-returns-filing-dates.htm",
    applies: (p) => p.state === "CA" && p.salesTax === true,
    dates: (p, y) => [`${y}-04-30`, `${y}-07-31`, `${y}-10-31`, `${y}-01-31`],
  },
  {
    id: "ca-ftb",
    title: "California annual tax or franchise tax",
    agency: "CA FTB",
    category: "California",
    why: "The $800 minimum annual tax for LLCs, corporations and partnerships, generally due the 15th day of the fourth month of the tax year.",
    source: "https://www.ftb.ca.gov/file/when-to-file/due-dates-business.html",
    applies: (p) => p.state === "CA" && CA_TAXABLE.includes(p.entity),
    dates: (p, y) => [`${y}-04-15`],
  },
  {
    id: "ca-soi-llc",
    title: "Statement of Information — LLC",
    agency: "CA Secretary of State",
    category: "California",
    why: "Biennial filing due by the end of your registration anniversary month, in even or odd years matching your registration year.",
    source: "https://www.sos.ca.gov/business-programs/business-entities/statements",
    applies: (p) =>
      p.state === "CA" &&
      ["llc", "smllc"].includes(p.entity) &&
      p.caMonth >= 1 &&
      p.caYear >= 1900,
    dates: (p, y) => {
      if (Math.abs(y - p.caYear) % 2 !== 0) return [];
      return [endOfMonth(y, p.caMonth)];
    },
  },
  {
    id: "ca-soi-corp",
    title: "Statement of Information — corporation",
    agency: "CA Secretary of State",
    category: "California",
    why: "Annual filing due by the end of your registration anniversary month.",
    source: "https://www.sos.ca.gov/business-programs/business-entities/statements",
    applies: (p) =>
      p.state === "CA" &&
      ["ccorp", "scorp"].includes(p.entity) &&
      p.caMonth >= 1,
    dates: (p, y) => [endOfMonth(y, p.caMonth)],
  },
  {
    id: "ca-minwage",
    title: "California minimum wage changes",
    agency: "CA DIR",
    category: "Workplace",
    why: "Statewide minimum wage adjusts January 1. Some cities set a higher local rate, so check your city too.",
    source: "https://www.dir.ca.gov/dlse/faq_minimumwage.htm",
    applies: (p) => p.state === "CA" && p.employees > 0,
    dates: (p, y) => [`${y}-01-01`],
  },
  {
    id: "ca-paydata",
    title: "Pay data reporting",
    agency: "CA Civil Rights Dept.",
    category: "Workplace",
    why: "Annual pay and hours report by establishment. Required for employers with 100 or more employees.",
    source: "https://calcivilrights.ca.gov/paydatareporting/",
    applies: (p) => p.state === "CA" && p.employees >= 100,
    dates: (p, y) => [`${y}-05-10`],
  },
];

function buildDeadlines(profile, fromISO, toISO) {
  const start = new Date(`${fromISO}T00:00:00`);
  const end = new Date(`${toISO}T00:00:00`);
  const seen = new Set();
  const out = [];

  for (const rule of RULES) {
    if (!rule.applies(profile)) continue;
    for (let y = start.getFullYear() - 1; y <= end.getFullYear() + 1; y++) {
      for (const date of rule.dates(profile, y)) {
        const at = new Date(`${date}T00:00:00`);
        if (at < start || at > end) continue;
        const key = `${rule.id}@${date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          key,
          id: rule.id,
          date,
          title: rule.title,
          agency: rule.agency,
          category: rule.category,
          why: rule.why,
          source: rule.source,
        });
      }
    }
  }

  out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return out;
}

if (typeof module !== "undefined") {
  module.exports = { ENTITIES, MONTHS, RULES, buildDeadlines, endOfMonth };
}
