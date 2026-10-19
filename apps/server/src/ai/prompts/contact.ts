/**
 * Prefill for the new-candidate form. Only ever sent to a local model: the CV of a person who
 * is not in the database yet cannot be anonymized, so it must not leave the machine.
 */
export const contactPrompt = (cvText: string) =>
  `Extract the candidate's own contact details from the CV below. Copy each value exactly as written and use an empty string for anything that is missing. Do not invent values and do not use the details of referees, employers or schools.

CV:
${cvText}`
