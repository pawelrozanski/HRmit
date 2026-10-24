import {
  emailTemplateInputSchema,
  type BuiltInTemplateKey,
  type EmailTemplate,
  type EmailTemplateInput,
} from '@hrmit/shared'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client.ts'
import { useApi } from '@/api/useApi.ts'
import { Button } from '@/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { fieldErrors } from '@/lib/form.ts'

const PLACEHOLDERS = ['firstName', 'lastName', 'jobTitle', 'companyName', 'startsAt', 'jitsiUrl']

/** Display texts of a template: the stored ones, or the translated defaults of a built-in. */
export function useTemplateLabel() {
  const { t } = useTranslation()
  return {
    name: (x: EmailTemplate) => x.name ?? t(`templates.keys.${x.key as BuiltInTemplateKey}`),
    description: (x: EmailTemplate) =>
      x.description ??
      (x.builtIn ? t(`templates.descriptions.${x.key as BuiltInTemplateKey}`) : ''),
  }
}

/** A tile per template; clicking one opens the editor. 'new' is the empty editor. */
export function TemplatesSettings() {
  const { t } = useTranslation()
  const label = useTemplateLabel()
  // The dialog stays mounted while it closes and gets a fresh form per open through the counter
  // in its key. The tile that opened it is remembered so focus can go back there (there is no
  // DialogTrigger for Radix to return to).
  const [editing, setEditing] = useState<{
    n: number
    target: EmailTemplate | null
    opener: HTMLElement | null
  } | null>(null)
  const [open, setOpen] = useState(false)
  const list = useApi(() => api.api.templates.$get().then((r) => r.json()), [])
  const edit = (target: EmailTemplate | null, opener: HTMLElement) => {
    setEditing((e) => ({ n: (e?.n ?? 0) + 1, target, opener }))
    setOpen(true)
  }

  if (list.error) return <p className="text-destructive">{t('common.error')}</p>
  if (!list.data) return <p className="text-muted-foreground">{t('common.loading')}</p>

  const tile =
    'grid min-h-28 content-start gap-1 rounded-lg border bg-card p-4 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-xl font-semibold">{t('templates.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('templates.intro')}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.data.map((x) => (
          <li key={x.key} className="grid">
            <button type="button" onClick={(e) => edit(x, e.currentTarget)} className={tile}>
              <span className="font-semibold text-primary">{label.name(x)}</span>
              <span className="text-sm text-muted-foreground">{label.description(x)}</span>
            </button>
          </li>
        ))}
        <li className="grid">
          <button
            type="button"
            onClick={(e) => edit(null, e.currentTarget)}
            className={`${tile} place-content-center border-dashed text-muted-foreground`}
          >
            <span className="flex items-center gap-2">
              <Plus className="size-4" aria-hidden="true" /> {t('templates.new')}
            </span>
          </button>
        </li>
      </ul>
      {editing && (
        <TemplateDialog
          key={editing.n}
          template={editing.target}
          opener={editing.opener}
          open={open}
          onClose={() => setOpen(false)}
          onChange={(next) => {
            list.setData(next)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

type DialogProps = {
  template: EmailTemplate | null
  /** Gets focus back when the dialog closes, if it is still on the page. */
  opener: HTMLElement | null
  open: boolean
  onClose: () => void
  /** The server answers with one row; the dialog folds it into the list. */
  onChange: (next: (list: EmailTemplate[]) => EmailTemplate[]) => void
}

/** One form for new, custom and built-in templates; only the footer differs by kind. */
function TemplateDialog({ template, opener, open, onClose, onChange }: DialogProps) {
  const { t } = useTranslation()
  const label = useTemplateLabel()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = emailTemplateInputSchema.safeParse(
      Object.fromEntries(new FormData(e.currentTarget)),
    )
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, t))
    setErrors({})
    setBusy(true)
    const input: EmailTemplateInput = parsed.data
    const res = template
      ? await api.api.templates[':key'].$put({ param: { key: template.key }, json: input })
      : await api.api.templates.$post({ json: input })
    setBusy(false)
    if (res.status === 409) return setFailed(t('templates.nameTaken'))
    if (res.status !== 200 && res.status !== 201) return setFailed(t('form.saveFailed'))
    const row = await res.json()
    onChange((list) => (template ? list.map((x) => (x.key === row.key ? row : x)) : [...list, row]))
  }

  const remove = async () => {
    if (!template || !window.confirm(t('templates.deleteConfirm', { name: label.name(template) })))
      return
    const res = await api.api.templates[':key'].$delete({ param: { key: template.key } })
    if (res.status !== 204) return setFailed(t('form.saveFailed'))
    onChange((list) => list.filter((x) => x.key !== template.key))
  }

  const restore = async () => {
    if (!template || !window.confirm(t('templates.restoreConfirm'))) return
    const res = await api.api.templates[':key'].restore.$post({ param: { key: template.key } })
    if (res.status !== 200) return setFailed(t('form.saveFailed'))
    const row = await res.json()
    onChange((list) => list.map((x) => (x.key === row.key ? row : x)))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-2xl"
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          if (opener?.isConnected) opener.focus()
        }}
      >
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {template ? t('templates.edit', { name: label.name(template) }) : t('templates.new')}
            </DialogTitle>
            <DialogDescription>{t('templates.hint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-name">{t('templates.name')}</Label>
              <Input
                id="tpl-name"
                name="name"
                maxLength={80}
                defaultValue={template ? label.name(template) : ''}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-description">{t('templates.description')}</Label>
              <Input
                id="tpl-description"
                name="description"
                maxLength={200}
                defaultValue={template ? label.description(template) : ''}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-subject">{t('templates.subject')}</Label>
            <Input
              id="tpl-subject"
              name="subject"
              defaultValue={template?.subject ?? ''}
              aria-invalid={!!errors.subject}
            />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-body">{t('templates.body')}</Label>
            <Textarea
              id="tpl-body"
              name="body"
              rows={10}
              defaultValue={template?.body ?? ''}
              aria-invalid={!!errors.body}
            />
            {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {t('templates.placeholders')}
            {PLACEHOLDERS.map((p) => (
              <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                {`{{${p}}}`}
              </code>
            ))}
          </p>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {failed}
            </p>
          )}
          <DialogFooter className="sm:justify-between">
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {template?.builtIn && (
                <Button type="button" variant="outline" onClick={restore}>
                  <RotateCcw data-icon="inline-start" /> {t('templates.restore')}
                </Button>
              )}
              {template && !template.builtIn && (
                <Button type="button" variant="destructive" onClick={remove}>
                  <Trash2 data-icon="inline-start" /> {t('common.delete')}
                </Button>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={busy}>
                {t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
