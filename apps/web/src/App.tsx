import { Route, Routes } from 'react-router'
import { DemoBanner } from './components/DemoBanner.tsx'
import { IS_DEMO } from './config.ts'
import { Home } from './pages/Home.tsx'
import { Landing } from './pages/Landing.tsx'

export function App() {
  return (
    <>
      {IS_DEMO && <DemoBanner />}
      <Routes>
        {IS_DEMO ? (
          <>
            <Route path="/" element={<Landing />} />
            <Route path="/demo/*" element={<Home />} />
          </>
        ) : (
          <Route path="/*" element={<Home />} />
        )}
      </Routes>
    </>
  )
}
