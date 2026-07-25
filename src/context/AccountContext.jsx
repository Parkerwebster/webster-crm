import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

const AccountContext = createContext(null)

export function AccountProvider({ children }) {
  const { user } = useAuth()
  const [accountId, setAccountId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setAccountId(null)
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('account_members')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAccountId(data?.account_id ?? null)
        setLoading(false)
      })
  }, [user])

  return (
    <AccountContext.Provider value={{ accountId, loading }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  return useContext(AccountContext)
}
