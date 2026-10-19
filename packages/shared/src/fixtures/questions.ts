import type { InterviewQuestionInput } from '../schemas.ts'

/**
 * One question set per fixture job, keyed by job id. Seeds the local database on first run and
 * is what the demo "Generate with AI" returns. Behavioural, competency-based, the same for every
 * candidate of the job (ADR 0004).
 */
export const questions: Record<number, InterviewQuestionInput[]> = {
  1: [
    {
      competency: 'Component design',
      question:
        'Tell me about a React component you built that other developers reused. What made it easy or hard to reuse?',
    },
    {
      competency: 'Component design',
      question:
        'Describe a time you refactored a component that had grown too large. How did you decide where to split it?',
    },
    {
      competency: 'Accessibility',
      question:
        'Walk me through a form you made accessible. Which problems did you find and how did you test the result?',
    },
    {
      competency: 'Accessibility',
      question:
        'Tell me about a time you argued for an accessibility fix that was not on the plan. What happened?',
    },
    {
      competency: 'Collaboration',
      question:
        'Describe a disagreement with a designer or backend developer about an interface. How was it resolved?',
    },
    {
      competency: 'Collaboration',
      question: 'Tell me about a code review that changed your mind. What did you learn from it?',
    },
    {
      competency: 'Quality and testing',
      question:
        'Describe a bug that reached users. How did you find the cause and what did you change afterwards?',
    },
    {
      competency: 'Quality and testing',
      question:
        'Tell me about a time you introduced tests to code that had none. Where did you start and why?',
    },
  ],
  2: [
    {
      competency: 'Hiring process design',
      question:
        'Tell me about a hiring process you changed. What was wrong before and how did you measure the improvement?',
    },
    {
      competency: 'Hiring process design',
      question:
        'Describe how you introduced structured interviews to a team that was used to informal ones.',
    },
    {
      competency: 'Coaching managers',
      question:
        'Tell me about a hiring manager who was hard to work with. How did you build the relationship?',
    },
    {
      competency: 'Coaching managers',
      question:
        'Describe a time you gave a manager feedback about bias in an interview. How did you approach it?',
    },
    {
      competency: 'Onboarding and development',
      question:
        'Walk me through an onboarding plan you designed. What did you keep and what did you drop over time?',
    },
    {
      competency: 'Onboarding and development',
      question:
        'Tell me about an employee development path you helped create. How did you know it worked?',
    },
    {
      competency: 'Working with data',
      question:
        'Describe a decision you supported with HR data. Which numbers did you use and what did they not tell you?',
    },
  ],
  3: [
    {
      competency: 'Written communication',
      question:
        'Tell me about a difficult message you had to write to a customer. How did you structure it?',
    },
    {
      competency: 'Written communication',
      question:
        'Describe a time a customer misunderstood your reply. What did you change in how you write?',
    },
    {
      competency: 'Patience under pressure',
      question:
        'Tell me about an angry customer. What did you do in the first two minutes of the conversation?',
    },
    {
      competency: 'Patience under pressure',
      question:
        'Describe a day with far more tickets than usual. How did you decide what to do first?',
    },
    {
      competency: 'Turning questions into knowledge',
      question:
        'Tell me about a repeated question you turned into a help article or a product suggestion.',
    },
    {
      competency: 'Turning questions into knowledge',
      question:
        'Describe how you learned a product you had to support. What helped you most in the first weeks?',
    },
  ],
}
