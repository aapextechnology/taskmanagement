// Demo fixture data (DEV ONLY). Fixed UUIDs make every seed run idempotent.
// Conventions: events …e0XX · tasks …a0XX/b0XX/c0XX · comments …c1XX ·
// handoffs …d0XX · labels …f0XX. Times are offsets from "now" in hours.

export const DEMO_PASSWORD = "backstage123";

export const EVENT_IDS = {
  yeLive: "00000000-0000-4000-8000-00000000e001",
  neonHorizon: "00000000-0000-4000-8000-00000000e002",
  midnightFrequency: "00000000-0000-4000-8000-00000000e003",
} as const;

export const DEMO_USERS: Array<{
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "external";
  membership?: { divisionId: string; role: "head" | "staff" };
}> = [
  { email: "owner@rawvision.demo", name: "Rama Wijaya", role: "owner" },
  { email: "admin@rawvision.demo", name: "Sari Dewi", role: "admin" },
  { email: "head.production@rawvision.demo", name: "Bimo Prasetyo", role: "member", membership: { divisionId: "production", role: "head" } },
  { email: "staff.production@rawvision.demo", name: "Tono Hartawan", role: "member", membership: { divisionId: "production", role: "staff" } },
  { email: "head.marketing@rawvision.demo", name: "Maya Anggraini", role: "member", membership: { divisionId: "marketing-communications", role: "head" } },
  { email: "staff.marketing@rawvision.demo", name: "Dina Puspita", role: "member", membership: { divisionId: "marketing-communications", role: "staff" } },
  { email: "head.finance@rawvision.demo", name: "Agus Santoso", role: "member", membership: { divisionId: "finance", role: "head" } },
  { email: "staff.finance@rawvision.demo", name: "Rina Kusuma", role: "member", membership: { divisionId: "finance", role: "staff" } },
  { email: "head.ops@rawvision.demo", name: "Dewi Lestari", role: "member", membership: { divisionId: "operations-logistics", role: "head" } },
  { email: "staff.ops@rawvision.demo", name: "Joko Susilo", role: "member", membership: { divisionId: "operations-logistics", role: "staff" } },
  { email: "head.ticketing@rawvision.demo", name: "Putri Maharani", role: "member", membership: { divisionId: "ticketing-sales", role: "head" } },
  { email: "head.legal@rawvision.demo", name: "Andi Nugraha", role: "member", membership: { divisionId: "legal-licensing", role: "head" } },
  // magic-link only — no password (EPIC-007)
  { email: "vendor@soundsupply.example", name: "Sound Supply Co.", role: "external" },
];

export const DEMO_EVENTS: Array<{
  id: string;
  name: string;
  artists: string;
  venue: string;
  showOffsetHours: number;
  capacity: number;
  phase: "planning" | "pre_production" | "promotion" | "show_week" | "show_day" | "settlement";
}> = [
  {
    id: EVENT_IDS.yeLive,
    name: "YE Live in Jakarta",
    artists: "YE · Special Guests",
    venue: "Jakarta International Stadium",
    showOffsetHours: 90 * 24,
    capacity: 60_000,
    phase: "planning",
  },
  {
    id: EVENT_IDS.neonHorizon,
    name: "Neon Horizon Festival",
    artists: "Peggy Gou · Fred again.. · NIKI",
    venue: "GBK Madya Stadium",
    showOffsetHours: 30 * 24,
    capacity: 25_000,
    phase: "promotion",
  },
  {
    id: EVENT_IDS.midnightFrequency,
    name: "Midnight Frequency",
    artists: "Justice · Local Support",
    venue: "Istora Senayan",
    showOffsetHours: -14 * 24, // already played — settlement phase
    capacity: 8_000,
    phase: "settlement",
  },
];

export const DEMO_LABELS: Array<{ id: string; name: string; color: string }> = [
  { id: "00000000-0000-4000-8000-00000000f001", name: "vendor", color: "blue" },
  { id: "00000000-0000-4000-8000-00000000f002", name: "contract", color: "violet" },
  { id: "00000000-0000-4000-8000-00000000f003", name: "permit", color: "amber" },
  { id: "00000000-0000-4000-8000-00000000f004", name: "creative", color: "pink" },
  { id: "00000000-0000-4000-8000-00000000f005", name: "budget", color: "green" },
];

