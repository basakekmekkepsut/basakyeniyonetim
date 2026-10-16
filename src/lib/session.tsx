import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db, requireDb } from './firebase'
import type { KullaniciProfili, Modul } from './types'

type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User; profile: KullaniciProfili }
  | { status: 'no-profile'; user: User }
  | { status: 'error'; message: string }

const SessionContext = createContext<SessionState>({ status: 'loading' })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    if (!auth || !db) {
      setState({ status: 'error', message: 'Firebase yapılandırılmadı.' })
      return
    }

    let unsubProfile: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(
      auth,
      (user) => {
        unsubProfile?.()

        if (!user) {
          setState({ status: 'signed-out' })
          return
        }

        unsubProfile = onSnapshot(
          doc(requireDb(), 'users', user.uid),
          { includeMetadataChanges: true },
          (snap) => {
            if (!snap.exists()) {
              // Önbellekten (henüz sunucuya ulaşmadan) gelen boş yanıt "profil yok" demek değildir;
              // önbellek temizlenmiş/çevrimdışı telefonlarda yanlış uyarı çıkıyordu.
              if (snap.metadata.fromCache) return
              setState({ status: 'no-profile', user })
              return
            }
            setState({ status: 'signed-in', user, profile: snap.data() as KullaniciProfili })
          },
          (err) => setState({ status: 'error', message: err.message })
        )
      },
      (err) => setState({ status: 'error', message: err.message })
    )

    return () => {
      unsubAuth()
      unsubProfile?.()
    }
  }, [])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}

export function hasModule(profile: KullaniciProfili, modul: Modul): boolean {
  return profile.rol === 'admin' || Boolean(profile.modules?.[modul])
}

export function isAdmin(profile: KullaniciProfili): boolean {
  return profile.rol === 'admin'
}
