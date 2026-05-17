import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Trading Bot Dashboard',
  description: 'Autonomous stock trading bot control panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0f172a] text-[#f1f5f9] min-h-screen`}>
        <nav className="border-b border-[#334155] bg-[#0f172a] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#3b82f6] font-bold text-lg tracking-tight">TradingBot</span>
              <span className="text-[#334155] text-lg font-light">|</span>
              <span className="text-[#94a3b8] text-sm">Dashboard</span>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 rounded text-sm text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e293b] transition-colors"
              >
                Overview
              </Link>
              <Link
                href="/config"
                className="px-3 py-1.5 rounded text-sm text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e293b] transition-colors"
              >
                Config
              </Link>
              <Link
                href="/decisions"
                className="px-3 py-1.5 rounded text-sm text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e293b] transition-colors"
              >
                Trade Log
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
