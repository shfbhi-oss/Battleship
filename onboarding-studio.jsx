import React, { useState, useEffect, useMemo } from "react";

/*
  Bookkeeping Client Onboarding Studio
  ------------------------------------
  Single-file React artifact. Enter a client once; auto-generate every
  standard onboarding document pre-filled with the client's data and the
  provider's business profile.

  Hard constraints (see handoff):
  - All custom styling lives in the CSS string below and is injected via a
    <style> element. The artifact runtime only supports Tailwind *core*
    utilities, so do NOT use Tailwind arbitrary values (e.g. bg-[#hex]).
    Extend the CSS string instead.
  - Persistence uses window.storage (the artifact key-value API), NOT
    localStorage. Falls back to in-memory state (with a visible warning)
    when window.storage is unavailable.
  - The operator is a finance professional, NOT a CPA. Keep tax
    prep/filing, audit/assurance, and financial/legal advice OUT of any
    generated scope. Preserve the no-password / no-raw-account-number
    safeguards in the access + payment authorizations.
*/

/* ------------------------------------------------------------------ */
/* Persistence: window.storage key-value API (per-user, shared=false)  */
/* ------------------------------------------------------------------ */

const CLIENTS_KEY = "bk_clients_v2";
const SETTINGS_KEY = "bk_settings_v2";

const STORE =
  typeof window !== "undefined" && window.storage ? window.storage : null;

async function loadKey(key) {
  if (!STORE) return null;
  try {
    return await STORE.getItem(key, { shared: false });
  } catch (e) {
    try {
      return await STORE.getItem(key);
    } catch (e2) {
      return null;
    }
  }
}

