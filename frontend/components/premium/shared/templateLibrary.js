/**
 * templateLibrary.js — the country-specific template SYSTEM, as data.
 *
 * The old model (prebuiltResumes.js) was one hand-written resume object per
 * country — real content, but only one *structure* per market, and adding
 * more meant hand-authoring an entire new fictional resume every time.
 *
 * What actually makes a resume format "industry standard" isn't the fake
 * biography sitting in it — it's which sections exist, in what order, and
 * what each one is called (a recent grad leads with Education; an executive
 * leads with an Executive Summary and Core Competencies; a government
 * application is deliberately more exhaustive than a private-sector one).
 * So this file separates the two: a STRUCTURE (section list + order) per
 * real-world scenario, built from a small set of shared content blocks
 * (job/education entries) so the same underlying data doesn't get retyped
 * 20 times. Every section still only ever uses the 4 types
 * ResumeDocument.js already renders (text/bullets/jobs/education) — no
 * schema change, no new rendering code.
 *
 * Scope (v1): Canada + USA. 18 of the 20 structures are genuinely shared
 * between them (the underlying job market conventions are nearly
 * identical); each country gets one structure the other doesn't —
 * Canada's official-bilingualism format, the US's federal-style
 * government/military formats. Forcing an identical 20 on every future
 * country would mean inventing conventions that aren't real there — when
 * more countries are added, they get their OWN 1–2 country-specific slots
 * the same way, not a copy-paste of these two.
 */

// ── Shared content blocks — each written once, reused by every structure
// that plausibly belongs to that kind of career, so 20 structures don't
// mean 20 hand-written fictional careers. ──────────────────────────────────

const customerServiceJob = {
  role: "Customer Service Representative",
  company: "BrightPath Retail",
  period: "2021 – Present",
  bullets: [
    "Resolved an average of 60+ customer inquiries daily via phone and live chat, maintaining a 96% satisfaction rating",
    "Reduced repeat-contact rate by 18% by documenting recurring issues and proposing a new FAQ workflow",
    "Trained 5 new hires on CRM software and company service standards",
    "Processed returns, exchanges, and order adjustments in accordance with company policy",
  ],
};

const retailJob = {
  role: "Grocery Clerk",
  company: "Farm Boy",
  period: "2021 – 2025",
  bullets: [
    "Ensured shelves stayed fully stocked, rotating stock and checking expiration dates against a daily schedule",
    "Maintained accurate inventory counts and flagged discrepancies to management before they affected ordering",
    "Provided floor service to customers — greeting, answering product questions, and locating items",
    "Operated powered equipment (forklifts, pallet jacks) under posted safety procedures",
  ],
};

const adminJob = {
  role: "Administrative & Operations Coordinator",
  company: "Giant Tiger",
  period: "2021 – Present",
  bullets: [
    "Served as first point of contact for customer and vendor inquiries, resolving issues without escalation",
    "Maintained accurate records and completed data entry across order, inventory, and scheduling systems",
    "Coordinated with department leads to keep daily operations on schedule during peak periods",
    "Documented recurring process gaps and proposed fixes that cut order-processing errors by 22%",
  ],
};

const softwareJob = {
  role: "Software Engineer",
  company: "Northbeam Systems",
  period: "2022 – Present",
  bullets: [
    "Built and maintained REST APIs serving 200K+ daily requests, keeping p95 latency under 150ms",
    "Led migration of a legacy billing service to a queue-based architecture, cutting failed-job rate by 40%",
    "Reviewed pull requests and mentored 2 junior engineers on testing and code-review practices",
    "Shipped a customer-facing dashboard feature end-to-end, from design review through production rollout",
  ],
};

const salesJob = {
  role: "Account Executive",
  company: "Meridian Business Solutions",
  period: "2021 – Present",
  bullets: [
    "Closed $1.4M in new annual recurring revenue against a $1M quota, ranking #2 of 14 reps",
    "Built and managed a pipeline of 60+ active prospects using Salesforce and outbound sequencing",
    "Negotiated and closed multi-year contracts with enterprise accounts averaging $85K ACV",
    "Partnered with customer success to achieve a 94% renewal rate across an assigned book of business",
  ],
};

