/**
 * prebuiltResumes.js — the pre-built "My Resumes" content, as its own
 * data-only module (no components, no other imports) so it can be reused
 * anywhere without dragging in whatever else happens to import it. Split
 * out of Resume.js specifically so the landing page's real-example
 * showcase (SeeItHappenSection.js) can render actual product output —
 * via the real ResumeDocument.js renderer, same content already shipped
 * inside the product — without pulling Resume.js's entire dependency
 * tree (3D scenes, docx export, country detection) into the marketing
 * page's bundle just to read one plain object out of it.
 */

// ── The four pre-built resumes (unchanged) ─────────────────────────────────────
export const RESUMES = {
  it: {
    label: "IT Support",
    title: "Bilingual Service Desk Analyst",
    contact: {
      name:  "John Doe",
      title: "Bilingual Service Desk Analyst",
      phone: "(555) 019-0142",
      email: "john.doe@email.com",
      location: "Ottawa, ON",
    },
    sections: [
      {
        id: "objective", label: "Objective", type: "text",
        content: "Customer-focused and technically inclined professional seeking a Level 1 Help Desk and IT Support role. Brings strong communication skills, bilingual proficiency (English and French), and hands-on experience troubleshooting hardware, software, and network issues. Committed to delivering excellent end-user support, resolving tickets efficiently, and escalating issues as needed in a fast-paced IT environment.",
      },
      {
        id: "skills", label: "Technical Skills & Qualifications", type: "bullets",
        items: [
          "End-user support: password resets, account management, software installation and configuration",
          "Microsoft 365 (M365), MS Teams and MS Exchange: navigating and supporting users day-to-day",
          "Microsoft Windows OS: installation, configuration and troubleshooting",
          "Active Directory: adding and removing user accounts and managing access",
          "Hardware troubleshooting: printer setup, network connectivity and peripheral devices",
          "ITSM and ticketing systems: creating, tracking and escalating support tickets",
          "Knowledge base usage: applying FAQs, troubleshooting guides and standard procedures",
          "Bilingual: English and French (spoken, written and comprehension)",
        ],
      },
      {
        id: "experience", label: "Experience", type: "jobs",
        jobs: [
          {
            role: "Grocery Clerk & Customer Support",
            company: "Farm Boy",
            period: "2021 – 2025",
            bullets: [
              "Served as front-line resource for customer inquiries, resolving issues calmly and professionally in real time — directly paralleling L1 help desk interactions",
              "Communicated clearly with both non-technical customers and supervisors, adapting tone and language based on the audience",
              "Managed inventory discrepancies by identifying, documenting and escalating problems to management — mirroring ticket creation and escalation in an ITSM environment",
              "Operated and maintained powered equipment applying safety standards and following documented procedures",
              "Maintained consistent communication with team leads, flagging operational issues and supporting colleagues",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "Business Accounting — Diploma", school: "Algonquin College", location: "Ottawa, Ontario", period: "Jan 2023 – Jan 2024" },
          { degree: "Computer Science — Bachelor", school: "Humber College", location: "Toronto, Ontario", period: "Jan 2018 – Jan 2022" },
        ],
      },
      {
        id: "qualifications", label: "Additional Qualifications", type: "bullets",
        items: [
          "Strong problem-solving skills with an ability to work through issues systematically",
          "Comfortable interacting with both technical and non-technical users; patient, clear and professional",
          "Self-motivated and able to work with minimal supervision in a structured support environment",
          "Positive attitude, punctual and dependable; clean certificate of conduct available upon request",
          "Flexible availability, including evening and weekend shifts",
        ],
      },
    ],
  },

  grocery: {
    label: "Grocery Clerk",
    title: "Grocery Clerk",
    contact: {
      name:  "John Doe",
      title: "Grocery Clerk",
      phone: "(555) 019-0142",
      email: "john.doe@email.com",
      location: "Ottawa, ON",
    },
    sections: [
      {
        id: "objective", label: "Objective", type: "text",
        content: "Skilled grocery store clerk with 4+ years of experience providing excellent customer service, increasing customer loyalty, and supporting colleagues. Eager to apply meticulous attention to detail and proficiency in retail environments to drive efficient inventory management and contribute to critical supply chain operations.",
      },
      {
        id: "interests", label: "Profile", type: "text",
        content: "Willing to work in a retail environment with minimal supervision. Able to perform repetitive tasks while maintaining a high level of quality control, consistency, and a positive attitude.",
      },
      {
        id: "experience", label: "Experience", type: "jobs",
        jobs: [
          {
            role: "Grocery Clerk",
            company: "Farm Boy",
            period: "2021 – 2025",
            bullets: [
              "Ensured shelves are fully stocked with high-quality products, including rotating stock, checking expiration dates, and maintaining proper signage and pricing",
              "Maintained accurate inventory levels by conducting regular stock counts and reporting discrepancies to management using Microsoft Excel and Python",
              "Provided exceptional floor service to customers by greeting them, answering questions, and helping them find products",
              "Safely operated powered equipment such as forklifts and pallet jacks",
              "Kept communication lines open with supervisors and adhered to safety standards and procedures",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "Business Accounting — Diploma", school: "Algonquin College", location: "Ottawa, Ontario", period: "Jan 2023 – Jan 2024" },
          { degree: "Supply Chain Management — Advanced Diploma", school: "Humber College", location: "Toronto, Ontario", period: "Jan 2018 – Jan 2020" },
        ],
      },
      {
        id: "skills", label: "Skills & Qualifications", type: "bullets",
        items: [
          "Strong work ethic and a positive attitude",
          "Ability to lift and carry up to 70 lbs",
          "Teamwork skills and flexibility for night shift",
          "Clean certificate of conduct",
          "Time management and attention to detail skills",
        ],
      },
    ],
  },

  admin: {
    label: "Admin & Coordinator",
    title: "Bilingual Administrative & Customer Service Coordinator",
    contact: {
      name:  "John Doe",
      title: "Bilingual Administrative & Customer Service Coordinator",
      phone: "(555) 019-0142",
      email: "john.doe@email.com",
      location: "Ottawa, ON",
    },
    sections: [
      {
        id: "objective", label: "Objective", type: "text",
        content: "Bilingual administrative and customer service professional with 4+ years of experience supporting customer inquiries, order coordination, documentation, and day-to-day business operations. Proficient with Google Workspace and Microsoft Office. Recognized for strong communication, accuracy, organization, and problem-solving skills.",
      },
      {
        id: "skills", label: "Core Competencies", type: "bullets",
        items: [
          "Client Relationship Management & Customer Service",
          "Order Intake & Order Processing",
          "Data Entry & Documentation",
          "Administrative Support",
          "Google Workspace (Gmail, Docs, Sheets) & Microsoft Office Suite",
          "Inventory Management & Invoicing",
          "Stakeholder Communication & Business Development Support",
          "English & French Communication",
        ],
      },
      {
        id: "experience", label: "Experience", type: "jobs",
        jobs: [
          {
            role: "Customer Service & Operations Associate",
            company: "Giant Tiger",
            period: "2021 – 2025",
            bullets: [
              "Served as first point of contact for customer inquiries, requests, and issue resolution",
              "Built and maintained positive customer relationships through professional and timely service",
              "Maintained accurate records and completed data entry with strong attention to detail",
              "Resolved customer issues efficiently while ensuring a positive customer experience",
              "Collaborated with supervisors and team members to support daily operational objectives",
              "Demonstrated strong organizational skills managing multiple priorities in a fast-paced environment",
            ],
          },
          {
            role: "Order Processing Associate",
            company: "Metro Distribution Centre",
            period: "2018 – 2019",
            bullets: [
              "Processed customer orders and verified order details for accuracy",
              "Maintained inventory and order records in a fast-paced environment",
              "Coordinated with team members to meet service and delivery timelines",
              "Followed established procedures and safety standards",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "Business Accounting — Diploma", school: "Algonquin College", location: "Ottawa, Ontario", period: "Jan 2023 – Jan 2024" },
          { degree: "Supply Chain Management — Advanced Diploma", school: "Humber College", location: "Toronto, Ontario", period: "Jan 2018 – Jan 2020" },
        ],
      },
      {
        id: "qualifications", label: "Additional Qualifications", type: "bullets",
        items: [
          "Fluent in English and French",
          "Strong customer-centric mindset with excellent verbal and written communication",
          "Self-motivated, results-driven, and a quick learner",
          "Professional, dependable, and detail-oriented",
        ],
      },
    ],
  },

  popeye: {
    label: "Pop-Eye & Retail",
    title: "Grocery Clerk",
    contact: {
      name:  "John Doe",
      title: "Grocery Clerk",
      phone: "(555) 019-0142",
      email: "john.doe@email.com",
      location: "Ottawa, ON",
    },
    sections: [
      {
        id: "objective", label: "Objective", type: "text",
        content: "Skilled grocery store clerk with 4+ years of experience providing excellent customer service, increasing customer loyalty, and supporting colleagues. Eager to apply meticulous attention to detail and proficiency in retail environments to drive efficient inventory management.",
      },
      {
        id: "interests", label: "Profile", type: "text",
        content: "Willing to work in a retail environment with minimal supervision. Able to perform repetitive tasks while maintaining a high level of quality control, consistency, and a positive attitude.",
      },
      {
        id: "experience", label: "Experience", type: "jobs",
        jobs: [
          {
            role: "Grocery Clerk",
            company: "Farm Boy",
            period: "2021 – 2025",
            bullets: [
              "Ensured shelves are fully stocked with high-quality products, including rotating stock, checking expiration dates, and maintaining proper signage and pricing",
              "Maintained accurate inventory levels by conducting regular stock counts and reporting any discrepancies to management",
              "Provided exceptional floor service to customers by greeting them, answering questions, and helping them find products",
              "Safely operated powered equipment such as forklifts and pallet jacks",
              "Kept the communication lines open with supervisors and adhered to safety standards and procedures",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "Business Accounting — Diploma", school: "Algonquin College", location: "Ottawa, Ontario", period: "Jan 2023 – Jan 2024" },
          { degree: "Supply Chain Management — Advanced Diploma", school: "Humber College", location: "Toronto, Ontario", period: "Jan 2018 – Jan 2020" },
        ],
      },
      {
        id: "skills", label: "Skills & Qualifications", type: "bullets",
        items: [
          "Strong work ethic and a positive attitude",
          "Ability to lift and carry up to 70 lbs",
          "Teamwork skills and flexibility for night shift",
          "Clean certificate of conduct",
          "Time management and attention to detail skills",
        ],
      },
    ],
  },

  // ── International formats — same person, same role, written the way each
  // market actually expects it. The differences are deliberate, not
  // cosmetic: what's a normal section elsewhere (date of birth, marital
  // status, named referees) is either required convention or a hard no
  // depending on the country, and getting that wrong reads as a mistake to
  // a local recruiter even when everything else on the page is strong.
  usa: {
    label: "USA · ATS Format",
    title: "Customer Service Representative",
    contact: {
      name: "John Doe",
      title: "Customer Service Representative",
      phone: "(555) 246-0198",
      email: "john.doe@email.com",
      location: "Dallas, TX",
    },
    sections: [
      {
        id: "summary", label: "Professional Summary", type: "text",
        content: "Customer-focused professional with 4+ years delivering high-volume phone and chat support. Skilled in CRM systems, conflict resolution, and cross-department escalation, with a consistent record of exceeding customer satisfaction targets. Seeking to bring strong communication and problem-solving skills to a fast-paced support team.",
      },
      {
        id: "skills", label: "Core Skills", type: "bullets",
        items: [
          "Customer Relationship Management (CRM) Software: Salesforce, Zendesk",
          "Conflict Resolution and De-escalation",
          "Multi-line Phone Systems and Live Chat Support",
          "Data Entry and Order Processing",
          "Team Collaboration and Cross-training",
          "Microsoft Office Suite (Word, Excel, Outlook)",
        ],
      },
      {
        id: "experience", label: "Professional Experience", type: "jobs",
        jobs: [
          {
            role: "Customer Service Representative",
            company: "BrightPath Retail",
            period: "2021 – Present",
            bullets: [
              "Resolved an average of 60+ customer inquiries daily via phone and live chat, maintaining a 96% satisfaction rating",
              "Reduced repeat-contact rate by 18% by documenting recurring issues and proposing a new FAQ workflow",
              "Trained 5 new hires on CRM software and company service standards",
              "Processed returns, exchanges, and order adjustments in accordance with company policy",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "High School Diploma", school: "Lincoln High School", location: "Dallas, TX", period: "2016" },
        ],
      },
    ],
  },

  uk: {
    label: "UK · CV Format",
    title: "Customer Service Representative",
    contact: {
      name: "John Doe",
      title: "Customer Service Representative",
      phone: "+44 7700 900312",
      email: "john.doe@email.com",
      location: "Manchester, UK",
    },
    sections: [
      {
        id: "statement", label: "Personal Statement", type: "text",
        content: "Reliable and personable customer service professional with over four years' experience handling telephone and email enquiries in fast-paced retail environments. Strong track record of resolving complaints efficiently while maintaining excellent customer relationships. Looking to bring a proactive, team-oriented approach to a new role.",
      },
      {
        id: "skills", label: "Key Skills", type: "bullets",
        items: [
          "Excellent telephone manner and written communication",
          "Complaint handling and conflict resolution",
          "Point of sale (POS) and stock management systems",
          "Strong attention to detail and time management",
          "Team leadership and new starter training",
        ],
      },
      {
        id: "experience", label: "Employment History", type: "jobs",
        jobs: [
          {
            role: "Customer Service Advisor",
            company: "Northgate Retail Group",
            period: "2020 – Present",
            bullets: [
              "Handled up to 50 customer enquiries per day across phone, email and in-store channels",
              "Achieved consistently high customer satisfaction scores, ranking in the top 10% of the regional team",
              "Supported the induction and training of 6 new team members",
              "Liaised with warehouse and logistics teams to resolve delivery and stock queries promptly",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "A-Levels: Business Studies, English, Mathematics", school: "Manchester Sixth Form College", location: "Manchester, UK", period: "2016 – 2018" },
        ],
      },
    ],
  },

  germany: {
    label: "Germany · Lebenslauf",
    title: "Kundenservice-Mitarbeiter",
    contact: {
      name: "John Doe",
      title: "Kundenservice-Mitarbeiter",
      phone: "+49 30 1234567",
      email: "john.doe@email.com",
      location: "Berlin, Deutschland",
    },
    sections: [
      {
        id: "personal", label: "Persönliche Daten", type: "bullets",
        items: [
          "Geburtsdatum: 14. März 1994",
          "Geburtsort: Frankfurt am Main",
          "Staatsangehörigkeit: Deutsch",
          "Familienstand: Ledig",
        ],
      },
      {
        id: "profil", label: "Profil", type: "text",
        content: "Kundenorientierter Servicemitarbeiter mit über vier Jahren Erfahrung im telefonischen und schriftlichen Kundenkontakt im Einzelhandel. Ausgeprägte Kommunikationsstärke sowie sicherer Umgang mit CRM-Systemen. Auf der Suche nach einer neuen Herausforderung in einem dynamischen Team.",
      },
      {
        id: "berufserfahrung", label: "Berufserfahrung", type: "jobs",
        jobs: [
          {
            role: "Kundenservice-Mitarbeiter",
            company: "Nordwest Handels GmbH",
            period: "2021 – heute",
            bullets: [
              "Bearbeitung von täglich bis zu 50 Kundenanfragen per Telefon und E-Mail",
              "Einarbeitung und Schulung von 5 neuen Mitarbeitenden im Kundenservice-Team",
              "Pflege der Kundendatenbank und Dokumentation wiederkehrender Anliegen",
              "Zusammenarbeit mit der Logistikabteilung zur Klärung von Lieferproblemen",
            ],
          },
        ],
      },
      {
        id: "ausbildung", label: "Ausbildung", type: "education",
        degrees: [
          { degree: "Fachabitur, Wirtschaft", school: "Berufskolleg Berlin-Mitte", location: "Berlin", period: "2016 – 2018" },
        ],
      },
      {
        id: "kenntnisse", label: "Kenntnisse & Fähigkeiten", type: "bullets",
        items: [
          "Sehr gute Deutsch- und Englischkenntnisse",
          "MS Office (Word, Excel, Outlook)",
          "CRM-Systeme: SAP, Zendesk",
        ],
      },
    ],
  },

  france: {
    label: "France · CV",
    title: "Représentant du Service Client",
    contact: {
      name: "John Doe",
      title: "Représentant du Service Client",
      phone: "+33 1 99 00 12 34",
      email: "john.doe@email.com",
      location: "Lyon, France",
    },
    sections: [
      {
        id: "profil", label: "Profil", type: "text",
        content: "Professionnel du service client avec plus de quatre ans d'expérience dans la gestion des demandes téléphoniques et par courriel dans le secteur de la distribution. Sens du contact, rigueur et bonne maîtrise des outils CRM. À la recherche d'un nouveau poste au sein d'une équipe dynamique.",
      },
      {
        id: "experience", label: "Expérience Professionnelle", type: "jobs",
        jobs: [
          {
            role: "Représentant du Service Client",
            company: "Groupe Distrival",
            period: "2021 – Présent",
            bullets: [
              "Traitement de 50 demandes clients par jour en moyenne, par téléphone et par courriel",
              "Formation de 5 nouveaux collaborateurs aux outils et procédures du service client",
              "Réduction de 15 % du taux de réclamations récurrentes grâce à une meilleure documentation",
              "Coordination avec le service logistique pour le suivi des livraisons",
            ],
          },
        ],
      },
      {
        id: "formation", label: "Formation", type: "education",
        degrees: [
          { degree: "Baccalauréat Professionnel, Commerce", school: "Lycée Professionnel Jean Moulin", location: "Lyon", period: "2016 – 2018" },
        ],
      },
      {
        id: "competences", label: "Compétences", type: "bullets",
        items: [
          "Gestion de la relation client (CRM) : Salesforce, Zendesk",
          "Excellent relationnel et sens de l'écoute",
          "Gestion des réclamations et résolution de conflits",
          "Pack Office (Word, Excel, Outlook)",
        ],
      },
      {
        id: "langues", label: "Langues", type: "bullets",
        items: [
          "Français : langue maternelle",
          "Anglais : courant (C1)",
        ],
      },
    ],
  },

  africa: {
    label: "Nigeria & Ghana · CV Format",
    title: "Customer Service Representative",
    contact: {
      name: "John Doe",
      title: "Customer Service Representative",
      phone: "+234 801 234 5678",
      email: "john.doe@email.com",
      location: "Lagos, Nigeria",
    },
    sections: [
      {
        id: "personal", label: "Personal Information", type: "bullets",
        items: [
          "Date of Birth: 14th March 1994",
          "Nationality: Nigerian",
          "Marital Status: Single",
          "State of Origin: Ogun State",
        ],
      },
      {
        id: "objective", label: "Career Objective", type: "text",
        content: "Dedicated and personable customer service professional with over four years of experience managing telephone, email and in-person customer enquiries in retail and telecommunications settings. Seeking to leverage strong communication skills and a proven record of customer satisfaction in a growing organisation.",
      },
      {
        id: "competencies", label: "Core Competencies", type: "bullets",
        items: [
          "Customer Relationship Management (CRM)",
          "Complaint Handling and Conflict Resolution",
          "Team Supervision and Staff Training",
          "Proficient in Microsoft Office Suite",
          "Excellent Verbal and Written Communication",
        ],
      },
      {
        id: "experience", label: "Work Experience", type: "jobs",
        jobs: [
          {
            role: "Customer Service Representative",
            company: "Zenith Retail Nigeria Ltd",
            period: "2021 – Present",
            bullets: [
              "Attended to an average of 50 customer enquiries daily across phone, email and walk-in channels",
              "Trained and supervised 4 new customer service staff",
              "Maintained accurate records of customer complaints and resolutions using the company's CRM system",
              "Liaised with the logistics unit to resolve delivery-related complaints promptly",
            ],
          },
        ],
      },
      {
        id: "education", label: "Education", type: "education",
        degrees: [
          { degree: "National Diploma (ND), Business Administration", school: "Yaba College of Technology", location: "Lagos, Nigeria", period: "2016 – 2018" },
        ],
      },
      {
        id: "referees", label: "Referees", type: "bullets",
        items: [
          "Mrs. Jane Smith — HR Manager, Zenith Retail Nigeria Ltd — jane.smith@email.com — +234 802 345 6789",
          "Mr. Michael Owusu — Operations Supervisor, Accra Trading Co. — michael.owusu@email.com — +233 24 123 4567",
        ],
      },
    ],
  },
};