export interface DemoTask {
  id: string;
  eventId: string;
  divisionId: string;
  title: string;
  description?: string;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  dueOffsetHours: number | null;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  assigneeEmails?: string[];
  watcherEmails?: string[];
  labelIds?: string[];
  dependsOn?: string[];
  checklist?: Array<{ title: string; done?: boolean }>;
}

const E1 = EVENT_IDS.yeLive;
const E2 = EVENT_IDS.neonHorizon;
const E3 = EVENT_IDS.midnightFrequency;

export const DEMO_TASKS: DemoTask[] = [
  // ---- YE Live in Jakarta (planning, +90d) --------------------------------
  {
    id: "00000000-0000-4000-8000-00000000a001",
    eventId: E1,
    divisionId: "production",
    title: "Confirm stage rigging vendor",
    description: "Shortlist is down to two vendors — need signed quote before site build planning can start.",
    status: "todo",
    priority: "high",
    dueOffsetHours: -48, // overdue on purpose → event AT RISK
    assigneeEmails: ["staff.production@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f001"],
  },
  {
    id: "00000000-0000-4000-8000-00000000a002",
    eventId: E1,
    divisionId: "production",
    title: "Draft technical rider checklist",
    status: "in_progress",
    dueOffsetHours: 6,
    assigneeEmails: ["head.production@rawvision.demo"],
  },
  {
    id: "00000000-0000-4000-8000-00000000a003",
    eventId: E1,
    divisionId: "production",
    title: "Site build plan v1",
    status: "todo",
    priority: "high",
    dueOffsetHours: 14 * 24,
    assigneeEmails: ["staff.production@rawvision.demo"],
    dependsOn: ["00000000-0000-4000-8000-00000000a001"],
  },
  {
    id: "00000000-0000-4000-8000-00000000a004",
    eventId: E1,
    divisionId: "marketing-communications",
    title: "Announce lineup — phase 1 assets",
    status: "todo",
    dueOffsetHours: 7 * 24,
    assigneeEmails: ["staff.marketing@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f004"],
  },
  {
    id: "00000000-0000-4000-8000-00000000a005",
    eventId: E1,
    divisionId: "legal-licensing",
    title: "File police permit application",
    description: "Lead time is long — submit early. City + venue permits follow.",
    status: "todo",
    priority: "high",
    dueOffsetHours: 21 * 24,
    assigneeEmails: ["head.legal@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f003"],
    checklist: [
      { title: "Collect venue capacity documents", done: true },
      { title: "Draft crowd management summary" },
      { title: "Book police liaison meeting" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-00000000a006",
    eventId: E1,
    divisionId: "finance",
    title: "Draft master budget v1",
    status: "in_review",
    priority: "high",
    dueOffsetHours: 7 * 24,
    assigneeEmails: ["staff.finance@rawvision.demo"],
    watcherEmails: ["head.finance@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f005"],
  },
  {
    id: "00000000-0000-4000-8000-00000000a007",
    eventId: E1,
    divisionId: "operations-logistics",
    title: "Venue site survey",
    status: "done",
    dueOffsetHours: -5 * 24,
    assigneeEmails: ["staff.ops@rawvision.demo"],
  },
  {
    id: "00000000-0000-4000-8000-00000000a008",
    eventId: E1,
    divisionId: "production",
    title: "Book FOH engineer",
    status: "blocked",
    dueOffsetHours: 20 * 24,
    assigneeEmails: ["head.production@rawvision.demo"],
    dependsOn: ["00000000-0000-4000-8000-00000000a001"],
    labelIds: ["00000000-0000-4000-8000-00000000f001"],
  },
  {
    id: "00000000-0000-4000-8000-00000000a009",
    eventId: E1,
    divisionId: "ticketing-sales",
    title: "Ticketing platform comparison",
    status: "in_progress",
    dueOffsetHours: 10 * 24,
    assigneeEmails: ["head.ticketing@rawvision.demo"],
  },
  {
    // created by the accepted handoff d002 (see DEMO_HANDOFFS)
    id: "00000000-0000-4000-8000-00000000a010",
    eventId: E1,
    divisionId: "operations-logistics",
    title: "Freight schedule for stage steel",
    status: "todo",
    priority: "high",
    dueOffsetHours: 12 * 24,
    assigneeEmails: ["staff.ops@rawvision.demo"],
  },

  // ---- Neon Horizon Festival (promotion, +30d) ----------------------------
  {
    id: "00000000-0000-4000-8000-00000000b001",
    eventId: E2,
    divisionId: "marketing-communications",
    title: "Phase 2 content calendar",
    status: "in_progress",
    priority: "urgent",
    dueOffsetHours: 3 * 24,
    assigneeEmails: ["staff.marketing@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f004"],
    checklist: [
      { title: "Artist spotlight reels", done: true },
      { title: "Countdown story templates" },
      { title: "Partner cross-posts schedule" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-00000000b002",
    eventId: E2,
    divisionId: "marketing-communications",
    title: "Book media partners",
    status: "todo",
    dueOffsetHours: 5 * 24,
    assigneeEmails: ["head.marketing@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f002"],
  },
  {
    id: "00000000-0000-4000-8000-00000000b003",
    eventId: E2,
    divisionId: "production",
    title: "Stage design freeze",
    status: "in_review",
    priority: "high",
    dueOffsetHours: 7 * 24,
    assigneeEmails: ["head.production@rawvision.demo"],
  },
  {
    id: "00000000-0000-4000-8000-00000000b004",
    eventId: E2,
    divisionId: "operations-logistics",
    title: "International freight quotes for artist gear",
    status: "todo",
    priority: "high",
    dueOffsetHours: 9 * 24,
    assigneeEmails: ["staff.ops@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f001"],
  },
  {
    id: "00000000-0000-4000-8000-00000000b005",
    eventId: E2,
    divisionId: "finance",
    title: "Sponsor invoicing — batch 1",
    status: "todo",
    dueOffsetHours: 6 * 24,
    assigneeEmails: ["staff.finance@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f005"],
    recurrence: "monthly",
  },
  {
    id: "00000000-0000-4000-8000-00000000b006",
    eventId: E2,
    divisionId: "ticketing-sales",
    title: "Presale wave 2 setup",
    status: "done",
    dueOffsetHours: -2 * 24,
    assigneeEmails: ["head.ticketing@rawvision.demo"],
  },
  {
    id: "00000000-0000-4000-8000-00000000b007",
    eventId: E2,
    divisionId: "security-safety",
    title: "Crowd management plan draft",
    status: "backlog",
    dueOffsetHours: 12 * 24,
  },

  // ---- Midnight Frequency (settlement, played -14d) -----------------------
  {
    id: "00000000-0000-4000-8000-00000000c001",
    eventId: E3,
    divisionId: "finance",
    title: "Vendor final payments",
    status: "in_progress",
    priority: "urgent",
    dueOffsetHours: -2 * 24, // overdue → settlement event AT RISK
    assigneeEmails: ["head.finance@rawvision.demo"],
    watcherEmails: ["owner@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f005"],
  },
  {
    id: "00000000-0000-4000-8000-00000000c002",
    eventId: E3,
    divisionId: "finance",
    title: "Event settlement report",
    status: "todo",
    dueOffsetHours: 5 * 24,
    assigneeEmails: ["staff.finance@rawvision.demo"],
    checklist: [
      { title: "Reconcile ticketing revenue", done: true },
      { title: "Collect outstanding sponsor payments" },
      { title: "Final P&L sign-off" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-00000000c003",
    eventId: E3,
    divisionId: "marketing-communications",
    title: "Post-event recap content",
    status: "done",
    dueOffsetHours: -6 * 24,
    assigneeEmails: ["staff.marketing@rawvision.demo"],
    labelIds: ["00000000-0000-4000-8000-00000000f004"],
  },
];

export const DEMO_COMMENTS: Array<{
  id: string;
  taskId: string;
  authorEmail: string;
  body: string;
  mentionEmails?: string[];
}> = [
  {
    id: "00000000-0000-4000-8000-00000000c101",
    taskId: "00000000-0000-4000-8000-00000000a001",
    authorEmail: "head.production@rawvision.demo",
    body: "@Tono Hartawan any word back from RiggingPro? Site build plan is waiting on this.",
    mentionEmails: ["staff.production@rawvision.demo"],
  },
  {
    id: "00000000-0000-4000-8000-00000000c102",
    taskId: "00000000-0000-4000-8000-00000000a001",
    authorEmail: "staff.production@rawvision.demo",
    body: "They promised the revised quote by Friday. Chasing again tomorrow morning.",
  },
  {
    id: "00000000-0000-4000-8000-00000000c103",
    taskId: "00000000-0000-4000-8000-00000000b003",
    authorEmail: "head.marketing@rawvision.demo",
    body: "Once this freezes we need the render for the phase 2 content — see the handoff request.",
  },
  {
    id: "00000000-0000-4000-8000-00000000c104",
    taskId: "00000000-0000-4000-8000-00000000c001",
    authorEmail: "owner@rawvision.demo",
    body: "@Agus Santoso please prioritize the sound vendor — they have been waiting three weeks.",
    mentionEmails: ["head.finance@rawvision.demo"],
  },
];

export const DEMO_HANDOFFS: Array<{
  id: string;
  eventId: string;
  fromDivisionId: string;
  toDivisionId: string;
  title: string;
  note?: string;
  status: "pending" | "accepted" | "declined";
  requestedByEmail: string;
  decidedByEmail?: string;
  originTaskId?: string;
  createdTaskId?: string;
}> = [
  {
    id: "00000000-0000-4000-8000-00000000d001",
    eventId: E2,
    fromDivisionId: "marketing-communications",
    toDivisionId: "production",
    title: "Stage design render for announcement content",
    note: "Need a hero render + 2 detail shots as soon as the design freezes.",
    status: "pending",
    requestedByEmail: "head.marketing@rawvision.demo",
    originTaskId: "00000000-0000-4000-8000-00000000b001",
  },
  {
    id: "00000000-0000-4000-8000-00000000d002",
    eventId: E1,
    fromDivisionId: "production",
    toDivisionId: "operations-logistics",
    title: "Freight schedule for stage steel",
    note: "Stage steel arrives in 3 shipments — need the freight plan locked.",
    status: "accepted",
    requestedByEmail: "head.production@rawvision.demo",
    decidedByEmail: "head.ops@rawvision.demo",
    originTaskId: "00000000-0000-4000-8000-00000000a003",
    createdTaskId: "00000000-0000-4000-8000-00000000a010",
  },
];

export const DEMO_APPROVALS: Array<{
  id: string;
  type: "expense" | "artist_offer" | "contract" | "sponsorship_deal" | "public_content";
  title: string;
  description?: string;
  amount?: number;
  divisionId: string;
  eventId?: string;
  requestedByEmail: string;
  chain: string[]; // approver role keys, index 0 = current pending step
}> = [
  {
    id: "00000000-0000-4000-8000-00000000ab01",
    type: "expense",
    title: "PA system rental — main stage",
    description: "Quote from Sound Supply Co. attached to the task. 3-day rental incl. crew.",
    amount: 85_000_000,
    divisionId: "production",
    eventId: EVENT_IDS.neonHorizon,
    requestedByEmail: "staff.production@rawvision.demo",
    chain: ["division_head", "finance"],
  },
  {
    id: "00000000-0000-4000-8000-00000000ab02",
    type: "contract",
    title: "Media partner agreement — Kult Radio",
    divisionId: "marketing-communications",
    eventId: EVENT_IDS.neonHorizon,
    requestedByEmail: "head.marketing@rawvision.demo",
    chain: ["legal", "owner"],
  },
  {
    id: "00000000-0000-4000-8000-00000000ab03",
    type: "expense",
    title: "Crew catering — load-in week",
    amount: 7_500_000,
    divisionId: "operations-logistics",
    eventId: EVENT_IDS.yeLive,
    requestedByEmail: "staff.ops@rawvision.demo",
    chain: ["division_head"],
  },
];

export const DEMO_BUDGETS: Array<{
  id: string;
  eventId: string;
  lines: Array<{ id: string; divisionId: string; name: string; plannedAmount: number }>;
}> = [
  {
    id: "00000000-0000-4000-8000-00000000b901",
    eventId: EVENT_IDS.neonHorizon,
    lines: [
      { id: "00000000-0000-4000-8000-00000000bd01", divisionId: "production", name: "Stage & production", plannedAmount: 600_000_000 },
      { id: "00000000-0000-4000-8000-00000000bd02", divisionId: "marketing-communications", name: "Campaign & content", plannedAmount: 250_000_000 },
      { id: "00000000-0000-4000-8000-00000000bd03", divisionId: "operations-logistics", name: "Logistics & freight", plannedAmount: 200_000_000 },
    ],
  },
  {
    id: "00000000-0000-4000-8000-00000000b902",
    eventId: EVENT_IDS.yeLive,
    lines: [
      { id: "00000000-0000-4000-8000-00000000bd04", divisionId: "production", name: "Stage, sound & lights", plannedAmount: 1_500_000_000 },
      { id: "00000000-0000-4000-8000-00000000bd05", divisionId: "legal-licensing", name: "Permits & licensing", plannedAmount: 100_000_000 },
      { id: "00000000-0000-4000-8000-00000000bd06", divisionId: "operations-logistics", name: "Crew & catering", plannedAmount: 150_000_000 },
    ],
  },
];

// expenses linked to the seeded pending approvals (ab01/ab03)
export const DEMO_EXPENSES: Array<{
  id: string;
  approvalId: string;
  eventId: string;
  divisionId: string;
  budgetLineId?: string;
  title: string;
  vendor?: string;
  amount: number;
  requestedByEmail: string;
}> = [
  {
    id: "00000000-0000-4000-8000-00000000ef01",
    approvalId: "00000000-0000-4000-8000-00000000ab01",
    eventId: EVENT_IDS.neonHorizon,
    divisionId: "production",
    budgetLineId: "00000000-0000-4000-8000-00000000bd01",
    title: "PA system rental — main stage",
    vendor: "Sound Supply Co.",
    amount: 85_000_000,
    requestedByEmail: "staff.production@rawvision.demo",
  },
  {
    id: "00000000-0000-4000-8000-00000000ef02",
    approvalId: "00000000-0000-4000-8000-00000000ab03",
    eventId: EVENT_IDS.yeLive,
    divisionId: "operations-logistics",
    budgetLineId: "00000000-0000-4000-8000-00000000bd06",
    title: "Crew catering — load-in week",
    vendor: "Dapur Kita Catering",
    amount: 7_500_000,
    requestedByEmail: "staff.ops@rawvision.demo",
  },
];

export const DEMO_NOTIFICATIONS: Array<{
  userEmail: string;
  type: "assigned" | "mentioned" | "handoff_request" | "overdue";
  title: string;
  href: string;
  dedupKey: string;
}> = [
  {
    userEmail: "staff.production@rawvision.demo",
    type: "mentioned",
    title: "You were mentioned in a comment",
    href: "/tasks/00000000-0000-4000-8000-00000000a001",
    dedupKey: "seed:mention:a001:staff.production",
  },
  {
    userEmail: "head.production@rawvision.demo",
    type: "handoff_request",
    title: "Handoff request: Stage design render for announcement content",
    href: `/events/${E2}/handoffs`,
    dedupKey: "seed:handoff:d001:head.production",
  },
  {
    userEmail: "head.finance@rawvision.demo",
    type: "mentioned",
    title: "You were mentioned in a comment",
    href: "/tasks/00000000-0000-4000-8000-00000000c001",
    dedupKey: "seed:mention:c001:head.finance",
  },
];
