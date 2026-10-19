import { createContext, useContext } from 'react'

/** Blind screening: hide name and contact fields everywhere a candidate is shown. */
export const BlindContext = createContext(false)
export const useBlind = () => useContext(BlindContext)
