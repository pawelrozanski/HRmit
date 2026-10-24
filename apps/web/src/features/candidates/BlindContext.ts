import { createContext, useContext, useState } from 'react'

/** Blind screening: hide name and contact fields everywhere a candidate is shown. */
export const BlindContext = createContext(false)
export const useBlind = () => useContext(BlindContext)

const BLIND_KEY = 'hrmit-blind'

/** The toggle's state, shared by every page that shows one, remembered in localStorage. */
export function useBlindSetting() {
  const [blind, setBlind] = useState(() => localStorage.getItem(BLIND_KEY) === '1')
  const toggle = (on: boolean) => {
    setBlind(on)
    localStorage.setItem(BLIND_KEY, on ? '1' : '0')
  }
  return [blind, toggle] as const
}
