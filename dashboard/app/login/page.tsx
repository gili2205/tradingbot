'use client'

import { useEffect, useState } from 'react'
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, googleProvider } from '@/lib/firebase'
import { Suspense } from 'react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fromPath = searchParams.get('from') || '/'
  const errorParam = searchParams.get('error')

  useEffect(() => {
    if (errorParam === 'unauthorized') {
      setError('Access denied. Your account is not authorized to use this dashboard.')
    }
  }, [errorParam])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const authorized = process.env.NEXT_PUBLIC_AUTHORIZED_EMAIL
        if (!authorized || user.email === authorized) {
          document.cookie = `session=${user.uid}; path=/; max-age=86400; samesite=strict`
          router.push(fromPath)
        }
      }
    })
    return unsub
  }, [router, fromPath])

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      const authorized = process.env.NEXT_PUBLIC_AUTHORIZED_EMAIL

      if (authorized && user.email !== authorized) {
        await auth.signOut()
        setError('Access denied. Your account is not authorized to use this dashboard.')
        return
      }

      document.cookie = `session=${user.uid}; path=/; max-age=86400; samesite=strict`
      router.push(fromPath)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed'
      if (!msg.includes('popup-closed-by-user')) {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#3b82f6] rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-[#f1f5f9]">TradingBot</span>
          </div>
          <h1 className="text-2xl font-bold text-[#f1f5f9] mb-2">Sign In</h1>
          <p className="text-[#94a3b8] text-sm">Access the trading bot control panel</p>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-lg px-4 py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>
        </div>

        <p className="text-center text-[#475569] text-xs mt-6">
          Authorized access only
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-[#94a3b8]">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