const nurseJob = {
  role: "Registered Nurse — Medical/Surgical Unit",
  company: "Riverside General Hospital",
  period: "2020 – Present",
  bullets: [
    "Provided direct patient care for a 6–8 patient caseload per shift on a 32-bed medical/surgical unit",
    "Administered medications and treatments per physician orders, maintaining zero medication-error incidents",
    "Precepted 4 newly licensed nurses through hospital orientation and competency sign-off",
    "Documented patient assessments and care plans in Epic, supporting accurate interdisciplinary handoff",
  ],
};

const executiveJob = {
  role: "Director of Operations",
  company: "Halden Consumer Group",
  period: "2019 – Present",
  bullets: [
    "Own P&L for a $40M operating division across 3 regional sites and 120 staff",
    "Led a cost-restructuring initiative that reduced operating expense by 14% without headcount cuts",
    "Built the division's first rolling demand-planning process, cutting stockouts by 30% year over year",
    "Report directly to the COO; present quarterly performance and strategy to the executive board",
  ],
};

const militaryJob = {
  role: "Logistics Non-Commissioned Officer",
  company: "United States Army",
  period: "2017 – 2023",
  bullets: [
    "Managed supply and equipment readiness for a 40-person unit across two overseas deployments",
    "Trained and supervised a team of 6 junior soldiers, directly responsible for their technical certification",
    "Coordinated transport and inventory logistics valued at $2.3M with zero loss during tenure",
    "Held Secret security clearance; maintained 100% audit compliance across three annual equipment inspections",
  ],
};

const internExperience = {
  role: "Marketing Intern",
  company: "Clearline Media",
  period: "Summer 2024",
  bullets: [
    "Supported the social media team by drafting and scheduling 15+ posts per week across 3 platforms",
    "Compiled weekly performance reports using Google Analytics and presented findings to the marketing lead",
    "Assisted with logistics for two client-facing events, coordinating vendors and day-of schedules",
  ],
};

const standardEducation = { degree: "Business Administration — Diploma", school: "Algonquin College", location: "Ottawa, ON", period: "2018 – 2020" };
const bachelorCsEducation = { degree: "B.Sc. Computer Science", school: "University of Waterloo", location: "Waterloo, ON", period: "2018 – 2022" };
const bsnEducation = { degree: "Bachelor of Science in Nursing (BSN)", school: "Michigan State University", location: "East Lansing, MI", period: "2016 – 2020" };
const mbaEducation = { degree: "MBA, Operations & Strategy", school: "University of Toronto — Rotman", location: "Toronto, ON", period: "2015 – 2017" };
const undergradBizEducation = { degree: "B.Comm, Business Administration", school: "University of Toronto — Rotman", location: "Toronto, ON", period: "2011 – 2015" };
const gradedHighSchoolEducation = { degree: "High School Diploma", school: "Central Collegiate", location: "Ottawa, ON", period: "2017" };
const inProgressBizEducation = { degree: "B.Comm, Marketing (In Progress)", school: "Toronto Metropolitan University", location: "Toronto, ON", period: "2022 – 2026 (expected)" };
const armyTraining = { degree: "Logistics & Supply Chain Certificate, U.S. Army Quartermaster School", school: "Fort Gregg-Adams", location: "VA", period: "2017" };
const militaryHighSchoolEducation = { degree: "High School Diploma", school: "W.T. White High School", location: "Dallas, TX", period: "2013" };

