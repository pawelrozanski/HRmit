import type { Candidate } from '@hrmit/shared'
import type { TFunction } from 'i18next'

/** In blind mode the label is derived, never stored: "Candidate #<id>". */
export const candidateName = (
  c: Pick<Candidate, 'id' | 'firstName' | 'lastName'>,
  blind: boolean,
  t: TFunction,
) => (blind ? t('candidates.anonymous', { id: c.id }) : `${c.firstName} ${c.lastName}`)
