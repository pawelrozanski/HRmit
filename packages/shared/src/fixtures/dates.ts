// Relative dates, so the demo dashboard stays alive: computed when the module loads. Seeding
// the local database happens once, so there they are simply the first-run dates.
const DAY = 86_400_000

/** Now shifted by `days`, at `hour`:00 local time when given. */
export const daysFromNow = (days: number, hour?: number) => {
  const d = new Date(Date.now() + days * DAY)
  if (hour !== undefined) d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