// ── The 20 structures ───────────────────────────────────────────────────
// `group` is the plain-language bucket the picker UI shows first ("Getting
// started" / "Experienced" / etc.) — never format jargon.
export const STRUCTURE_VARIANTS = [
  {
    id: "reverse-chronological", group: "Experienced", label: "Standard Resume",
    persona: "I have steady work experience to show", contactTitle: "Customer Service Representative",
    sections: [
      { id: "summary", label: "Professional Summary", type: "text", content: "Customer-focused professional with 4+ years delivering high-volume phone and chat support. Skilled in CRM systems, conflict resolution, and cross-department escalation, with a consistent record of exceeding customer satisfaction targets." },
      { id: "skills", label: "Core Skills", type: "bullets", items: ["Customer Relationship Management (CRM): Salesforce, Zendesk", "Conflict Resolution and De-escalation", "Multi-line Phone Systems and Live Chat Support", "Data Entry and Order Processing", "Team Collaboration and Cross-training"] },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [customerServiceJob] },
      { id: "education", label: "Education", type: "education", degrees: [standardEducation] },
    ],
  },
  {
    id: "combination-hybrid", group: "Experienced", label: "Skills + Experience",
    persona: "I want my skills to stand out as much as my job history", contactTitle: "Operations Coordinator",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Operations professional with 4+ years coordinating customer service, order processing, and cross-team workflows. Known for cutting process errors and keeping daily operations on schedule under pressure." },
      { id: "expertise", label: "Areas of Expertise", type: "bullets", items: ["Process Coordination & Documentation", "Vendor & Stakeholder Communication", "Data Entry & Records Accuracy", "Cross-team Scheduling", "Google Workspace & Microsoft Office"] },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [adminJob] },
      { id: "education", label: "Education", type: "education", degrees: [standardEducation] },
    ],
  },
  {
    id: "functional-skills", group: "Career change", label: "Skills-First",
    persona: "I have gaps, or my past titles don't match what I'm applying for", contactTitle: "Retail & Service Professional",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Service-oriented professional with a consistent record of reliability, teamwork, and customer satisfaction across retail environments. Bringing transferable strengths in inventory accuracy, floor operations, and calm problem-solving under pressure." },
      { id: "skills", label: "Key Skills", type: "bullets", items: ["Customer Service & Floor Support", "Inventory Accuracy & Stock Rotation", "Team Collaboration Under Time Pressure", "Safety Procedure Compliance", "Point-of-Sale & Basic Reporting Tools"] },
      { id: "experience", label: "Relevant Experience", type: "jobs", jobs: [retailJob] },
      { id: "education", label: "Education", type: "education", degrees: [standardEducation] },
    ],
  },
  {
    id: "entry-level-student", group: "Getting started", label: "Entry-Level",
    persona: "I'm a student or just starting my first job search", contactTitle: "Marketing Student",
    sections: [
      { id: "objective", label: "Objective", type: "text", content: "Marketing student seeking an entry-level role to apply hands-on experience in social media coordination and campaign reporting. Organized, dependable, and eager to contribute from day one." },
      { id: "education", label: "Education", type: "education", degrees: [inProgressBizEducation] },
      { id: "skills", label: "Skills", type: "bullets", items: ["Social Media Scheduling (Meta, TikTok, LinkedIn)", "Google Analytics & Basic Reporting", "Event Coordination", "Microsoft Office & Google Workspace", "Strong written communication"] },
      { id: "experience", label: "Experience & Activities", type: "jobs", jobs: [internExperience] },
    ],
  },
  {
    id: "executive-leadership", group: "Leadership", label: "Executive",
    persona: "I'm applying for a senior or leadership role", contactTitle: "Director of Operations",
    sections: [
      { id: "summary", label: "Executive Summary", type: "text", content: "Operations executive with 10+ years leading multi-site teams and owning P&L for divisions up to $40M. Proven record of restructuring cost without cutting headcount, and of building planning processes that scale." },
      { id: "competencies", label: "Core Competencies", type: "bullets", items: ["P&L Ownership & Cost Strategy", "Multi-site Team Leadership (100+ staff)", "Demand Planning & Forecasting", "Executive Reporting & Board Presentations", "Change Management"] },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [executiveJob] },
      { id: "education", label: "Education", type: "education", degrees: [mbaEducation, undergradBizEducation] },
      { id: "affiliations", label: "Board & Affiliations", type: "bullets", items: ["Advisory Board Member, Ontario Retail Council (2022 – Present)", "Mentor, Rotman Executive MBA Alumni Network"] },
    ],
  },
  {
    id: "technical-it", group: "Specialized fields", label: "Technical / IT",
    persona: "I work in software or IT", contactTitle: "Software Engineer",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Backend-leaning software engineer with 3+ years building and scaling production services. Comfortable owning a feature from design through rollout, and mentoring junior engineers along the way." },
      { id: "skills", label: "Technical Skills", type: "bullets", items: ["Languages: Python, TypeScript, Go", "Backend: REST APIs, PostgreSQL, Redis, queue-based architectures", "Infra: AWS, Docker, CI/CD pipelines", "Practices: code review, testing, incident response"] },
      { id: "experience", label: "Experience", type: "jobs", jobs: [softwareJob] },
      { id: "education", label: "Education", type: "education", degrees: [bachelorCsEducation] },
      { id: "certifications", label: "Certifications", type: "bullets", items: ["AWS Certified Solutions Architect – Associate"] },
    ],
  },
  {
    id: "academic-cv", group: "Specialized fields", label: "Academic CV",
    persona: "I'm applying to a research, teaching, or graduate program", contactTitle: "Graduate Researcher, Computer Science",
    sections: [
      { id: "education", label: "Education", type: "education", degrees: [bachelorCsEducation] },
      { id: "research", label: "Research Experience", type: "jobs", jobs: [{ role: "Research Assistant — Applied ML Lab", company: "University of Waterloo", period: "2021 – 2022", bullets: ["Contributed to a peer-reviewed study on model efficiency under low-resource training conditions", "Built the data pipeline used across 3 subsequent lab papers", "Presented findings at the department's annual research symposium"] }] },
      { id: "publications", label: "Publications & Presentations", type: "bullets", items: ["Co-author, \"Efficient Fine-Tuning Under Resource Constraints,\" department symposium proceedings, 2022", "Poster presentation, Waterloo Undergraduate Research Conference, 2021"] },
      { id: "skills", label: "Skills", type: "bullets", items: ["Python, PyTorch, pandas", "Statistical analysis & experiment design", "Technical writing"] },
    ],
  },
  {
    id: "healthcare-clinical", group: "Specialized fields", label: "Healthcare / Clinical",
    persona: "I work in nursing or clinical care", contactTitle: "Registered Nurse",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Registered Nurse with 4+ years of medical/surgical experience, known for calm, accurate care under high patient loads and for precepting newly licensed nurses through orientation." },
      { id: "licenses", label: "Licenses & Certifications", type: "bullets", items: ["Registered Nurse (RN), State of Michigan — active", "Basic Life Support (BLS) — current", "Advanced Cardiac Life Support (ACLS) — current"] },
      { id: "experience", label: "Clinical Experience", type: "jobs", jobs: [nurseJob] },
      { id: "education", label: "Education", type: "education", degrees: [bsnEducation] },
      { id: "skills", label: "Skills", type: "bullets", items: ["Epic EHR documentation", "Medication administration & charting accuracy", "Patient and family communication"] },
    ],
  },
  {
    id: "sales-bizdev", group: "Specialized fields", label: "Sales",
    persona: "I work in sales or business development", contactTitle: "Account Executive",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Enterprise account executive with a consistent record of exceeding quota through disciplined pipeline management and long-term customer relationships." },
      { id: "achievements", label: "Key Achievements", type: "bullets", items: ["Closed $1.4M in new ARR against a $1M quota (140% of target)", "Ranked #2 of 14 reps on the enterprise sales team, 2023", "94% account renewal rate across an assigned book of business"] },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [salesJob] },
      { id: "skills", label: "Skills", type: "bullets", items: ["Salesforce & outbound sequencing tools", "Enterprise contract negotiation", "Pipeline forecasting"] },
      { id: "education", label: "Education", type: "education", degrees: [undergradBizEducation] },
    ],
  },
  {
    id: "freelance-consultant", group: "Independent work", label: "Freelance / Consultant",
    persona: "I'm self-employed or take on client projects", contactTitle: "Independent Software Consultant",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Independent software consultant helping small and mid-size companies ship production web applications, from architecture through launch." },
      { id: "projects", label: "Selected Projects & Clients", type: "bullets", items: ["Rebuilt checkout flow for a DTC retailer, cutting cart-abandonment by 12% (2024)", "Built an internal reporting dashboard for a 30-person logistics firm (2023)", "Ongoing retainer: backend maintenance for a healthcare scheduling SaaS (2023 – Present)"] },
      { id: "skills", label: "Skills", type: "bullets", items: ["Python, TypeScript, PostgreSQL", "Client scoping & fixed-bid estimation", "AWS deployment & monitoring"] },
      { id: "experience", label: "Experience", type: "jobs", jobs: [softwareJob] },
      { id: "education", label: "Education", type: "education", degrees: [bachelorCsEducation] },
    ],
  },
  {
    id: "career-change", group: "Career change", label: "Career Change",
    persona: "I'm moving into a new industry", contactTitle: "Operations Professional",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Operations professional with 4+ years in customer-facing coordination roles, now pursuing a move into project management. Brings a proven record of process improvement and cross-team communication that transfers directly." },
      { id: "transferable", label: "Transferable Skills", type: "bullets", items: ["Process Documentation & Improvement", "Cross-functional Coordination", "Vendor & Stakeholder Communication", "Data Accuracy Under Deadline Pressure"] },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [adminJob] },
      { id: "education", label: "Education", type: "education", degrees: [standardEducation] },
    ],
  },
  {
    id: "government-public-sector", group: "Government & public sector", label: "Government / Public Sector",
    persona: "I'm applying for a government or public-sector role", contactTitle: "Operations Coordinator",
    sections: [
      { id: "summary", label: "Summary of Qualifications", type: "text", content: "Operations coordinator with 4+ years of experience in public-facing service delivery, records accuracy, and cross-department coordination within regulated processes." },
      { id: "qualifications", label: "Core Qualifications", type: "bullets", items: ["Policy and procedure compliance in a regulated environment", "Public-facing service delivery and complaint resolution", "Records management and accurate documentation", "Cross-department coordination and reporting"] },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [adminJob] },
      { id: "education", label: "Education", type: "education", degrees: [standardEducation] },
      { id: "certifications", label: "Certifications", type: "bullets", items: ["Government Records Management, Level 1 (2022)"] },
    ],
  },
  {
    id: "teaching-education", group: "Specialized fields", label: "Teaching",
    persona: "I work in education", contactTitle: "Elementary Teacher",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Licensed elementary teacher with 3+ years designing differentiated lesson plans and managing an inclusive classroom of 25+ students." },
      { id: "certifications", label: "Certifications & Licenses", type: "bullets", items: ["Ontario College of Teachers (OCT) certification — active", "First Aid & CPR — current"] },
      { id: "experience", label: "Teaching Experience", type: "jobs", jobs: [{ role: "Grade 4 Teacher", company: "Maple Ridge Public School", period: "2021 – Present", bullets: ["Designed differentiated lesson plans for a class of 27 students with a wide range of reading levels", "Led parent-teacher conferences and maintained ongoing communication with 27 families", "Piloted a peer-mentoring reading program adopted school-wide the following year"] }] },
      { id: "education", label: "Education", type: "education", degrees: [{ degree: "Bachelor of Education (B.Ed.)", school: "Western University", location: "London, ON", period: "2018 – 2020" }] },
      { id: "skills", label: "Skills", type: "bullets", items: ["Differentiated instruction", "Classroom management", "Google Classroom & digital learning tools"] },
    ],
  },
  {
    id: "trades-skilled-labor", group: "Specialized fields", label: "Trades",
    persona: "I work in a skilled trade", contactTitle: "Warehouse & Logistics Associate",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Reliable warehouse associate with 4+ years operating powered equipment and maintaining inventory accuracy in fast-paced distribution environments." },
      { id: "certifications", label: "Certifications & Licenses", type: "bullets", items: ["Forklift Operator Certification — current", "WHMIS Certified"] },
      { id: "experience", label: "Work Experience", type: "jobs", jobs: [retailJob] },
      { id: "skills", label: "Skills", type: "bullets", items: ["Powered equipment operation (forklift, pallet jack)", "Inventory counts & discrepancy reporting", "Safety procedure compliance"] },
      { id: "education", label: "Education", type: "education", degrees: [gradedHighSchoolEducation] },
    ],
  },
  {
    id: "internship-focused", group: "Getting started", label: "Internship",
    persona: "I'm applying for an internship", contactTitle: "Marketing Student",
    sections: [
      { id: "objective", label: "Objective", type: "text", content: "Marketing student seeking a summer internship to apply coursework in digital marketing and analytics in a real client-facing environment." },
      { id: "education", label: "Education", type: "education", degrees: [inProgressBizEducation] },
      { id: "coursework", label: "Relevant Coursework & Skills", type: "bullets", items: ["Digital Marketing Strategy", "Consumer Behavior", "Google Analytics & Excel", "Social media content scheduling"] },
      { id: "experience", label: "Experience & Activities", type: "jobs", jobs: [internExperience] },
    ],
  },
  {
    id: "remote-digital-first", group: "Independent work", label: "Remote / Digital-First",
    persona: "I want a resume built for remote roles", contactTitle: "Software Engineer (Remote)",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Remote-first software engineer with 3+ years shipping production features on fully distributed teams across time zones, using async-first communication and documentation." },
      { id: "skills", label: "Skills", type: "bullets", items: ["Async collaboration (Slack, Notion, Loom)", "Python, TypeScript, PostgreSQL", "Distributed team code review & documentation practices"] },
      { id: "experience", label: "Remote Experience", type: "jobs", jobs: [softwareJob] },
      { id: "education", label: "Education", type: "education", degrees: [bachelorCsEducation] },
    ],
  },
  {
    id: "nonprofit-community", group: "Specialized fields", label: "Non-Profit / Community",
    persona: "I work in non-profit or community services", contactTitle: "Program Coordinator",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Community-focused program coordinator with 4+ years supporting service delivery and volunteer teams in a non-profit setting." },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [adminJob] },
      { id: "volunteer", label: "Volunteer & Community Involvement", type: "bullets", items: ["Volunteer Coordinator, Ottawa Community Food Bank (2020 – Present) — manages a rotating team of 15 volunteers", "Board Member, Neighbourhood Youth Mentorship Program (2022 – Present)"] },
      { id: "education", label: "Education", type: "education", degrees: [standardEducation] },
      { id: "skills", label: "Skills", type: "bullets", items: ["Volunteer recruitment & scheduling", "Community outreach", "Grant reporting basics"] },
    ],
  },
  {
    id: "creative-portfolio", group: "Specialized fields", label: "Creative / Portfolio",
    persona: "I'm in a creative or content-focused field", contactTitle: "Content & Social Media Coordinator",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Content and social media coordinator with 2+ years planning and producing campaigns across owned channels, from concept through publishing and performance reporting." },
      { id: "skills", label: "Skills", type: "bullets", items: ["Content planning & editorial calendars", "Adobe Creative Suite (Photoshop, Premiere Rush)", "Copywriting for social & email", "Analytics & performance reporting"] },
      { id: "work", label: "Selected Work", type: "bullets", items: ["Launch campaign for a seasonal product line — 340K organic impressions across Instagram and TikTok (2024)", "Redesigned the brand's email newsletter template, lifting click-through rate by 22% (2023)", "Produced a 6-part video series for a client rebrand, from scripting through final edit (2023)"] },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [{ role: "Content & Social Media Coordinator", company: "Clearline Media", period: "2022 – Present", bullets: ["Plan and publish a weekly content calendar across 4 social platforms for 3 client accounts", "Write and edit copy for social posts, email campaigns, and landing pages", "Report weekly performance metrics to clients and adjust content strategy based on results"] }] },
      { id: "education", label: "Education", type: "education", degrees: [undergradBizEducation] },
    ],
  },
  {
    id: "team-lead-supervisor", group: "Leadership", label: "Team Lead / Supervisor",
    persona: "I lead a small team but I'm not applying for an executive role", contactTitle: "Customer Service Team Lead",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Customer service team lead with 3+ years supervising front-line staff and coordinating daily operations, promoted from within after consistently exceeding individual performance targets." },
      { id: "leadership", label: "Leadership Highlights", type: "bullets", items: ["Supervise a team of 8 customer service representatives across two shifts", "Built the team's onboarding checklist, cutting new-hire ramp time by one week", "Run weekly team huddles to review metrics and share coaching feedback"] },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [{ role: "Customer Service Team Lead", company: "BrightPath Retail", period: "2022 – Present", bullets: ["Promoted from Customer Service Representative after 2 years for consistently exceeding satisfaction targets", "Handle escalated customer issues that front-line staff are unable to resolve", "Schedule shift coverage for a team of 8, balancing staffing needs against labor budget", "Conduct monthly one-on-ones and performance check-ins with direct reports"] }] },
      { id: "skills", label: "Skills", type: "bullets", items: ["Team scheduling & coverage planning", "Coaching and performance feedback", "Escalation handling", "CRM systems: Salesforce, Zendesk"] },
      { id: "education", label: "Education", type: "education", degrees: [standardEducation] },
    ],
  },
  // ── US-only slot ──
  {
    id: "military-to-civilian", group: "Government & public sector", label: "Military to Civilian", countries: ["US"],
    persona: "I'm transitioning from military service", contactTitle: "Logistics & Operations Professional",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Logistics professional transitioning from 6 years of U.S. Army service, where I managed supply readiness and led junior personnel across two overseas deployments. Bringing proven reliability under pressure to a civilian operations or supply chain role." },
      { id: "translation", label: "Skills Translation", type: "bullets", items: ["Military: Unit supply & equipment readiness → Civilian: Inventory & supply chain management", "Military: Junior soldier supervision & training → Civilian: Team leadership & onboarding", "Military: Equipment audit compliance → Civilian: Process compliance & quality control"] },
      { id: "experience", label: "Military & Professional Experience", type: "jobs", jobs: [militaryJob] },
      { id: "education", label: "Training & Education", type: "education", degrees: [armyTraining, militaryHighSchoolEducation] },
    ],
  },
  // ── Canada-only slot ──
  {
    id: "bilingual-en-fr", group: "Experienced", label: "Bilingual (English/French)", countries: ["CA"],
    persona: "I want to highlight that I work in both English and French", contactTitle: "Bilingual Service Desk Analyst",
    sections: [
      { id: "summary", label: "Summary", type: "text", content: "Bilingual customer-focused professional with 4+ years supporting English- and French-speaking clients across phone and chat channels. Comfortable working in either language day-to-day." },
      { id: "languages", label: "Languages", type: "bullets", items: ["English: Native / Fluent (spoken, written, comprehension)", "French: Fluent (spoken, written, comprehension)"] },
      { id: "skills", label: "Skills", type: "bullets", items: ["CRM & ticketing systems (Zendesk, Salesforce)", "Conflict resolution and de-escalation", "Cross-department escalation"] },
      { id: "experience", label: "Professional Experience", type: "jobs", jobs: [customerServiceJob] },
      { id: "education", label: "Education", type: "education", degrees: [standardEducation] },
    ],
  },
];

