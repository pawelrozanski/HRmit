import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, getTableColumns, inArray, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  addMembersSchema,
  sendTeamEmailInputSchema,
  setMemberRoleSchema,
  teamInputSchema,
  type Team,
  type TeamDetail,
  type TeamSendResult,
} from '@hrmit/shared'
import { db } from '../db/index.ts'
import { employeeEmails, employees, jobs, teamMembers, teams } from '../db/schema.ts'
import { log } from '../log.ts'
import { SmtpNotConfigured } from '../mail/send.ts'
import { sendToEmployee } from './employees.ts'

const teamColumns = {
  id: teams.id,
  name: teams.name,
  description: teams.description,
  createdAt: teams.createdAt,
  // Plain SQL: drizzle drops the table qualifier of ${teams.id} in a single-table select list,
  // which would compare the subquery's own id column with itself.
  memberCount: sql<number>`(select count(*) from team_members where team_members.team_id = teams.id)`,
  openJobCount: sql<number>`(select count(*) from jobs where jobs.team_id = teams.id and jobs.status = 'open')`,
}

const listTeams = (id?: number): Promise<Team[]> =>
  db
    .select(teamColumns)
    .from(teams)
    .where(id === undefined ? undefined : eq(teams.id, id))
    .orderBy(teams.name)

async function detail(id: number): Promise<TeamDetail | undefined> {
  const [team] = await listTeams(id)
  if (!team) return undefined
  const members = await db
    .select({ ...getTableColumns(employees), role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(employees, eq(employees.id, teamMembers.employeeId))
    .where(eq(teamMembers.teamId, id))
    .orderBy(sql`${teamMembers.role} = 'lead' desc`, employees.lastName, employees.firstName)
  const teamJobs = await db.select().from(jobs).where(eq(jobs.teamId, id)).orderBy(jobs.id)
  return { ...team, members, jobs: teamJobs }
}

/** Another team with the same name, ignoring case (the unique index is the safety net). */
const nameTaken = (name: string, exceptId?: number) =>
  db
    .select({ id: teams.id })
    .from(teams)
    .where(
      and(
        sql`lower(${teams.name}) = lower(${name})`,
        exceptId === undefined ? undefined : ne(teams.id, exceptId),
      ),
    )
    .then((rows) => rows.length > 0)

const memberParam = (c: { req: { param: (k: string) => string } }) => ({
  teamId: Number(c.req.param('id')),
  employeeId: Number(c.req.param('employeeId')),
})

export const teamsRoute = new Hono()
  .get('/', async (c) => c.json(await listTeams()))
  .post('/', zValidator('json', teamInputSchema), async (c) => {
    const input = c.req.valid('json')
    if (await nameTaken(input.name)) return c.json({ error: 'name taken' }, 409)
    const [row] = await db
      .insert(teams)
      .values({ ...input, createdAt: new Date().toISOString() })
      .returning({ id: teams.id })
    return c.json((await detail(row!.id))!, 201)
  })
  .get('/:id', async (c) => {
    const team = await detail(Number(c.req.param('id')))
    return team ? c.json(team) : c.json({ error: 'not found' }, 404)
  })
  .put('/:id', zValidator('json', teamInputSchema), async (c) => {
    const id = Number(c.req.param('id'))
    const input = c.req.valid('json')
    if (await nameTaken(input.name, id)) return c.json({ error: 'name taken' }, 409)
    const rows = await db.update(teams).set(input).where(eq(teams.id, id)).returning()
    return rows.length ? c.json((await detail(id))!) : c.json({ error: 'not found' }, 404)
  })
  // Memberships cascade; jobs keep existing with team_id set to null (FK ON DELETE SET NULL).
  .delete('/:id', async (c) => {
    const rows = await db
      .delete(teams)
      .where(eq(teams.id, Number(c.req.param('id'))))
      .returning({ id: teams.id })
    return rows.length ? c.body(null, 204) : c.json({ error: 'not found' }, 404)
  })
  // Add many at once; employees already in the team are skipped, unknown ids are a 400.
  .post('/:id/members', zValidator('json', addMembersSchema), async (c) => {
    const teamId = Number(c.req.param('id'))
    if (!(await detail(teamId))) return c.json({ error: 'not found' }, 404)
    const { employeeIds } = c.req.valid('json')
    const known = await db
      .select({ id: employees.id })
      .from(employees)
      .where(inArray(employees.id, employeeIds))
    if (known.length !== new Set(employeeIds).size)
      return c.json({ error: 'unknown employee' }, 400)
    await db
      .insert(teamMembers)
      .values(known.map(({ id }) => ({ teamId, employeeId: id })))
      .onConflictDoNothing()
    return c.json((await detail(teamId))!)
  })
  .patch('/:id/members/:employeeId', zValidator('json', setMemberRoleSchema), async (c) => {
    const { teamId, employeeId } = memberParam(c)
    const rows = await db
      .update(teamMembers)
      .set(c.req.valid('json'))
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.employeeId, employeeId)))
      .returning()
    return rows.length ? c.json((await detail(teamId))!) : c.json({ error: 'not found' }, 404)
  })
  // Removes the membership only; the employee row stays.
  .delete('/:id/members/:employeeId', async (c) => {
    const { teamId, employeeId } = memberParam(c)
    const rows = await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.employeeId, employeeId)))
      .returning()
    return rows.length ? c.body(null, 204) : c.json({ error: 'not found' }, 404)
  })
  // History of what was sent from this team view, with the recipient's name; rows of a deleted
  // employee are gone with them.
  .get('/:id/emails', async (c) => {
    const teamId = Number(c.req.param('id'))
    if (!(await listTeams(teamId)).length) return c.json({ error: 'not found' }, 404)
    const rows = await db
      .select({
        ...getTableColumns(employeeEmails),
        name: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      })
      .from(employeeEmails)
      .innerJoin(employees, eq(employees.id, employeeEmails.employeeId))
      .where(eq(employeeEmails.teamId, teamId))
      .orderBy(desc(employeeEmails.sentAt), desc(employeeEmails.id))
    return c.json(rows)
  })
  // One mail per recipient, each sent on its own (no CC/BCC between people). All rows of one
  // send share sentAt, which is how the UI groups them.
  .post('/:id/emails', zValidator('json', sendTeamEmailInputSchema), async (c) => {
    const teamId = Number(c.req.param('id'))
    const team = await detail(teamId)
    if (!team) return c.json({ error: 'not found' }, 404)
    const { employeeIds, subject, body } = c.req.valid('json')
    const ids = [...new Set(employeeIds)]
    const members = team.members.filter((m) => ids.includes(m.id))
    if (members.length !== ids.length) return c.json({ error: 'not a member' }, 400)
    const result: TeamSendResult = { sent: [], failed: [] }
    const sentAt = new Date().toISOString()
    for (const m of members) {
      let row
      try {
        row = await sendToEmployee(m, { subject, body }, teamId, sentAt)
      } catch (err) {
        if (err instanceof SmtpNotConfigured) return c.json({ error: 'smtp not configured' }, 409)
        throw err
      }
      if (row.status === 'sent') result.sent.push(row)
      else
        result.failed.push({
          employeeId: m.id,
          name: `${m.firstName} ${m.lastName}`,
          error: row.error ?? '',
        })
    }
    log.info('team-email', { teamId, sent: result.sent.length, failed: result.failed.length })
    return c.json(result, 201)
  })
