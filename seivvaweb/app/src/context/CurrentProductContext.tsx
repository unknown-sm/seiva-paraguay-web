import { createContext, useContext, useState, type ReactNode } from 'react'

type CurrentProductContextValue = {
  currentProductName: string | null
  setCurrentProductName: (name: string | null) => void
}

const CurrentProductContext = createContext<CurrentProductContextValue>({
  currentProductName: null,
  setCurrentProductName: () => {},
})

export function CurrentProductProvider({ children }: { children: ReactNode }) {
  const [currentProductName, setCurrentProductName] = useState<string | null>(null)

  return (
    <CurrentProductContext.Provider value={{ currentProductName, setCurrentProductName }}>
      {children}
    </CurrentProductContext.Provider>
  )
}

export function useCurrentProduct() {
  return useContext(CurrentProductContext)
}
