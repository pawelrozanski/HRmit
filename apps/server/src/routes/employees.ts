import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, getTableColumns, inArray, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import {
  employeeInputSchema,
  employeeNoteInputSchema,
  type Employee,
  type EmployeeWithTeams,
} from '@hrmit/shared'
import { db } from '../db/index.ts'
import { employeeNotes, employees, teamMembers, teams } from '../db/schema.ts'

// Plain SQL for the correlated count: drizzle drops the table qualifier in a single-table select.
const employeeColumns = {
  ...getTableColumns(employees),
  noteCount: sql<number>`(select count(*) from employee_notes where employee_notes.employee_id = employees.id)`,
}
const exists = async (id: number) =>
  (await db.select({ id: employees.id }).from(employees).where(eq(employees.id, id))).length > 0

/** Attach each employee's teams (one query for the whole list). */
export async function withTeams(
  rows: (Employee & { noteCount: number })[],
): Promise<EmployeeWithTeams[]> {
  if (rows.length === 0) return []
  const links = await db
    .select({
      employeeId: teamMembers.employeeId,
      id: teams.id,
      name: teams.name,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      inArray(
        teamMembers.employeeId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(teams.name)
  return rows.map((e) => ({
    ...e,
    teams: links
      .filter((l) => l.employeeId === e.id)
      .map(({ id, name, role }) => ({ id, name, role })),
  }))
}

const listQuery = validator('query', (q, c): { q?: string; teamId?: number } | Response => {
  const teamId = q.teamId === undefined ? undefined : Number(q.teamId)
  if (teamId !== undefined && !Number.isInteger(teamId))
    return c.json({ error: 'invalid teamId' }, 400)
  const text = typeof q.q === 'string' ? q.q.trim() : ''
  return { ...(text && { q: text }), ...(teamId !== undefined && { teamId }) }
})

export const employeesRoute = new Hono()
  .get('/', listQuery, async (c) => {
    const { q, teamId } = c.req.valid('query')
    // SQLite's LIKE is case-insensitive for ASCII only; lower() on both sides covers the rest.
    const pattern = q ? `%${q.toLowerCase()}%` : undefined
    const rows = await db
      .select(employeeColumns)
      .from(employees)
      .where(
        and(
          pattern
            ? or(
                sql`lower(${employees.firstName}) like ${pattern}`,
                sql`lower(${employees.lastName}) like ${pattern}`,
                sql`lower(${employees.position}) like ${pattern}`,
              )
            : undefined,
          teamId === undefined
            ? undefined
            : inArray(
                employees.id,
                db
                  .select({ id: teamMembers.employeeId })
                  .from(teamMembers)
                  .where(eq(teamMembers.teamId, teamId)),
              ),
        ),
      )
      .orderBy(employees.lastName, employees.firstName, employees.id)
    return c.json(await withTeams(rows))
  })
  .post('/', zValidator('json', employeeInputSchema), async (c) => {
    const [row] = await db
      .insert(employees)
      .values({ ...c.req.valid('json'), createdAt: new Date().toISOString() })
      .returning()
    return c.json({ ...row!, teams: [], noteCount: 0 }, 201)
  })
  .get('/:id', async (c) => {
    const rows = await db
      .select(employeeColumns)
      .from(employees)
      .where(eq(employees.id, Number(c.req.param('id'))))
    const [row] = await withTeams(rows)
    return row ? c.json(row) : c.json({ error: 'not found' }, 404)
  })
  .put('/:id', zValidator('json', employeeInputSchema), async (c) => {
    const rows = await db
      .update(employees)
      .set(c.req.valid('json'))
      .where(eq(employees.id, Number(c.req.param('id'))))
      .returning(employeeColumns)
    const [row] = await withTeams(rows)
    return row ? c.json(row) : c.json({ error: 'not found' }, 404)
  })
  // Hard delete (GDPR): memberships and notes go with the row through ON DELETE CASCADE.
  .delete('/:id', async (c) => {
    const rows = await db
      .delete(employees)
      .where(eq(employees.id, Number(c.req.param('id'))))
      .returning({ id: employees.id })
    return rows.length ? c.body(null, 204) : c.json({ error: 'not found' }, 404)
  })
  .get('/:id/notes', async (c) => {
    const id = Number(c.req.param('id'))
    if (!(await exists(id))) return c.json({ error: 'not found' }, 404)
    const rows = await db
      .select()
      .from(employeeNotes)
      .where(eq(employeeNotes.employeeId, id))
      .orderBy(desc(employeeNotes.createdAt), desc(employeeNotes.id))
    return c.json(rows)
  })
  .post('/:id/notes', zValidator('json', employeeNoteInputSchema), async (c) => {
    const id = Number(c.req.param('id'))
    if (!(await exists(id))) return c.json({ error: 'not found' }, 404)
    const [row] = await db
      .insert(employeeNotes)
      .values({ employeeId: id, ...c.req.valid('json'), createdAt: new Date().toISOString() })
      .returning()
    return c.json(row!, 201)
  })
  // A note is addressed through its own employee only: a foreign id answers 404.
  .delete('/:id/notes/:noteId', async (c) => {
    const rows = await db
      .delete(employeeNotes)
      .where(
        and(
          eq(employeeNotes.id, Number(c.req.param('noteId'))),
          eq(employeeNotes.employeeId, Number(c.req.param('id'))),
        ),
      )
      .returning({ id: employeeNotes.id })
    return rows.length ? c.body(null, 204) : c.json({ error: 'not found' }, 404)
  })
