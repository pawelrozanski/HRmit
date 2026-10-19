import type { Competencies, CvSummary } from '../../schemas.ts'

/**
 * Pre-recorded AI output for the demo, keyed by fixture candidate id. Written by hand in the
 * same descriptive register the prompts ask for: what the CV says, never what to do about it.
 * Job 1 entries follow the shared demo CV text (fixtures.cvText); jobs 2 and 3 are plausible
 * for their roles. Everyone here is invented.
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
        'Frontend developer with four years of professional React and TypeScript work. The current role at a scheduling company centres on a booking calendar and on build size and test coverage. Previous agency experience includes marketing sites and design-system tasks. A 2020 BSc in Computer Science is listed, along with Polish and English.',
      highlights: [
        'Owns a booking calendar feature end to end',
        'Design-system work at an agency',
        'BSc Computer Science, 2020',
      ],
    },
    competencies: {
      competencies: [
        {
          name: 'Component architecture',
          evidence: 'Design-system work and a calendar feature owned since 2022.',
        },
        { name: 'Testing', evidence: 'Component tests introduced on the current product.' },
        { name: 'Bilingual communication', evidence: 'Polish and English listed under skills.' },
      ],
    },
  },
  3: {
    summary: {
      summary:
        'Frontend developer whose CV covers four years of React and TypeScript, split between a scheduling product and a digital agency. The scheduling role mentions a booking calendar, component tests and a smaller bundle. The agency role mentions marketing sites, a design system and accessibility audits. Education is a BSc in Computer Science from 2020.',
      highlights: [
        'React, TypeScript, testing, accessibility',
        'Two employers since 2020',
        'Marketing sites and design-system work',
      ],
    },
    competencies: {
      competencies: [
        { name: 'React', evidence: 'Named in the summary line and in both roles.' },
        { name: 'Accessibility', evidence: 'Audits at the agency; WCAG 2.1 under skills.' },
        {
          name: 'Build optimisation',
          evidence: 'Bundle size reduction stated for the current role.',
        },
      ],
    },
  },
  4: {
    summary: {
      summary:
        'Four-year frontend developer with React and TypeScript across two employers. At the scheduling company the CV lists ownership of the booking calendar, the introduction of component tests and a one-third bundle reduction. At the agency the work was marketing sites, design-system components and accessibility audits. Completed a BSc in Computer Science in 2020.',
      highlights: [
        'Booking calendar ownership',
        'Component tests introduced',
        'Accessibility audits',
        'BSc Computer Science',
      ],
    },
    competencies: {
      competencies: [
        { name: 'TypeScript', evidence: 'Listed in the summary and skills for both roles.' },
        { name: 'Testing', evidence: 'Introduced component tests for the calendar.' },
        { name: 'Accessibility', evidence: 'Audits at the agency and WCAG 2.1 under skills.' },
      ],
    },
  },
  5: {
    summary: {
      summary:
        'Frontend developer with four years of React and TypeScript experience. The CV describes a scheduling product role focused on a booking calendar, tests and bundle size, preceded by agency work on marketing sites and a design system. Accessibility appears both as audit work and as a listed skill. Education is a BSc in Computer Science, 2020.',
      highlights: [
        'React and TypeScript since 2020',
        'Accessibility audits and WCAG 2.1',
        'Polish and English',
      ],
    },
    competencies: {
      competencies: [
        { name: 'React and TypeScript', evidence: 'Both roles and the skills section.' },
        { name: 'Design systems', evidence: 'Design-system work at the agency.' },
        { name: 'Accessibility', evidence: 'Audits and WCAG 2.1 listed.' },
      ],
    },
  },
  6: {
    summary: {
      summary:
        'Frontend developer, four years in React and TypeScript. The current scheduling-product role covers a booking calendar, component tests and bundle-size work; the earlier agency role covers marketing sites, design-system tasks and accessibility audits. The CV lists a 2020 BSc in Computer Science and Polish and English.',
      highlights: [
        'Owns the booking calendar at a scheduling product',
        'Cut bundle size by a third',
        'Design-system and accessibility work at an agency',
      ],
    },
    competencies: {
      competencies: [
        { name: 'Frontend engineering', evidence: 'Four years in React and TypeScript.' },
        { name: 'Performance', evidence: 'Bundle size cut by a third.' },
        { name: 'Testing', evidence: 'Component tests introduced.' },
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
}