async function saveKey(key, value) {
  if (!STORE) return;
  try {
    await STORE.setItem(key, value, { shared: false });
  } catch (e) {
    try {
      await STORE.setItem(key, value);
    } catch (e2) {
      /* swallow — in-memory state still holds the data this session */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const SERVICES = [
  { key: "monthly_bookkeeping", label: "Monthly Bookkeeping & Reconciliation" },
  { key: "catchup_cleanup", label: "Catch-Up / Cleanup Bookkeeping" },
  { key: "ap_management", label: "Accounts Payable / Bill Pay" },
  { key: "ar_invoicing", label: "Accounts Receivable / Invoicing" },
  { key: "payroll_support", label: "Payroll Processing Support" },
  { key: "financial_reporting", label: "Monthly Financial Reporting" },
  { key: "expense_management", label: "Expense Categorization & Receipt Capture" },
  { key: "vendor_1099", label: "1099 Vendor Tracking" },
  { key: "budgeting", label: "Budgeting & Cash-Flow Tracking" },
  { key: "checkins", label: "Monthly Check-In Meetings" },
];

const ONBOARDING_TASKS = [
  { key: "engagement_signed", label: "Engagement letter signed" },
  { key: "payment_setup", label: "Payment authorization on file" },
  { key: "software_access", label: "Accounting software access granted" },
  { key: "bank_access", label: "Bank feed / read-only access connected" },
  { key: "cc_access", label: "Credit card feed connected" },
  { key: "payroll_access", label: "Payroll system access (if applicable)" },
  { key: "docs_received", label: "Onboarding documents received" },
  { key: "chart_of_accounts", label: "Chart of accounts reviewed" },
  { key: "opening_balances", label: "Opening balances entered" },
  { key: "kickoff_call", label: "Kickoff call completed" },
];

const ENTITY_TYPES = [
  "Sole Proprietor",
  "Single-Member LLC",
  "Multi-Member LLC",
  "S-Corporation",
  "C-Corporation",
  "Partnership",
  "Nonprofit",
];

const SOFTWARE = [
  "QuickBooks Online",
  "QuickBooks Desktop",
  "Xero",
  "Wave",
  "FreshBooks",
  "Sage",
  "Spreadsheet / None",
  "Other",
];

const STATUSES = ["Lead", "Onboarding", "Active", "Paused"];

/* ------------------------------------------------------------------ */
/* Blank records                                                       */
/* ------------------------------------------------------------------ */

function uid() {
  return (
    "c_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

function blankClient() {
  const tasks = {};
  ONBOARDING_TASKS.forEach((t) => (tasks[t.key] = false));
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    // Business
    legalName: "",
    dba: "",
    entityType: "",
    ein: "",
    stateFormed: "",
    dateEstablished: "",
    industry: "",
    naics: "",
    // Contact
    contactName: "",
    contactTitle: "",
    email: "",
    phone: "",
    preferredContact: "Email",
    // Address
    street: "",
    city: "",
    state: "",
    zip: "",
    // Financial
    fiscalYearEnd: "December 31",
    basis: "Cash",
    software: "",
    bankAccounts: "",
    ccAccounts: "",
    monthlyVolume: "",
    hasPayroll: false,
    payrollProvider: "",
    cleanupMonths: "",
    // Engagement
    services: [],
    frequency: "Monthly",
    fee: "",
    billing: "Monthly",
    startDate: "",
    status: "Lead",
    notes: "",
    // Tracking
    tasks,
  };
}

function blankSettings() {
  return {
    businessName: "",
    ownerName: "",
    title: "Owner & Bookkeeper",
    email: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    website: "",
    governingState: "Missouri",
    defaultFee: "",
  };
}

/* ------------------------------------------------------------------ */
/* Helpers for document generation                                     */
/* ------------------------------------------------------------------ */

// Returns the value or a bracketed placeholder so unfinished fields are obvious.
function v(value, placeholder) {
  const s = (value == null ? "" : String(value)).trim();
  return s ? s : `[${placeholder}]`;
}

function todayLong() {
  try {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function clientDisplayName(c) {
  const name = (c.dba || c.legalName || "").trim();
  return name || "Untitled Client";
}

function providerLine(s) {
  return v(s.businessName, "Your Business Name");
}

function fullAddress(street, city, state, zip) {
  const line1 = (street || "").trim();
  const cityState = [city, state].filter(Boolean).join(", ");
  const line2 = [cityState, zip].filter(Boolean).join(" ").trim();
  const parts = [line1, line2].filter(Boolean);
  return parts.length ? parts.join("\n") : "[Address on file]";
}

function selectedServices(c) {
  return SERVICES.filter((s) => c.services.includes(s.key));
}

function bulletList(items) {
  return items.map((i) => `  • ${i}`).join("\n");
}

/* ------------------------------------------------------------------ */
/* Document generators: (client, settings) => string                   */
/* ------------------------------------------------------------------ */

function genEngagement(c, s) {
  const provider = providerLine(s);
  const services = selectedServices(c);
  const scope = services.length
    ? bulletList(services.map((x) => x.label))
    : "  • [No services selected yet — choose services on the client form]";

  const fee = v(c.fee || s.defaultFee, "Monthly Fee");
  const billing = v(c.billing, "Billing Frequency");
  const governing = v(s.governingState, "Governing State");

  return `ENGAGEMENT LETTER & BOOKKEEPING SERVICE AGREEMENT

Date: ${todayLong()}

Between:
  Provider:  ${provider}
             ${v(s.ownerName, "Owner Name")}, ${v(s.title, "Title")}
             ${fullAddress(s.street, s.city, s.state, s.zip).replace(/\n/g, "\n             ")}
             ${v(s.email, "Provider Email")} | ${v(s.phone, "Provider Phone")}

  Client:    ${v(c.legalName, "Client Legal Name")}${c.dba ? ` (DBA "${c.dba}")` : ""}
             ${v(c.entityType, "Entity Type")}
             ${fullAddress(c.street, c.city, c.state, c.zip).replace(/\n/g, "\n             ")}
             Attn: ${v(c.contactName, "Contact Name")}, ${v(c.contactTitle, "Title")}

This letter confirms the terms under which ${provider} ("we," "us") will
provide bookkeeping services to ${v(c.legalName, "Client Legal Name")} ("you,"
"the Client").

1. SCOPE OF SERVICES
We will provide the following bookkeeping services:
${scope}

Accounting basis: ${v(c.basis, "Cash/Accrual")}.
Reporting frequency: ${v(c.frequency, "Frequency")}.
Primary accounting software: ${v(c.software, "Software")}.

2. SERVICES NOT INCLUDED
The following are expressly OUTSIDE the scope of this engagement. We do not
provide, and you should not rely on us for:
  • Tax preparation, tax filing, or tax return positions
  • Audit, review, or any other assurance or attestation service
  • Financial, investment, or legal advice
  • Representation before any taxing authority

We are a professional bookkeeping service and are NOT a Certified Public
Accountant (CPA) firm. For tax filing, assurance, or advisory matters, we
recommend you engage a licensed CPA, Enrolled Agent, or attorney. We are
happy to coordinate with your tax professional and provide them with clean,
reconciled books.

3. CLIENT RESPONSIBILITIES
You are responsible for the accuracy and completeness of the information and
source documents you provide, for the safeguarding of assets, and for all
management decisions. You will provide timely access to records and respond
to our requests for clarification.

4. FEES & BILLING
Fee: ${fee}, billed ${billing}.
Invoices are due upon receipt unless otherwise agreed. Recurring payment is
authorized separately via the Payment Authorization form.

5. TERM & TERMINATION
This engagement begins on ${v(c.startDate, "Start Date")} and continues until
terminated by either party with thirty (30) days' written notice. Upon
termination, we will provide your books and records in a standard exportable
format.

6. CONFIDENTIALITY
We will keep your financial information confidential and will not disclose it
except as required to perform the services or as required by law.

7. GOVERNING LAW
This agreement is governed by the laws of the State of ${governing}.

8. ACCEPTANCE
By signing below, both parties agree to the terms above.

Client: ______________________________   Date: ______________
        ${v(c.contactName, "Contact Name")}, ${v(c.contactTitle, "Title")}

Provider: ____________________________   Date: ______________
        ${v(s.ownerName, "Owner Name")}, ${provider}

Note: This is a working template, not legal advice. Have an attorney review
this agreement before relying on it.`;
}

function genIntakeSummary(c, s) {
  const services = selectedServices(c);
  const serviceList = services.length
    ? bulletList(services.map((x) => x.label))
    : "  • [None selected]";

  return `CLIENT INTAKE SUMMARY (INTERNAL)

Prepared by: ${providerLine(s)}
Generated:   ${todayLong()}
Client ID:   ${c.id}
Status:      ${v(c.status, "Status")}

── BUSINESS ──
Legal name:        ${v(c.legalName, "Legal Name")}
DBA:               ${v(c.dba, "n/a")}
Entity type:       ${v(c.entityType, "Entity Type")}
EIN:               ${v(c.ein, "EIN")}
State formed:      ${v(c.stateFormed, "State")}
Date established:  ${v(c.dateEstablished, "Date")}
Industry:          ${v(c.industry, "Industry")}
NAICS:             ${v(c.naics, "NAICS")}

── CONTACT ──
Primary contact:   ${v(c.contactName, "Name")}, ${v(c.contactTitle, "Title")}
Email:             ${v(c.email, "Email")}
Phone:             ${v(c.phone, "Phone")}
Preferred contact: ${v(c.preferredContact, "Method")}
Address:           ${fullAddress(c.street, c.city, c.state, c.zip).replace(/\n/g, "\n                   ")}

── FINANCIAL PROFILE ──
Fiscal year end:   ${v(c.fiscalYearEnd, "FYE")}
Accounting basis:  ${v(c.basis, "Cash/Accrual")}
Software:          ${v(c.software, "Software")}
Bank accounts:     ${v(c.bankAccounts, "0")}
Credit cards:      ${v(c.ccAccounts, "0")}
Monthly txn vol.:  ${v(c.monthlyVolume, "Unknown")}
Payroll:           ${c.hasPayroll ? "Yes — " + v(c.payrollProvider, "Provider") : "No"}
Cleanup needed:    ${c.cleanupMonths ? c.cleanupMonths + " month(s)" : "None / TBD"}

── ENGAGEMENT ──
Services:
${serviceList}
Frequency:         ${v(c.frequency, "Frequency")}
Fee:               ${v(c.fee || s.defaultFee, "Fee")}
Billing:           ${v(c.billing, "Billing")}
Start date:        ${v(c.startDate, "Start Date")}

── NOTES ──
${c.notes ? c.notes : "[No notes]"}`;
}

function genDocChecklist(c, s) {
  const items = [
    "Most recent business tax return (for reference / opening balances)",
    "Articles of organization / incorporation (or formation documents)",
    "EIN confirmation letter (IRS CP-575 or equivalent)",
    "Chart of accounts export (if you have existing books)",
    "Most recent financial statements (P&L and Balance Sheet, if available)",
  ];

  const banks = parseInt(c.bankAccounts, 10);
  if (banks > 0) {
    items.push(
      `Last 3 months of statements for each business bank account (${banks} account${
        banks === 1 ? "" : "s"
      })`
    );
  } else {
    items.push("Last 3 months of statements for each business bank account");
  }

  const cards = parseInt(c.ccAccounts, 10);
  if (cards > 0) {
    items.push(
      `Last 3 months of statements for each business credit card (${cards} card${
        cards === 1 ? "" : "s"
      })`
    );
  } else {
    items.push("Last 3 months of statements for each business credit card");
  }

  items.push("List of outstanding invoices owed to you (A/R)");
  items.push("List of unpaid bills you owe (A/P)");
  items.push("List of recurring vendors and subscriptions");

  if (c.hasPayroll) {
    items.push(
      `Payroll reports for the current year (provider: ${v(
        c.payrollProvider,
        "Payroll Provider"
      )})`
    );
    items.push("Most recent payroll tax filings (940/941, state)");
  }

  if (c.cleanupMonths) {
    items.push(
      `Records covering the ${c.cleanupMonths}-month cleanup period`
    );
  }

  return `WELCOME — DOCUMENT REQUEST CHECKLIST

To: ${v(c.contactName, "Contact Name")}
From: ${providerLine(s)}
Date: ${todayLong()}

Hi ${v((c.contactName || "").split(" ")[0], "there")},

Welcome aboard! To get ${clientDisplayName(c)} set up quickly and accurately,
please gather the items below. You can send them by your preferred secure
method — do not email full account numbers or passwords.

DOCUMENTS TO PROVIDE:
${bulletList(items)}

A FEW NOTES:
  • If you don't have something on this list, just let me know — we'll
    work around it.
  • Send statements as PDFs or grant read-only access (see the Access
    Authorization form) rather than sharing login credentials.
  • Reach me at ${v(s.email, "Provider Email")} or ${v(
    s.phone,
    "Provider Phone"
  )} with any questions.

Looking forward to working with you.

${v(s.ownerName, "Owner Name")}
${v(s.title, "Title")}, ${providerLine(s)}`;
}

function genAccessAuth(c, s) {
  return `SOFTWARE & FINANCIAL ACCOUNT ACCESS AUTHORIZATION

Client: ${v(c.legalName, "Client Legal Name")}${c.dba ? ` (DBA "${c.dba}")` : ""}
Provider: ${providerLine(s)}
Date: ${todayLong()}

This form authorizes ${providerLine(s)} to access the systems below for the
sole purpose of performing the agreed bookkeeping services.

1. ACCOUNTING SOFTWARE
Software: ${v(c.software, "Software")}
Access method: Add ${v(s.email, "Provider Email")} as an accountant/
collaborator user with the appropriate role. Do NOT share your master
login.

2. BANK & CREDIT CARD FEEDS
We request READ-ONLY connections (bank feeds) or read-only viewer access so
transactions flow automatically into ${v(c.software, "your accounting software")}.
  • Business bank accounts to connect: ${v(c.bankAccounts, "0")}
  • Business credit cards to connect:  ${v(c.ccAccounts, "0")}

3. PAYROLL (IF APPLICABLE)
${
    c.hasPayroll
      ? `Payroll provider: ${v(
          c.payrollProvider,
          "Provider"
        )}. Please add us as a reports-only / accountant user.`
      : "No payroll access requested at this time."
  }

IMPORTANT SECURITY NOTES — PLEASE READ:
  • NEVER send us your passwords. We will never ask for them.
  • NEVER send full bank or credit card account numbers by email or text.
  • Use each platform's built-in "invite accountant" / "add user" feature
    or a read-only bank feed. This keeps your credentials private and is
    revocable by you at any time.
  • You may revoke any access at any time by removing our user account.

Authorized by:

______________________________   Date: ______________
${v(c.contactName, "Contact Name")}, ${v(c.contactTitle, "Title")}
${v(c.legalName, "Client Legal Name")}`;
}

function genPaymentAuth(c, s) {
  const fee = v(c.fee || s.defaultFee, "Monthly Fee");
  const billing = v(c.billing, "Billing Frequency");
  return `RECURRING PAYMENT AUTHORIZATION

Client: ${v(c.legalName, "Client Legal Name")}${c.dba ? ` (DBA "${c.dba}")` : ""}
Provider: ${providerLine(s)}
Date: ${todayLong()}

I authorize ${providerLine(s)} to charge the payment method on file for
bookkeeping services per the signed Engagement Letter.

  Amount:     ${fee}
  Frequency:  ${billing}
  Start date: ${v(c.startDate, "Start Date")}

PAYMENT METHOD (set up through our secure, PCI-compliant payment processor):
  [ ] ACH / bank transfer
  [ ] Credit / debit card

HOW PAYMENT DETAILS ARE COLLECTED:
  • You will receive a secure link from our payment processor (e.g.
    Stripe, Bill.com, or QuickBooks Payments) to enter your details.
  • Do NOT write your full card or bank account number on this form or
    send it by email or text. We do not store raw account numbers.

TERMS:
  • Charges recur per the frequency above until this authorization is
    cancelled in writing with at least 10 days' notice before the next
    billing date.
  • You will be notified of any fee change at least 30 days in advance.

Authorized by:

______________________________   Date: ______________
${v(c.contactName, "Contact Name")}, ${v(c.contactTitle, "Title")}
${v(c.legalName, "Client Legal Name")}`;
}

const DOCS = [
  {
    key: "engagement",
    title: "Engagement Letter",
    file: "engagement-letter",
    gen: genEngagement,
  },
  {
    key: "intake",
    title: "Intake Summary (Internal)",
    file: "intake-summary",
    gen: genIntakeSummary,
  },
  {
    key: "checklist",
    title: "Document Request Checklist",
    file: "document-checklist",
    gen: genDocChecklist,
  },
  {
    key: "access",
    title: "Access Authorization",
    file: "access-authorization",
    gen: genAccessAuth,
  },
  {
    key: "payment",
    title: "Payment Authorization",
    file: "payment-authorization",
    gen: genPaymentAuth,
  },
];

/* ------------------------------------------------------------------ */
/* Clipboard + download utilities                                      */
/* ------------------------------------------------------------------ */

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* fall through to execCommand */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

function downloadText(filename, text) {
  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    /* no-op */
  }
}

function slugify(str) {
  return (str || "client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function FieldGroup({ title, hint, children }) {
  return (
    <section className="fgroup">
      <div className="fgroup-head">
        <h3>{title}</h3>
        {hint ? <p className="fgroup-hint">{hint}</p> : null}
      </div>
      <div className="fgroup-body">{children}</div>
    </section>
  );
}

function Row({ children, cols }) {
  return <div className={`row row-${cols || children.length || 1}`}>{children}</div>;
}

function Field({ label, value, onChange, type, placeholder, required, mono }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required ? <span className="req"> *</span> : null}
      </span>
      <input
        className={"input" + (mono ? " mono" : "")}
        type={type || "text"}
        value={value || ""}
        placeholder={placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Select({ label, value, onChange, options, placeholder }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        className="input"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder || "Select…"}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows }) {
  return (
    <label className="field field-full">
      <span className="field-label">{label}</span>
      <textarea
        className="input textarea"
        rows={rows || 4}
        value={value || ""}
        placeholder={placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function progressFor(client) {
  const total = ONBOARDING_TASKS.length;
  const done = ONBOARDING_TASKS.reduce(
    (n, t) => n + (client.tasks && client.tasks[t.key] ? 1 : 0),
    0
  );
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function statusClass(status) {
  switch (status) {
    case "Lead":
      return "st-lead";
    case "Onboarding":
      return "st-onboarding";
    case "Active":
      return "st-active";
    case "Paused":
      return "st-paused";
    default:
      return "st-lead";
  }
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function Clients({ clients, onNew, onOpen, onSettings, settingsReady }) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c = { All: clients.length };
    STATUSES.forEach((s) => (c[s] = 0));
    clients.forEach((cl) => {
      c[cl.status] = (c[cl.status] || 0) + 1;
    });
    return c;
  }, [clients]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => (filter === "All" ? true : c.status === filter))
      .filter((c) => {
        if (!q) return true;
        return (
          (c.legalName || "").toLowerCase().includes(q) ||
          (c.dba || "").toLowerCase().includes(q) ||
          (c.contactName || "").toLowerCase().includes(q) ||
          (c.industry || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [clients, filter, query]);

  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">‾≡</div>
          <div>
            <h1>Onboarding Studio</h1>
            <p className="sub">Enter a client once. Generate every form.</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={onSettings}>
            {settingsReady ? "Business Profile" : "Set Up Profile"}
          </button>
          <button className="btn primary" onClick={onNew}>
            + New Client
          </button>
        </div>
      </header>

      {!settingsReady ? (
        <div className="callout">
          Set up your <strong>Business Profile</strong> first so generated
          documents are pre-filled with your details.
          <button className="link-btn" onClick={onSettings}>
            Set it up now →
          </button>
        </div>
      ) : null}

      <div className="toolbar">
        <div className="chips">
          {["All", ...STATUSES].map((s) => (
            <button
              key={s}
              className={"chip" + (filter === s ? " active" : "")}
              onClick={() => setFilter(s)}
            >
              {s} <span className="chip-count">{counts[s] || 0}</span>
            </button>
          ))}
        </div>
        <input
          className="search"
          placeholder="Search clients…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <div className="empty-mark">≡</div>
          <h2>No clients yet</h2>
          <p>Add your first client to start generating onboarding forms.</p>
          <button className="btn primary" onClick={onNew}>
            + New Client
          </button>
        </div>
      ) : (
        <div className="grid">
          {visible.map((c) => {
            const p = progressFor(c);
            return (
              <button
                key={c.id}
                className="card"
                onClick={() => onOpen(c.id)}
              >
                <div className="card-head">
                  <div>
                    <h3>{clientDisplayName(c)}</h3>
                    <p className="card-sub">
                      {c.entityType || "—"}
                      {c.industry ? " · " + c.industry : ""}
                    </p>
                  </div>
                  <span className={"badge " + statusClass(c.status)}>
                    {c.status}
                  </span>
                </div>
                <div className="card-meta">
                  <span className="mono">{c.contactName || "No contact"}</span>
                  {c.fee ? <span className="mono">{c.fee}</span> : null}
                </div>
                <div className="progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: p.pct + "%" }}
                    />
                  </div>
                  <span className="progress-label mono">
                    {p.done}/{p.total}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientForm({ initial, settings, onSave, onCancel, onDelete }) {
  const [c, setC] = useState(initial);
  const set = (k) => (val) => setC((prev) => ({ ...prev, [k]: val }));

  const toggleService = (key) => {
    setC((prev) => {
      const has = prev.services.includes(key);
      return {
        ...prev,
        services: has
          ? prev.services.filter((s) => s !== key)
          : [...prev.services, key],
      };
    });
  };

  const isEdit = Boolean(initial && initial.legalName);

  return (
    <div className="form-page">
      <header className="topbar">
        <div className="brand">
          <button className="btn ghost back" onClick={onCancel}>
            ← Back
          </button>
          <div>
            <h1>{isEdit ? "Edit Client" : "New Client"}</h1>
            <p className="sub">Fill what you have now; finish later.</p>
          </div>
        </div>
        <div className="top-actions">
          {onDelete ? (
            <button className="btn danger" onClick={onDelete}>
              Delete
            </button>
          ) : null}
          <button
            className="btn primary"
            onClick={() => onSave(c)}
            disabled={!c.legalName.trim()}
          >
            Save Client
          </button>
        </div>
      </header>

      <FieldGroup title="Business" hint="Legal name is required.">
        <Row cols={2}>
          <Field
            label="Legal name"
            value={c.legalName}
            onChange={set("legalName")}
            required
            placeholder="Acme Holdings LLC"
          />
          <Field
            label="DBA / trade name"
            value={c.dba}
            onChange={set("dba")}
            placeholder="Acme"
          />
        </Row>
        <Row cols={3}>
          <Select
            label="Entity type"
            value={c.entityType}
            onChange={set("entityType")}
            options={ENTITY_TYPES}
          />
          <Field
            label="EIN"
            value={c.ein}
            onChange={set("ein")}
            placeholder="12-3456789"
            mono
          />
          <Field
            label="State formed"
            value={c.stateFormed}
            onChange={set("stateFormed")}
            placeholder="Missouri"
          />
        </Row>
        <Row cols={3}>
          <Field
            label="Date established"
            value={c.dateEstablished}
            onChange={set("dateEstablished")}
            type="date"
            mono
          />
          <Field
            label="Industry"
            value={c.industry}
            onChange={set("industry")}
            placeholder="Retail"
          />
          <Field
            label="NAICS"
            value={c.naics}
            onChange={set("naics")}
            placeholder="453998"
            mono
          />
        </Row>
      </FieldGroup>

      <FieldGroup title="Primary Contact">
        <Row cols={2}>
          <Field
            label="Contact name"
            value={c.contactName}
            onChange={set("contactName")}
            placeholder="Jane Doe"
          />
          <Field
            label="Title"
            value={c.contactTitle}
            onChange={set("contactTitle")}
            placeholder="Owner"
          />
        </Row>
        <Row cols={3}>
          <Field
            label="Email"
            value={c.email}
            onChange={set("email")}
            type="email"
            placeholder="jane@acme.com"
            mono
          />
          <Field
            label="Phone"
            value={c.phone}
            onChange={set("phone")}
            placeholder="(555) 123-4567"
            mono
          />
          <Select
            label="Preferred contact"
            value={c.preferredContact}
            onChange={set("preferredContact")}
            options={["Email", "Phone", "Text"]}
          />
        </Row>
      </FieldGroup>

      <FieldGroup title="Address">
        <Row cols={1}>
          <Field
            label="Street"
            value={c.street}
            onChange={set("street")}
            placeholder="123 Main St"
          />
        </Row>
        <Row cols={3}>
          <Field label="City" value={c.city} onChange={set("city")} />
          <Field label="State" value={c.state} onChange={set("state")} />
          <Field label="ZIP" value={c.zip} onChange={set("zip")} mono />
        </Row>
      </FieldGroup>

      <FieldGroup title="Financial Profile">
        <Row cols={3}>
          <Field
            label="Fiscal year end"
            value={c.fiscalYearEnd}
            onChange={set("fiscalYearEnd")}
            placeholder="December 31"
          />
          <Select
            label="Accounting basis"
            value={c.basis}
            onChange={set("basis")}
            options={["Cash", "Accrual"]}
          />
          <Select
            label="Software"
            value={c.software}
            onChange={set("software")}
            options={SOFTWARE}
          />
        </Row>
        <Row cols={3}>
          <Field
            label="# Bank accounts"
            value={c.bankAccounts}
            onChange={set("bankAccounts")}
            type="number"
            mono
          />
          <Field
            label="# Credit cards"
            value={c.ccAccounts}
            onChange={set("ccAccounts")}
            type="number"
            mono
          />
          <Field
            label="Monthly txn volume"
            value={c.monthlyVolume}
            onChange={set("monthlyVolume")}
            placeholder="~150"
            mono
          />
        </Row>
        <Row cols={3}>
          <label className="field check-field">
            <span className="field-label">Has payroll?</span>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={c.hasPayroll}
                onChange={(e) => set("hasPayroll")(e.target.checked)}
              />
              <span>Client runs payroll</span>
            </label>
          </label>
          <Field
            label="Payroll provider"
            value={c.payrollProvider}
            onChange={set("payrollProvider")}
            placeholder="Gusto"
          />
          <Field
            label="Cleanup months"
            value={c.cleanupMonths}
            onChange={set("cleanupMonths")}
            type="number"
            placeholder="0"
            mono
          />
        </Row>
      </FieldGroup>

      <FieldGroup
        title="Engagement"
        hint="Selected services drive the engagement letter scope."
      >
        <div className="services">
          {SERVICES.map((s) => (
            <label
              key={s.key}
              className={
                "service-chip" +
                (c.services.includes(s.key) ? " selected" : "")
              }
            >
              <input
                type="checkbox"
                checked={c.services.includes(s.key)}
                onChange={() => toggleService(s.key)}
              />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
        <Row cols={3}>
          <Select
            label="Frequency"
            value={c.frequency}
            onChange={set("frequency")}
            options={["Weekly", "Monthly", "Quarterly"]}
          />
          <Field
            label="Fee"
            value={c.fee}
            onChange={set("fee")}
            placeholder={settings.defaultFee || "$500 / mo"}
            mono
          />
          <Select
            label="Billing"
            value={c.billing}
            onChange={set("billing")}
            options={["Monthly", "Quarterly", "Per project"]}
          />
        </Row>
        <Row cols={2}>
          <Field
            label="Start date"
            value={c.startDate}
            onChange={set("startDate")}
            type="date"
            mono
          />
          <Select
            label="Status"
            value={c.status}
            onChange={set("status")}
            options={STATUSES}
          />
        </Row>
        <TextArea
          label="Notes"
          value={c.notes}
          onChange={set("notes")}
          placeholder="Internal notes…"
        />
      </FieldGroup>

      <div className="form-footer">
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={() => onSave(c)}
          disabled={!c.legalName.trim()}
        >
          Save Client
        </button>
      </div>
    </div>
  );
}

function Detail({ client, settings, onEdit, onBack, onToggleTask }) {
  const [activeDoc, setActiveDoc] = useState(DOCS[0].key);
  const [copied, setCopied] = useState(false);

  const doc = DOCS.find((d) => d.key === activeDoc) || DOCS[0];
  const text = useMemo(
    () => doc.gen(client, settings),
    [doc, client, settings]
  );
  const p = progressFor(client);

  const handleCopy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    downloadText(`${slugify(clientDisplayName(client))}-${doc.file}.txt`, text);
  };

  return (
    <div className="detail-page">
      <header className="topbar">
        <div className="brand">
          <button className="btn ghost back" onClick={onBack}>
            ← Back
          </button>
          <div>
            <h1>{clientDisplayName(client)}</h1>
            <p className="sub">
              <span className={"badge " + statusClass(client.status)}>
                {client.status}
              </span>
              {client.legalName && client.dba
                ? " · " + client.legalName
                : ""}
            </p>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={onEdit}>
            Edit Client
          </button>
        </div>
      </header>

      <div className="detail-grid">
        <aside className="tracker">
          <div className="tracker-head">
            <h3>Onboarding Progress</h3>
            <span className="mono">{p.pct}%</span>
          </div>
          <div className="progress-bar big">
            <div className="progress-fill" style={{ width: p.pct + "%" }} />
          </div>
          <ul className="task-list">
            {ONBOARDING_TASKS.map((t) => {
              const done = !!(client.tasks && client.tasks[t.key]);
              return (
                <li key={t.key}>
                  <label className={"task" + (done ? " done" : "")}>
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => onToggleTask(t.key)}
                    />
                    <span>{t.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </aside>

        <main className="docpane">
          <div className="doc-tabs">
            {DOCS.map((d) => (
              <button
                key={d.key}
                className={"doc-tab" + (d.key === activeDoc ? " active" : "")}
                onClick={() => setActiveDoc(d.key)}
              >
                {d.title}
              </button>
            ))}
          </div>
          <div className="doc-actions">
            <button className="btn small" onClick={handleCopy}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button className="btn small ghost" onClick={handleDownload}>
              Download .txt
            </button>
          </div>
          <pre className="doc-body">{text}</pre>
        </main>
      </div>
    </div>
  );
}

function Settings({ initial, onSave, onBack }) {
  const [s, setS] = useState(initial);
  const set = (k) => (val) => setS((prev) => ({ ...prev, [k]: val }));

  return (
    <div className="form-page">
      <header className="topbar">
        <div className="brand">
          <button className="btn ghost back" onClick={onBack}>
            ← Back
          </button>
          <div>
            <h1>Business Profile</h1>
            <p className="sub">Used to pre-fill every generated document.</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn primary" onClick={() => onSave(s)}>
            Save Profile
          </button>
        </div>
      </header>

      <FieldGroup title="Your Business">
        <Row cols={2}>
          <Field
            label="Business name"
            value={s.businessName}
            onChange={set("businessName")}
            placeholder="Ledger & Co. Bookkeeping"
          />
          <Field
            label="Website"
            value={s.website}
            onChange={set("website")}
            placeholder="ledgerco.com"
            mono
          />
        </Row>
        <Row cols={2}>
          <Field
            label="Owner name"
            value={s.ownerName}
            onChange={set("ownerName")}
          />
          <Field
            label="Title"
            value={s.title}
            onChange={set("title")}
            placeholder="Owner & Bookkeeper"
          />
        </Row>
        <Row cols={2}>
          <Field
            label="Email"
            value={s.email}
            onChange={set("email")}
            type="email"
            mono
          />
          <Field label="Phone" value={s.phone} onChange={set("phone")} mono />
        </Row>
      </FieldGroup>

      <FieldGroup title="Business Address">
        <Row cols={1}>
          <Field label="Street" value={s.street} onChange={set("street")} />
        </Row>
        <Row cols={3}>
          <Field label="City" value={s.city} onChange={set("city")} />
          <Field label="State" value={s.state} onChange={set("state")} />
          <Field label="ZIP" value={s.zip} onChange={set("zip")} mono />
        </Row>
      </FieldGroup>

      <FieldGroup
        title="Defaults"
        hint="Governing state is used in the engagement letter."
      >
        <Row cols={2}>
          <Field
            label="Governing state"
            value={s.governingState}
            onChange={set("governingState")}
            placeholder="Missouri"
          />
          <Field
            label="Default fee"
            value={s.defaultFee}
            onChange={set("defaultFee")}
            placeholder="$500 / mo"
            mono
          />
        </Row>
      </FieldGroup>

      <div className="form-footer">
        <button className="btn primary" onClick={() => onSave(s)}>
          Save Profile
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root component                                                      */
/* ------------------------------------------------------------------ */

export default function App() {
  const [view, setView] = useState("clients"); // clients | form | detail | settings
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(blankSettings());
  const [activeId, setActiveId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);

  // Load persisted state on mount.
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!STORE) {
        setStorageOk(false);
        setLoaded(true);
        return;
      }
      try {
        const rawClients = await loadKey(CLIENTS_KEY);
        const rawSettings = await loadKey(SETTINGS_KEY);
        if (cancelled) return;
        if (rawClients) {
          try {
            const parsed = JSON.parse(rawClients);
            if (Array.isArray(parsed)) setClients(parsed);
          } catch (e) {
            /* ignore corrupt value */
          }
        }
        if (rawSettings) {
          try {
            const parsed = JSON.parse(rawSettings);
            setSettings({ ...blankSettings(), ...parsed });
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        setStorageOk(false);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist clients after initial load.
  useEffect(() => {
    if (!loaded || !STORE) return;
    saveKey(CLIENTS_KEY, JSON.stringify(clients));
  }, [clients, loaded]);

  // Persist settings after initial load.
  useEffect(() => {
    if (!loaded || !STORE) return;
    saveKey(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, loaded]);

  const settingsReady = Boolean(settings.businessName && settings.ownerName);
  const activeClient = clients.find((c) => c.id === activeId) || null;

  const openNew = () => {
    setEditing(blankClient());
    setView("form");
  };

  const openClient = (id) => {
    setActiveId(id);
    setView("detail");
  };

  const openEdit = () => {
    if (activeClient) {
      setEditing(activeClient);
      setView("form");
    }
  };

  const saveClient = (c) => {
    setClients((prev) => {
      const exists = prev.some((x) => x.id === c.id);
      return exists ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev];
    });
    setActiveId(c.id);
    setView("detail");
  };

  const deleteClient = () => {
    if (!editing) return;
    if (
      typeof window !== "undefined" &&
      window.confirm &&
      !window.confirm("Delete this client? This cannot be undone.")
    ) {
      return;
    }
    setClients((prev) => prev.filter((x) => x.id !== editing.id));
    setActiveId(null);
    setView("clients");
  };

  const toggleTask = (taskKey) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const tasks = { ...c.tasks, [taskKey]: !c.tasks[taskKey] };
        return { ...c, tasks };
      })
    );
  };

  const saveSettings = (s) => {
    setSettings(s);
    setView("clients");
  };

  return (
    <div className="app">
      <style>{CSS}</style>

      {!storageOk ? (
        <div className="warnbar">
          ⚠ Storage is unavailable in this environment — your data is kept
          in memory for this session only and will be lost on reload.
        </div>
      ) : null}

      {!loaded ? (
        <div className="loading">Loading…</div>
      ) : view === "clients" ? (
        <Clients
          clients={clients}
          onNew={openNew}
          onOpen={openClient}
          onSettings={() => setView("settings")}
          settingsReady={settingsReady}
        />
      ) : view === "form" ? (
        <ClientForm
          initial={editing}
          settings={settings}
          onSave={saveClient}
          onCancel={() =>
            setView(activeClient && activeId ? "detail" : "clients")
          }
          onDelete={
            editing && clients.some((x) => x.id === editing.id)
              ? deleteClient
              : null
          }
        />
      ) : view === "detail" && activeClient ? (
        <Detail
          client={activeClient}
          settings={settings}
          onEdit={openEdit}
          onBack={() => setView("clients")}
          onToggleTask={toggleTask}
        />
      ) : view === "settings" ? (
        <Settings
          initial={settings}
          onSave={saveSettings}
          onBack={() => setView("clients")}
        />
      ) : (
        <Clients
          clients={clients}
          onNew={openNew}
          onOpen={openClient}
          onSettings={() => setView("settings")}
          settingsReady={settingsReady}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Design system (editorial "ledger" aesthetic)                        */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Spline+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --green: #1C5240;
  --green-deep: #123A2C;
  --green-soft: #E6EFEA;
  --paper: #F7F4EC;
  --paper-2: #FBF9F3;
  --ink: #20231F;
  --ink-soft: #5A5F56;
  --line: #D9D3C4;
  --rust: #B5562A;
  --gold: #B8893B;
  --radius: 14px;
  --shadow: 0 1px 0 rgba(0,0,0,0.04), 0 10px 30px rgba(28,82,64,0.07);
}

* { box-sizing: border-box; }

.app {
  min-height: 100vh;
  background-color: var(--paper);
  background-image: radial-gradient(var(--line) 0.7px, transparent 0.7px);
  background-size: 22px 22px;
  color: var(--ink);
  font-family: 'Spline Sans', system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  padding: 28px;
}

.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }

h1 { font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: 30px; margin: 0; letter-spacing: -0.01em; color: var(--green-deep); }
h2 { font-family: 'Fraunces', Georgia, serif; font-weight: 500; margin: 0; }
h3 { font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: 18px; margin: 0; color: var(--green-deep); }

.sub { margin: 2px 0 0; color: var(--ink-soft); font-size: 14px; }

.warnbar {
  background: #FBEDE3; border: 1px solid var(--rust); color: #7A2E12;
  border-radius: 10px; padding: 10px 14px; margin-bottom: 18px; font-size: 13px;
}

.loading { padding: 60px; text-align: center; color: var(--ink-soft); font-family: 'IBM Plex Mono', monospace; }

/* Top bar */
.topbar {
  display: flex; justify-content: space-between; align-items: center;
  gap: 16px; flex-wrap: wrap; margin-bottom: 22px;
  padding-bottom: 18px; border-bottom: 2px solid var(--green);
}
.brand { display: flex; align-items: center; gap: 14px; }
.brand-mark {
  width: 46px; height: 46px; flex: 0 0 46px;
  display: flex; align-items: center; justify-content: center;
  background: var(--green); color: var(--paper-2); border-radius: 12px;
  font-family: 'Fraunces', serif; font-size: 22px; line-height: 1;
}
.top-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

/* Buttons */
.btn {
  font-family: 'Spline Sans', sans-serif; font-size: 14px; font-weight: 500;
  border: 1px solid var(--green); background: var(--green); color: var(--paper-2);
  padding: 9px 16px; border-radius: 999px; cursor: pointer;
  transition: transform .08s ease, filter .12s ease, background .12s ease;
}
.btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
.btn:active { transform: translateY(0); }
.btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
.btn.primary { background: var(--green); }
.btn.ghost { background: transparent; color: var(--green-deep); border-color: var(--line); }
.btn.ghost:hover { background: var(--green-soft); }
.btn.danger { background: transparent; color: var(--rust); border-color: var(--rust); }
.btn.danger:hover { background: #FBEDE3; }
.btn.small { padding: 6px 12px; font-size: 13px; }
.btn.back { padding: 7px 12px; }
.link-btn { background: none; border: none; color: var(--green); font-weight: 600; cursor: pointer; padding: 0 0 0 8px; font-family: inherit; }

/* Callout */
.callout {
  background: var(--green-soft); border: 1px solid var(--green);
  border-radius: var(--radius); padding: 14px 18px; margin-bottom: 20px; font-size: 14px;
}

/* Toolbar */
.toolbar { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 22px; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  border: 1px solid var(--line); background: var(--paper-2); color: var(--ink-soft);
  padding: 6px 12px; border-radius: 999px; cursor: pointer; font-size: 13px; font-family: inherit;
  transition: all .12s ease;
}
.chip:hover { border-color: var(--green); color: var(--green-deep); }
.chip.active { background: var(--green); border-color: var(--green); color: var(--paper-2); }
.chip-count { font-family: 'IBM Plex Mono', monospace; font-size: 11px; opacity: .8; margin-left: 4px; }
.search {
  border: 1px solid var(--line); background: var(--paper-2); border-radius: 999px;
  padding: 8px 16px; font-family: inherit; font-size: 14px; min-width: 220px; color: var(--ink);
}
.search:focus { outline: none; border-color: var(--green); }

/* Cards grid */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.card {
  text-align: left; background: var(--paper-2); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 18px; cursor: pointer; box-shadow: var(--shadow);
  transition: transform .1s ease, box-shadow .12s ease, border-color .12s ease;
  font-family: inherit; color: inherit; display: flex; flex-direction: column; gap: 14px;
}
.card:hover { transform: translateY(-2px); border-color: var(--green); box-shadow: 0 14px 34px rgba(28,82,64,0.12); }
.card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.card-sub { margin: 3px 0 0; color: var(--ink-soft); font-size: 13px; }
.card-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--ink-soft); }

/* Badges */
.badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap; letter-spacing: .02em; }
.st-lead { background: #EDEAF6; color: #4A3F7A; }
.st-onboarding { background: #FBF0DA; color: var(--gold); }
.st-active { background: var(--green-soft); color: var(--green); }
.st-paused { background: #F1ECE3; color: var(--ink-soft); }

/* Progress */
.progress { display: flex; align-items: center; gap: 10px; }
.progress-bar { flex: 1; height: 7px; background: var(--line); border-radius: 999px; overflow: hidden; }
.progress-bar.big { height: 10px; margin: 6px 0 4px; }
.progress-fill { height: 100%; background: var(--green); border-radius: 999px; transition: width .3s ease; }
.progress-label { font-size: 12px; color: var(--ink-soft); }

/* Empty */
.empty { text-align: center; padding: 70px 20px; color: var(--ink-soft); }
.empty-mark { font-family: 'Fraunces', serif; font-size: 56px; color: var(--green); opacity: .5; }
.empty h2 { margin: 12px 0 6px; color: var(--green-deep); }
.empty p { margin: 0 0 18px; }

/* Forms */
.form-page, .detail-page { max-width: 1000px; margin: 0 auto; }
.fgroup {
  background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 22px; margin-bottom: 18px; box-shadow: var(--shadow);
}
.fgroup-head { margin-bottom: 16px; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.fgroup-hint { margin: 4px 0 0; color: var(--ink-soft); font-size: 13px; }
.fgroup-body { display: flex; flex-direction: column; gap: 14px; }

.row { display: grid; gap: 14px; }
.row-1 { grid-template-columns: 1fr; }
.row-2 { grid-template-columns: 1fr 1fr; }
.row-3 { grid-template-columns: 1fr 1fr 1fr; }

.field { display: flex; flex-direction: column; gap: 5px; }
.field-full { grid-column: 1 / -1; }
.field-label { font-size: 12px; font-weight: 500; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .04em; }
.req { color: var(--rust); }
.input {
  border: 1px solid var(--line); background: var(--paper); border-radius: 9px;
  padding: 9px 12px; font-family: inherit; font-size: 14px; color: var(--ink); width: 100%;
}
.input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 3px var(--green-soft); }
.input.mono { font-family: 'IBM Plex Mono', monospace; }
.textarea { resize: vertical; line-height: 1.5; }

.check-field { justify-content: flex-end; }
.checkbox { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 9px 0; }
.checkbox input { width: 16px; height: 16px; accent-color: var(--green); }

/* Service chips */
.services { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; margin-bottom: 6px; }
.service-chip {
  display: flex; align-items: center; gap: 9px; border: 1px solid var(--line);
  background: var(--paper); border-radius: 10px; padding: 10px 12px; cursor: pointer;
  font-size: 13px; transition: all .12s ease;
}
.service-chip:hover { border-color: var(--green); }
.service-chip.selected { border-color: var(--green); background: var(--green-soft); }
.service-chip input { accent-color: var(--green); }

.form-footer { display: flex; justify-content: flex-end; gap: 10px; margin: 4px 0 40px; }

/* Detail */
.detail-grid { display: grid; grid-template-columns: 300px 1fr; gap: 18px; align-items: start; }
.tracker {
  background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 20px; box-shadow: var(--shadow); position: sticky; top: 20px;
}
.tracker-head { display: flex; justify-content: space-between; align-items: baseline; }
.task-list { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.task { display: flex; align-items: flex-start; gap: 9px; padding: 7px 6px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: background .1s ease; }
.task:hover { background: var(--green-soft); }
.task input { margin-top: 2px; accent-color: var(--green); width: 15px; height: 15px; }
.task.done span { color: var(--ink-soft); text-decoration: line-through; }

.docpane {
  background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius);
  box-shadow: var(--shadow); overflow: hidden;
}
.doc-tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 10px 10px 0; border-bottom: 1px solid var(--line); }
.doc-tab {
  border: none; background: transparent; color: var(--ink-soft); cursor: pointer;
  padding: 9px 13px; font-family: inherit; font-size: 13px; border-radius: 8px 8px 0 0;
  border-bottom: 2px solid transparent; transition: all .1s ease; margin-bottom: -1px;
}
.doc-tab:hover { color: var(--green-deep); background: var(--green-soft); }
.doc-tab.active { color: var(--green-deep); border-bottom-color: var(--green); font-weight: 500; }
.doc-actions { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.doc-body {
  margin: 0; padding: 26px 28px; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px;
  line-height: 1.85; white-space: pre-wrap; word-wrap: break-word; color: var(--ink);
  background-image: linear-gradient(transparent calc(1.85em - 1px), rgba(28,82,64,0.06) 1px);
  background-size: 100% 1.85em; background-position: 0 26px;
  max-height: 70vh; overflow: auto;
}

@media (max-width: 880px) {
  .app { padding: 16px; }
  .row-2, .row-3 { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
  .tracker { position: static; }
  h1 { font-size: 24px; }
}
`;