const SHARED_VARIANT_IDS = STRUCTURE_VARIANTS.filter((v) => !v.countries).map((v) => v.id);

export const COUNTRY_VARIANT_MAP = {
  CA: [...SHARED_VARIANT_IDS, "bilingual-en-fr"],
  US: [...SHARED_VARIANT_IDS, "military-to-civilian"],
};

const VARIANTS_BY_ID = Object.fromEntries(STRUCTURE_VARIANTS.map((v) => [v.id, v]));

const COUNTRY_CONTACT_DEFAULTS = {
  CA: { name: "John Doe", phone: "(555) 019-0142", email: "john.doe@email.com", location: "Ottawa, ON" },
  US: { name: "John Doe", phone: "(555) 246-0198", email: "john.doe@email.com", location: "Dallas, TX" },
};

// Returns the ordered list of structure variants offered for a country —
// what the picker UI renders. Falls back to CA's set for any country not
// yet in COUNTRY_VARIANT_MAP rather than showing an empty picker.
export function getVariantsForCountry(countryCode) {
  const ids = COUNTRY_VARIANT_MAP[countryCode] || COUNTRY_VARIANT_MAP.CA;
  return ids.map((id) => VARIANTS_BY_ID[id]).filter(Boolean);
}

// Assembles a full resumeData object ({contact, sections}) for one
// country+structure pick. Deep-cloned so editing the result (onEdit
// mutates resumeData in place elsewhere) never touches this shared library
// data — the same JSON.parse(JSON.stringify(...)) pattern Resume.js
// already uses for the original prebuiltResumes.js entries.
export function buildResumeFromTemplate(countryCode, variantId) {
  const variant = VARIANTS_BY_ID[variantId];
  if (!variant) return null;
  const contactDefaults = COUNTRY_CONTACT_DEFAULTS[countryCode] || COUNTRY_CONTACT_DEFAULTS.CA;
  return JSON.parse(JSON.stringify({
    contact: { ...contactDefaults, title: variant.contactTitle },
    sections: variant.sections,
  }));
}
