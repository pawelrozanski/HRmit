import type { MatchStatus } from '../schemas.ts'

/**
 * Demo CVs, keyed by fixture candidate id: the body under the name and contact line, which the
 * demo store adds. Every person and company here is invented. Candidate 1 has none here: they
 * keep the shared demo CV (fixtures.cvText), the text a demo upload attaches for anyone else.
 */
export const cvs: Record<number, string> = {
  2: `Frontend developer with three years of React, most of it in JavaScript, moving to TypeScript over the last year.

Experience
2023 - present: Frontend Developer, Brightcart (fictional), an online shop for home goods. Product pages and checkout in React; migrated the cart to TypeScript in 2025; unit tests with Jest.
2021 - 2023: Junior Web Developer, Pixel Harbor (fictional). Vue 2 landing pages and email templates.

Education
BSc Information Technology, 2021.

Skills
React, JavaScript, TypeScript (one year), Jest, Tailwind CSS, HTML, CSS, Git.

Languages
Polish (native), English (B2).`,
  3: `Junior frontend developer with a year and a half of commercial React and TypeScript after a coding bootcamp.

Experience
2025 - present: Junior Frontend Developer, Foxglove Studio (fictional), an agency. React and TypeScript dashboards for client projects; end-to-end tests in Cypress; handoff from Figma.
2024: Frontend bootcamp, 12 weeks: semantic HTML, CSS, JavaScript, React.

Education
BA Graphic Design, 2023.

Skills
React, TypeScript, Cypress, Material UI, Figma, HTML, CSS.

Languages
English (C1), Polish (native).`,
  4: `Senior frontend developer with seven years of React and TypeScript, the last three on an HR product used by recruiters.

Experience
2022 - present: Senior Frontend Developer, Peoplewise (fictional), an applicant tracking SaaS for mid-size companies. Led the accessibility programme to WCAG 2.1 AA, built the Tailwind-based design system, introduced Playwright end-to-end tests next to Testing Library component tests.
2018 - 2022: Frontend Developer, Ledgerly (fictional), B2B accounting software. React and TypeScript, Storybook, unit tests with Jest.

Education
MSc Computer Science, 2018.

Skills
React, TypeScript, Testing Library, Playwright, Tailwind CSS, Storybook, WCAG 2.1, semantic HTML.

Languages
English (C1, daily at work), Polish (native).`,
  5: `Backend-leaning full-stack developer: five years of Java and Node.js services, one year of React on the side.

Experience
2021 - present: Software Engineer, Routewise (fictional), B2B logistics software. Java and Node.js services, PostgreSQL, unit tests with JUnit and Jest; since 2025 occasional React and TypeScript screens for the internal admin panel.
2020 - 2021: Junior Java Developer, Datafold (fictional).

Education
MSc Software Engineering, 2020.

Skills
Java, Spring, Node.js, TypeScript, PostgreSQL, Docker, JUnit, Jest, React (basic).

Languages
Norwegian (native), English (C1), Polish (A2).`,
  6: `Angular developer with four years on public-sector portals, now learning React.

Experience
2022 - present: Frontend Developer, Civicform (fictional), forms and portals for local authorities. Angular and TypeScript; accessibility to WCAG 2.1 AA required by contract; unit tests with Jasmine and Karma; Cypress end-to-end tests.
2021 - 2022: Junior Frontend Developer, the same company.

Education
BEng Computer Science, 2021.

Courses
React for Angular developers, online course, 2025; a React side project (a recipe planner).

Skills
Angular, TypeScript, RxJS, Jasmine, Cypress, semantic HTML, CSS.

Languages
Polish (native), English (B1).`,
  7: `HR business partner with seven years in people roles at two software companies.

Experience
2021 - present: HR Business Partner, Quillstack (fictional), a 300-person software company. Partner to the engineering leads on hiring plans, onboarding and development paths; designed the structured interview process with shared scorecards; trained hiring managers on interview technique; quarterly engagement surveys.
2019 - 2021: HR Specialist, Northbeam (fictional). Recruitment and onboarding; employment contracts prepared together with the legal team.

Education
MA Psychology, 2017.

Languages
Polish (native), English (C1).`,
  8: `HR generalist with five years of experience, most recently in a 200-person product company.

Experience
2022 - present: HR Generalist, Tilework (fictional). Owned the hiring pipeline for engineering, onboarding of new managers and the annual review cycle; migrated the company to a new applicant tracking system and wrote its interview guides.
2021 - 2022: HR Assistant, Marlow Foods (fictional). Contracts, leave and terminations under the Polish labour code.

Education
BA Management, 2020.

Languages
Polish (native), English (B2).`,
  9: `Recruiter moving towards a business-partner role, with four years of in-house technical recruiting.

Experience
2022 - present: Technical Recruiter, Datanest (fictional). Sourcing and structured interviews for backend and data teams; candidate feedback debriefs; pipeline metrics reported to leadership; a diversity-sourcing initiative.
2021 - 2022: Recruitment Coordinator, Hirefold (fictional).

Education
BA Sociology, 2021. Certificate in Polish employment law, 2024.

Languages
Polish (native), English (C1).`,
  10: `Senior HR business partner with ten years in HR, the last six in a multinational consulting firm.

Experience
2020 - present: Senior HR Business Partner, Ashgrove Consulting (fictional). Supports a 400-person business unit: reorganisations, salary benchmarking, succession planning, works-council consultations under Polish law, assessment centres for promotions.
2017 - 2020: HR Business Partner, Kestrel Bank (fictional). 2016 - 2017: HR Specialist, the same bank.

Education
MA Human Resource Management, 2016. Certified coach (ICF ACC), 2021.

Languages
Ukrainian (native), Polish (C1), English (C1).`,
  11: `People partner with six years in a startup that grew from 30 to 250 people.

Experience
2023 - present: People Partner, Sparkline (fictional). Partner to the engineering managers; built the levelling framework with salary bands, the onboarding programme and a structured interview loop; runs the company mentoring scheme.
2020 - 2023: HR Generalist, the same company.

Education
BA Psychology, 2020. Postgraduate course in HR management, including labour law, 2022.

Languages
Polish (native), English (C1).`,
  12: `Customer support specialist with three years at a B2B invoicing SaaS.

Experience
2023 - present: Customer Support Specialist, Billbright (fictional). Email and chat tickets in English and Polish in Zendesk; maintains the help centre; escalates bugs to engineering with reproduction steps; wrote articles and macros that cut repeat questions.

Education
BA English Philology, 2023.

Languages
Polish (native), English (C1).`,
  13: `Support professional with five years across two SaaS companies.

Experience
2023 - present: Tier-2 Support Specialist, Calendo (fictional), a scheduling product. Troubleshooting for customers escalated from tier 1, onboarding calls, co-owner of the status page during incidents, trainer for new support hires; Intercom.
2021 - 2023: Support Agent, Fieldnote (fictional). Phone, email and chat in Italian and English.

Education
BA Linguistics, 2021.

Languages
Italian (native), English (C2), Polish (C1).`,
  14: `Customer service representative with two years in an e-commerce contact centre and one year in a software helpdesk.

Experience
2025 - present: Helpdesk Agent, Keyline Software (fictional). Account setup and password issues by phone, email and chat in Freshdesk; logs tickets for the IT team.
2023 - 2025: Contact Centre Agent, Shopmonde (fictional). Orders and refunds by phone, email and chat.

Education
Vocational qualification in business administration, 2023.

Languages
Spanish (native), English (B2), Polish (B1).`,
  15: `Recent graduate with a year of part-time helpdesk work and an internship at a logistics software company.

Experience
2025 - 2026: IT Helpdesk Assistant (part-time), University of Lowmoor (fictional). Account resets and first-line questions by email; documented common issues in the helpdesk wiki.
2025: Intern, Cargologic (fictional). Shadowed the support team on customer calls and filed bug reports in Jira.

Education
BA Information Management, 2026.

Languages
Polish (native), English (C1), German (B2).`,
  16: `Content marketer with four years of writing for B2B software companies.

Experience
2023 - present: Content Marketing Specialist, Shiftly (fictional), a B2B workforce-scheduling SaaS. Blog and help-centre articles in English and Polish, keyword research in Ahrefs, reporting in Google Analytics 4, the monthly customer newsletter and the editorial calendar.
2022 - 2023: Junior Copywriter, Wordhouse (fictional), an agency for software clients.

Portfolio
Twenty published articles linked from the CV.

Education
MA English Studies, 2022.

Languages
Polish (native), English (C1).`,
  17: `Journalist with six years at a consumer news site, now moving into marketing.

Experience
2020 - present: Staff Writer, The Daily Lantern (fictional), consumer news and features. Two to three articles a week, a weekly email newsletter, story planning with the editors; one sponsored whitepaper for a software company; basic SEO headlines with the web team.

Portfolio
Clips linked from the CV.

Education
BA Journalism, 2020.

Languages
English (native).`,
  18: `Social media manager with three years at a fashion brand.

Experience
2023 - present: Social Media Manager, Velvet Row (fictional), a fashion label. Instagram and TikTok content, captions and short blog posts, the monthly content calendar, campaign results in Google Analytics 4 and Meta Business Suite; designs in Canva.

Education
BA Cultural Studies, 2023.

Languages
Polish (C1), Swedish (native), English (B2).`,
}

