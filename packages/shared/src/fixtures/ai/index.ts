import type { Competencies, CvSummary } from '../../schemas.ts'

/**
 * Pre-recorded AI output for the demo, keyed by fixture candidate id. Written by hand in the
 * same descriptive register the prompts ask for: what the CV says, never what to do about it.
 * Each entry follows that candidate's demo CV (fixtures.cvs; candidate 1 has the shared
 * fixtures.cvText). Everyone here is invented.
 */
export const ai: Record<number, { summary: CvSummary; competencies: Competencies }> = {
  1: {
    summary: {
      summary:
        'Frontend developer with four years of experience in React and TypeScript. Currently owns the booking calendar at a scheduling product, where the CV mentions introducing component tests and reducing bundle size. Earlier work at a digital agency covered marketing sites, design-system components and accessibility audits. Holds a BSc in Computer Science from 2020 and lists Polish and English.',
      highlights: [
        'Four years with React and TypeScript',
        'Introduced component tests on the current team',
        'Accessibility audits against WCAG 2.1',
        'Polish and English',
      ],
    },
    competencies: {
      competencies: [
        { name: 'React and TypeScript', evidence: 'Four years in two frontend roles since 2020.' },
        {
          name: 'Accessibility',
          evidence: 'WCAG 2.1 audits listed under the agency role and skills.',
        },
        { name: 'Testing', evidence: 'Introduced component tests for the booking calendar.' },
        { name: 'Performance work', evidence: 'The CV states the bundle size was cut by a third.' },
      ],
    },
  },
  2: {
    summary: {
      summary:
        'Frontend developer with three years of React at an online shop for home goods, mostly in JavaScript, with a move to TypeScript during a 2025 cart migration. The current role covers product pages, checkout and unit tests with Jest. Earlier work at an agency was Vue 2 landing pages and email templates. Education is a BSc in Information Technology from 2021.',
      highlights: [
        'Three years of React in e-commerce',
        'Migrated the cart to TypeScript in 2025',
        'Unit tests with Jest',
        'Tailwind CSS under skills',
      ],
    },
    competencies: {
      competencies: [
        { name: 'React', evidence: 'Product pages and checkout since 2023.' },
        { name: 'Unit testing', evidence: 'Jest tests in the current role.' },
        { name: 'Styling with Tailwind', evidence: 'Tailwind CSS listed under skills.' },
      ],
    },
  },
  3: {
    summary: {
      summary:
        'Junior frontend developer with a year and a half of commercial React and TypeScript at an agency, after a twelve-week bootcamp. The CV describes client dashboards, Cypress end-to-end tests and handoff from Figma. A BA in Graphic Design from 2023 precedes the move into development.',
      highlights: [
        'React and TypeScript dashboards for client projects',
        'End-to-end tests in Cypress',
        'Design background, BA Graphic Design',
        'English (C1)',
      ],
    },
    competencies: {
      competencies: [
        { name: 'React and TypeScript', evidence: 'Client dashboards since 2025.' },
        { name: 'End-to-end testing', evidence: 'Cypress tests in the current role.' },
        { name: 'Design handoff', evidence: 'Works from Figma; graphic design degree.' },
      ],
    },
  },
  4: {
    summary: {
      summary:
        'Senior frontend developer with seven years of React and TypeScript, the last three on an applicant tracking SaaS. The CV describes leading an accessibility programme to WCAG 2.1 AA, building a Tailwind-based design system and introducing Playwright next to Testing Library. Earlier work was B2B accounting software with Storybook and Jest. Education is an MSc in Computer Science, 2018.',
      highlights: [
        'Seven years of React and TypeScript',
        'Led an accessibility programme to WCAG 2.1 AA',
        'Built a Tailwind design system',
        'Playwright and Testing Library',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Accessibility', evidence: 'Led the WCAG 2.1 AA programme.' },
        { name: 'Design systems', evidence: 'Built the Tailwind-based design system.' },
        { name: 'Testing', evidence: 'Playwright, Testing Library and Jest.' },
        { name: 'HR product domain', evidence: 'Three years on an applicant tracking SaaS.' },
      ],
    },
  },
  5: {
    summary: {
      summary:
        'Full-stack developer whose CV centres on five years of Java and Node.js services for B2B logistics software, with React and TypeScript used since 2025 for occasional internal admin screens. Testing is described with JUnit and Jest, and the stack includes PostgreSQL and Docker. Education is an MSc in Software Engineering, 2020.',
      highlights: [
        'Five years of backend services',
        'React only for internal admin screens',
        'B2B logistics domain',
        'English (C1)',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Backend services', evidence: 'Java and Node.js since 2020.' },
        { name: 'TypeScript', evidence: 'Node.js services and admin screens.' },
        { name: 'Testing', evidence: 'JUnit and Jest.' },
      ],
    },
  },
  6: {
    summary: {
      summary:
        'Angular developer with four years on public-sector portals built to WCAG 2.1 AA, with unit tests in Jasmine and Karma and end-to-end tests in Cypress. React appears only through a 2025 online course and a side project. Education is a BEng in Computer Science, 2021; English is listed at B1.',
      highlights: [
        'Four years of Angular and TypeScript',
        'Accessibility required by contract',
        'Cypress end-to-end tests',
        'React from a course and a side project',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Accessibility', evidence: 'Portals built to WCAG 2.1 AA.' },
        { name: 'TypeScript', evidence: 'Angular and RxJS since 2021.' },
        { name: 'Testing', evidence: 'Jasmine, Karma and Cypress.' },
      ],
    },
  },
  7: {
    summary: {
      summary:
        'HR business partner with seven years in people roles at two software companies. The CV describes partnering with engineering leads on hiring plans, onboarding and development paths, and designing a structured interview process with shared scorecards. It mentions training hiring managers on interview technique and running quarterly engagement surveys. Education is a master’s degree in psychology, 2017.',
      highlights: [
        'Seven years in HR roles at software companies',
        'Designed a structured interview process',
        'Trained hiring managers',
        'MA in Psychology, 2017',
      ],
    },
    competencies: {
      competencies: [
        {
          name: 'Structured interviewing',
          evidence: 'Designed scorecards and trained interviewers.',
        },
        {
          name: 'Business partnering',
          evidence: 'Hiring plans and development paths with engineering leads.',
        },
        { name: 'Onboarding', evidence: 'Owned onboarding for two teams.' },
        { name: 'Employee engagement', evidence: 'Quarterly surveys and follow-up actions.' },
      ],
    },
  },
  8: {
    summary: {
      summary:
        'HR generalist with five years of experience, most recently in a 200-person product company. The CV lists ownership of the hiring pipeline for engineering, onboarding of new managers and coordination of annual reviews. It mentions migrating the company to a new applicant tracking system and writing its interview guides. Education is a bachelor’s degree in management.',
      highlights: [
        'Five years in HR, latest role in a product company',
        'Migrated the company to a new ATS',
        'Wrote interview guides',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Recruitment operations', evidence: 'Owned the engineering hiring pipeline.' },
        {
          name: 'Process documentation',
          evidence: 'Wrote interview guides during the ATS migration.',
        },
        { name: 'Manager onboarding', evidence: 'Onboarded new managers.' },
      ],
    },
  },
  9: {
    summary: {
      summary:
        'Recruiter moving towards a business-partner role, with four years of in-house technical recruiting. The CV describes sourcing and interviewing for backend and data teams, running candidate feedback debriefs and reporting pipeline metrics to leadership. It also lists a diversity-sourcing initiative and a certificate in employment law. Education is a bachelor’s degree in sociology.',
      highlights: [
        'Four years of in-house technical recruiting',
        'Ran structured debriefs and pipeline reporting',
        'Employment law certificate',
      ],
    },
    competencies: {
      competencies: [
        {
          name: 'Technical recruiting',
          evidence: 'Sourced and interviewed for backend and data teams.',
        },
        { name: 'Data reporting', evidence: 'Pipeline metrics reported to leadership.' },
        { name: 'Inclusive sourcing', evidence: 'Led a diversity-sourcing initiative.' },
      ],
    },
  },
  10: {
    summary: {
      summary:
        'Senior HR business partner with ten years of experience, the last six in a multinational consulting firm. The CV describes supporting a 400-person business unit, leading reorganisations, salary benchmarking and succession planning. It lists coaching qualifications and experience with works-council consultations. Education is a master’s degree in human resource management.',
      highlights: [
        'Ten years in HR, six as senior HRBP',
        'Supported a 400-person business unit',
        'Salary benchmarking and succession planning',
        'Coaching qualification',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Organisational change', evidence: 'Led reorganisations in a consulting firm.' },
        { name: 'Compensation', evidence: 'Salary benchmarking for a business unit.' },
        { name: 'Coaching', evidence: 'Listed coaching qualification and manager coaching.' },
        { name: 'Employee relations', evidence: 'Works-council consultations.' },
      ],
    },
  },
  11: {
    summary: {
      summary:
        'HR professional with six years of experience in a fast-growing startup that scaled from 30 to 250 people. The CV describes building the first HR processes from scratch: levelling framework, onboarding programme and a structured interview loop. It mentions partnering with engineering managers and running a mentoring scheme. Education is a bachelor’s degree in psychology with an HR postgraduate course.',
      highlights: [
        'Scaled HR processes from 30 to 250 people',
        'Built a levelling framework and interview loop',
        'Ran a mentoring scheme',
      ],
    },
    competencies: {
      competencies: [
        {
          name: 'Process design',
          evidence: 'Built levelling, onboarding and interview loops from scratch.',
        },
        { name: 'Engineering partnership', evidence: 'Worked directly with engineering managers.' },
        { name: 'Mentoring programmes', evidence: 'Ran a company-wide mentoring scheme.' },
      ],
    },
  },
  12: {
    summary: {
      summary:
        'Customer support specialist with three years at a B2B invoicing SaaS. The CV describes handling email and chat tickets in English and Polish, maintaining a help centre and escalating bugs to engineering with reproduction steps. It mentions reducing repeat questions by writing articles and macros. Education is a bachelor’s degree in English philology.',
      highlights: [
        'Three years in B2B SaaS support',
        'Bilingual email and chat support',
        'Maintained a help centre',
        'Wrote reproduction steps for engineering',
      ],
    },
    competencies: {
      competencies: [
        {
          name: 'Written communication',
          evidence: 'Ticket work in English and Polish; help-centre articles.',
        },
        { name: 'Knowledge management', evidence: 'Articles and macros for repeat questions.' },
        { name: 'Bug triage', evidence: 'Escalations with reproduction steps.' },
      ],
    },
  },
  13: {
    summary: {
      summary:
        'Support professional with five years of experience across two SaaS companies. The CV describes tier-2 support for a scheduling product, onboarding calls with new customers and co-ownership of the status page during incidents. It mentions Italian, English and Polish, and a period as the team’s trainer for new hires. Education is a bachelor’s degree in linguistics.',
      highlights: [
        'Five years of SaaS support, tier 2',
        'Customer onboarding calls',
        'Trained new support hires',
        'Italian, English and Polish',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Technical troubleshooting', evidence: 'Tier-2 support for a scheduling product.' },
        { name: 'Training', evidence: 'Onboarded new support hires.' },
        { name: 'Incident communication', evidence: 'Co-owned the status page.' },
        { name: 'Multilingual support', evidence: 'Three working languages listed.' },
      ],
    },
  },
  14: {
    summary: {
      summary:
        'Customer service representative with two years in an e-commerce contact centre and one year in a software helpdesk. The CV lists phone, email and chat channels, order and refund handling, and a move to the helpdesk where the work shifted to account setup and password issues. It mentions Spanish, English and Polish. Education is a vocational qualification in business administration.',
      highlights: [
        'Three years across contact centre and helpdesk',
        'Phone, email and chat channels',
        'Spanish, English and Polish',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Multichannel support', evidence: 'Phone, email and chat listed.' },
        {
          name: 'Account administration',
          evidence: 'Account setup and access issues at the helpdesk.',
        },
        { name: 'Languages', evidence: 'Spanish, English and Polish.' },
      ],
    },
  },
  15: {
    summary: {
      summary:
        'Recent graduate with one year of part-time support experience at a university IT helpdesk and an internship at a logistics software company. The CV describes resetting accounts, documenting common issues in a wiki and shadowing the internship team on customer calls. It lists German, English and Polish. Education is a bachelor’s degree in information management, 2026.',
      highlights: [
        'One year of helpdesk work, part-time',
        'Documented common issues in a wiki',
        'Internship at a logistics software company',
        'German, English and Polish',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Helpdesk support', evidence: 'Account resets and first-line questions.' },
        { name: 'Documentation', evidence: 'Wiki of common issues.' },
        { name: 'Languages', evidence: 'German, English and Polish.' },
      ],
    },
  },
  16: {
    summary: {
      summary:
        'Content marketer with four years of writing for B2B software companies, currently at a workforce-scheduling SaaS. The CV describes blog and help-centre articles in English and Polish, keyword research in Ahrefs, reporting in Google Analytics 4, a monthly customer newsletter and ownership of the editorial calendar. Twenty published articles are linked. Education is an MA in English Studies, 2022.',
      highlights: [
        'Four years of B2B SaaS content',
        'Writes in English and Polish',
        'Ahrefs and Google Analytics 4',
        'Owns the editorial calendar',
      ],
    },
    competencies: {
      competencies: [
        { name: 'B2B content writing', evidence: 'Blog and help-centre articles since 2022.' },
        { name: 'SEO', evidence: 'Keyword research in Ahrefs.' },
        { name: 'Analytics', evidence: 'Reporting in Google Analytics 4.' },
        { name: 'Editorial planning', evidence: 'Editorial calendar and monthly newsletter.' },
      ],
    },
  },
  17: {
    summary: {
      summary:
        'Journalist with six years as a staff writer at a consumer news site, writing two to three articles a week and a weekly email newsletter, and planning stories with the editors. The CV mentions one sponsored whitepaper for a software company and SEO headlines written with the web team. Education is a BA in Journalism, 2020; English is the only language listed.',
      highlights: [
        'Six years of news writing',
        'Weekly email newsletter',
        'One whitepaper for a software company',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Writing at pace', evidence: 'Two to three articles a week since 2020.' },
        { name: 'Newsletters', evidence: 'A weekly email newsletter.' },
        { name: 'Editorial planning', evidence: 'Story planning with the editors.' },
      ],
    },
  },
  18: {
    summary: {
      summary:
        'Social media manager with three years at a fashion label, producing Instagram and TikTok content, captions and short blog posts. The CV lists a monthly content calendar, campaign results in Google Analytics 4 and Meta Business Suite, and designs in Canva. Education is a BA in Cultural Studies, 2023; Swedish, Polish and English are listed.',
      highlights: [
        'Three years of social media content',
        'Monthly content calendar',
        'Google Analytics 4 and Meta Business Suite',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Social media content', evidence: 'Instagram and TikTok since 2023.' },
        { name: 'Content planning', evidence: 'The monthly content calendar.' },
        { name: 'Campaign reporting', evidence: 'Google Analytics 4 and Meta Business Suite.' },
      ],
    },
  },
}
