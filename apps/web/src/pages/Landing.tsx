import { useLayoutEffect } from 'react'
import { Link } from 'react-router'
import dashboard from '../../../../docs/screenshots/dashboard.png'
import { Mark, Wordmark } from '../components/Brand.tsx'
import { applyTheme, readTheme } from '../theme.ts'
import { Button } from '@/components/ui/button.tsx'

// English only and always light: this is the public face of the project, not the app UI.
const REPO = 'https://github.com/pawelrozanski/HRmit'
const RELEASES = `${REPO}/releases`

const FEATURES = [
  {
    title: 'Local by default',
    text: 'A SQLite file and an uploads folder on your disk. The default AI model runs on your machine through Ollama. Backup is copying a folder.',
  },
  {
    title: 'AI assists, never judges',
    text: 'Summaries, competencies and structured interview questions. No scores, no rankings, no verdicts. The hire is always a human click.',
  },
  {
    title: 'Built for fairer hiring',
    text: 'Blind screening hides names and contact details. Every candidate for a job gets the same questions and the same criteria.',
  },
  {
    title: 'Anonymized before the cloud',
    text: 'Cloud models are opt-in with your own key. CVs are scrubbed locally first, and you can preview exactly what leaves the machine.',
  },
]

const RUN_LOCALLY = `git clone ${REPO}.git
cd HRmit
pnpm install
pnpm dev   # http://localhost:5173`

export function Landing() {
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = 'light'
    return () => applyTheme(readTheme())
  }, [])

  return (
    <main id="main" tabIndex={-1} className="min-h-screen bg-cream text-ink outline-none">
      <header className="border-b border-ink/10 bg-white/60">
        <div className="flex items-center justify-between px-8 py-4 lg:px-16 xl:px-24">
          <div className="flex items-center gap-3">
            <Mark className="h-9 w-auto" />
            <Wordmark className="text-2xl" />
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <a href={REPO} className="hover:text-brand-dark hover:underline">
              GitHub
            </a>
            <a href={`${REPO}/tree/main/docs`} className="hover:text-brand-dark hover:underline">
              Docs
            </a>
            <a
              href={`${REPO}/blob/main/CHANGELOG.md`}
              className="hover:text-brand-dark hover:underline"
            >
              Changelog
            </a>
            <Button asChild>
              <Link to="/demo">Try the demo</Link>
            </Button>
          </nav>
        </div>
      </header>
      <div className="max-w-[1600px] px-8 lg:px-16 xl:px-24">
        <section className="grid items-center gap-12 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-20 lg:py-24">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand-dark uppercase">
              Open-source applicant tracking
            </p>
            <h1 className="mt-4 text-5xl leading-tight font-black tracking-tight xl:text-6xl">
              Your recruitment data stays home.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink/75">
              <Wordmark /> is an applicant tracking system that runs on your own computer.
              Candidates, CVs and notes live in a local database. An AI assistant summarizes CVs and
              proposes interview questions, but every decision stays with you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-base">
                <Link to="/demo">Try the demo</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 bg-white px-5 text-base">
                <a href={RELEASES}>Releases</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-ink/65">
              The demo runs entirely in your browser on fictional data. Every release has notes and
              a Windows installer.
            </p>
          </div>
          <img
            src={dashboard}
            alt="HRmit dashboard with upcoming interviews, open recruitments and their funnels"
            className="w-full rounded-xl border border-ink/10 bg-white shadow-xl shadow-brand-dark/10"
          />
        </section>

        <section aria-labelledby="why" className="border-t border-ink/10 py-16">
          <h2 id="why" className="text-2xl font-bold">
            Why HRmit
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-xl border border-ink/10 bg-white p-6">
                <h3 className="font-semibold text-brand-dark">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/75">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="run"
          className="grid gap-10 border-t border-ink/10 py-16 lg:grid-cols-2"
        >
          <div>
            <h2 id="run" className="text-2xl font-bold">
              Run it yourself
            </h2>
            <p className="mt-4 max-w-lg text-ink/75">
              On Windows, download the installer from a release: it bundles Node and opens HRmit in
              your browser. Anywhere else, run it from source with Node 24 and pnpm. AI features
              need Ollama (free, local); the README covers cloud providers and Docker.
            </p>
            <a
              href={`${REPO}#readme`}
              className="mt-4 inline-block text-sm font-medium text-brand-dark underline"
            >
              Read the README
            </a>
          </div>
          <pre className="self-start overflow-x-auto rounded-xl bg-ink p-6 text-sm leading-relaxed text-white">
            <code>{RUN_LOCALLY}</code>
          </pre>
        </section>

        <footer className="border-t border-ink/10 py-8 text-sm text-ink/65">
          Open source, MIT licensed. All demo data is fictional.
        </footer>
      </div>
    </main>
  )
}