type Check = [MatchStatus, string]

/**
 * Recorded answers of the CV-against-requirements check (ADR 0010) for the demo, one per line
 * of the candidate's job, requirements then nice-to-haves, in the job's order. Written in the
 * register the prompt asks for: what the CV says about the requirement, nothing about the person.
 */
export const requirementChecks: Record<number, Check[]> = {
  1: [
    ['met', 'Four years with React since 2020, in two roles.'],
    ['met', 'TypeScript named in the summary and under skills.'],
    ['met', 'Accessibility audits at the agency; WCAG 2.1 under skills.'],
    ['met', 'Introduced component tests for the booking calendar.'],
    ['partial', 'English is listed, without a level.'],
    ['missing', 'No end-to-end testing tool is mentioned.'],
    ['partial', 'Design-system work at the agency; Tailwind is not named.'],
    ['partial', 'A scheduling product; the CV does not say whether it is B2B.'],
  ],
  2: [
    ['met', 'Three years of React at Brightcart, since 2023.'],
    ['partial', 'TypeScript for one year, since the 2025 cart migration.'],
    ['partial', 'HTML and CSS are listed; accessibility or WCAG is not mentioned.'],
    ['met', 'Unit tests with Jest in the current role.'],
    ['met', 'English (B2).'],
    ['missing', 'No end-to-end testing tool is mentioned.'],
    ['met', 'Tailwind CSS under skills.'],
    ['missing', 'Consumer e-commerce and an agency; no B2B or HR product.'],
  ],
  3: [
    ['partial', 'A year and a half of commercial React, since 2025.'],
    ['met', 'React and TypeScript dashboards in the current role.'],
    ['partial', 'Semantic HTML and CSS from the bootcamp; WCAG is not mentioned.'],
    ['partial', 'End-to-end tests in Cypress; no unit or component tests mentioned.'],
    ['met', 'English (C1).'],
    ['met', 'End-to-end tests in Cypress.'],
    ['partial', 'Material UI and Figma handoff; no Tailwind or own design system.'],
    ['missing', 'Agency client projects; no B2B or HR product named.'],
  ],
  4: [
    ['met', 'Seven years of React and TypeScript since 2018.'],
    ['met', 'TypeScript in both roles.'],
    ['met', 'Led the accessibility programme to WCAG 2.1 AA.'],
    ['met', 'Testing Library component tests and Jest unit tests.'],
    ['met', 'English (C1), daily at work.'],
    ['met', 'Introduced Playwright end-to-end tests.'],
    ['met', 'Built the Tailwind-based design system.'],
    ['met', 'An applicant tracking SaaS and B2B accounting software.'],
  ],
  5: [
    ['partial', 'React only since 2025, for occasional admin screens.'],
    ['met', 'TypeScript under skills and in the admin panel work.'],
    ['missing', 'No HTML, CSS or accessibility work is mentioned.'],
    ['met', 'Unit tests with JUnit and Jest.'],
    ['met', 'English (C1).'],
    ['missing', 'No end-to-end testing tool is mentioned.'],
    ['missing', 'No Tailwind or design system is mentioned.'],
    ['met', 'B2B logistics software since 2021.'],
  ],
  6: [
    ['partial', 'React only from a 2025 course and a side project; four years of Angular.'],
    ['met', 'TypeScript with Angular since 2021.'],
    ['met', 'Portals built to WCAG 2.1 AA; semantic HTML under skills.'],
    ['met', 'Unit tests with Jasmine and Karma.'],
    ['partial', 'English (B1), below the B2 asked for.'],
    ['met', 'Cypress end-to-end tests.'],
    ['missing', 'No Tailwind or design system is mentioned.'],
    ['missing', 'Public-sector portals; no B2B or HR product.'],
  ],
  7: [
    ['met', 'Seven years in HR, five of them as HR business partner.'],
    ['met', 'Designed the structured interview process with shared scorecards.'],
    ['met', 'Hiring plans and development paths with the engineering leads.'],
    [
      'partial',
      'Employment contracts prepared with the legal team; labour law itself is not named.',
    ],
    ['met', 'Polish (native), English (C1).'],
    ['met', 'Partner to engineering leads at a software company.'],
    ['missing', 'No coaching or mentoring qualification is listed.'],
    ['missing', 'No salary or compensation work is mentioned.'],
  ],
  8: [
    ['partial', 'Five years in HR, as a generalist and an assistant; no business-partner role.'],
    ['partial', 'Wrote the interview guides; running the interviews is not stated.'],
    ['partial', 'Owned the engineering hiring pipeline; development paths are not mentioned.'],
    ['met', 'Contracts, leave and terminations under the Polish labour code.'],
    ['partial', 'English (B2), below the C1 asked for.'],
    ['met', 'Hiring pipeline for engineering.'],
    ['missing', 'No coaching or mentoring qualification is listed.'],
    ['partial', 'Ran the annual review cycle; salary benchmarking is not mentioned.'],
  ],
  9: [
    [
      'partial',
      'Four years of technical recruiting after a year as coordinator; no business-partner role yet.',
    ],
    ['met', 'Structured interviews and feedback debriefs.'],
    ['partial', 'Pipeline metrics reported to leadership; no hiring or development plans.'],
    ['met', 'Certificate in Polish employment law, 2024.'],
    ['met', 'Polish (native), English (C1).'],
    ['met', 'Recruiting for backend and data teams.'],
    ['missing', 'No coaching or mentoring qualification is listed.'],
    ['missing', 'No salary or compensation work is mentioned.'],
  ],
  10: [
    ['met', 'Ten years in HR, nine of them as HR business partner.'],
    ['partial', 'Assessment centres for promotions; hiring interviews are not mentioned.'],
    ['met', 'Succession planning and reorganisations with a 400-person unit.'],
    ['met', 'Works-council consultations under Polish law.'],
    ['met', 'Polish (C1), English (C1).'],
    ['missing', 'A consulting firm and a bank; no engineering or product teams named.'],
    ['met', 'Certified coach (ICF ACC), 2021.'],
    ['met', 'Salary benchmarking for the business unit.'],
  ],
  11: [
    ['met', 'Six years in HR, three as people partner.'],
    ['met', 'Built a structured interview loop.'],
    ['met', 'Levelling framework and work with the engineering managers.'],
    ['partial', 'A postgraduate HR course that included labour law; no practice described.'],
    ['met', 'Polish (native), English (C1).'],
    ['met', 'Partner to the engineering managers.'],
    ['partial', 'Runs the mentoring scheme; no qualification listed.'],
    ['partial', 'Salary bands in the levelling framework; no benchmarking or reviews.'],
  ],
  12: [
    ['met', 'Polish (native), English (C1); tickets in both.'],
    ['met', 'Three years of customer support since 2023.'],
    ['met', 'Email and chat tickets.'],
    ['met', 'Escalates bugs with reproduction steps.'],
    ['met', 'Zendesk.'],
    ['met', 'Maintains the help centre and wrote its articles.'],
    ['missing', 'No language besides Polish and English.'],
  ],
  13: [
    ['met', 'Polish (C1), English (C2).'],
    ['met', 'Five years of SaaS support.'],
    ['met', 'Phone, email and chat.'],
    ['met', 'Tier-2 troubleshooting of escalated cases.'],
    ['met', 'Intercom.'],
    ['partial', 'Trained new hires; help-center articles are not mentioned.'],
    ['met', 'Italian (native).'],
  ],
  14: [
    ['partial', 'English (B2) and Polish (B1); Polish below the B2 asked for.'],
    ['met', 'Three years across a contact centre and a helpdesk.'],
    ['met', 'Email and chat in both roles.'],
    ['partial', 'Logs tickets for the IT team; reproduction steps are not described.'],
    ['met', 'Freshdesk, a comparable help-center tool.'],
    ['missing', 'No help-center articles are mentioned.'],
    ['met', 'Spanish (native).'],
  ],
  15: [
    ['met', 'Polish (native), English (C1).'],
    ['partial', 'A year of part-time helpdesk work and an internship.'],
    ['partial', 'Email at the helpdesk; chat is not mentioned.'],
    ['partial', 'Filed bug reports in Jira as an intern.'],
    ['missing', 'Jira only; no help-center tool such as Zendesk or Intercom.'],
    ['partial', 'Documented common issues in the helpdesk wiki.'],
    ['met', 'German (B2).'],
  ],
  16: [
    ['met', 'Four years of writing for B2B software companies.'],
    ['met', 'English (C1); articles in English.'],
    ['met', 'Twenty published articles linked.'],
    ['met', 'Keyword research in Ahrefs.'],
    ['met', 'Reporting in Google Analytics 4.'],
    ['met', 'Articles in Polish as well; Polish native.'],
    ['met', 'The monthly customer newsletter.'],
    ['met', 'Owns the editorial calendar.'],
  ],
  17: [
    ['partial', 'Six years of consumer news; one whitepaper for a software company.'],
    ['met', 'English (native), a staff writer.'],
    ['met', 'Clips linked from the CV.'],
    ['partial', 'SEO headlines with the web team; no keyword research.'],
    ['missing', 'No analytics tool is mentioned.'],
    ['missing', 'English only.'],
    ['met', 'A weekly email newsletter.'],
    ['met', 'Story planning with the editors.'],
  ],
  18: [
    ['missing', 'Three years at a fashion brand; no B2B or SaaS writing.'],
    ['partial', 'English (B2), below the C1 asked for.'],
    ['partial', 'Short blog posts; no portfolio of articles is linked.'],
    ['missing', 'No SEO or keyword research is mentioned.'],
    ['met', 'Campaign results in Google Analytics 4.'],
    ['met', 'Polish (C1).'],
    ['missing', 'No email newsletter is mentioned.'],
    ['met', 'The monthly content calendar.'],
  ],
}
