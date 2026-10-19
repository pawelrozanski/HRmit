import { useEffect, useState, type DependencyList } from 'react'

type State<T> = { data?: T; error?: unknown; loading: boolean }
type Result<T> = State<T> & { setData: (update: (data: T) => T) => void }

/** Fetch on mount and whenever `deps` change; `setData` applies a local update after a mutation. */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList): Result<T> {
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
  const setData = (update: (data: T) => T) =>
    setState((s) => (s.data === undefined ? s : { ...s, data: update(s.data) }))
  return { ...state, setData }
}
