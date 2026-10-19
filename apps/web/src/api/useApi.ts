import { useEffect, useState, type DependencyList } from 'react'

type State<T> = { data?: T; error?: unknown; loading: boolean }

/** Fetch on mount and whenever `deps` change. Good enough until there is a mutation to invalidate. */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList): State<T> {
  const [state, setState] = useState<State<T>>({ loading: true })
  useEffect(() => {
    let live = true
    setState((s) => ({ ...s, loading: true }))
    load().then(
      (data) => live && setState({ data, loading: false }),
      (error: unknown) => live && setState({ error, loading: false }),
    )
    return () => {
      live = false
    }
  }, deps)
  return state
}
