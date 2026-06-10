import { NextRequest, NextResponse } from 'next/server'

const ALPACA_KEY      = process.env.ALPACA_KEY
const ALPACA_SECRET   = process.env.ALPACA_SECRET
const ALPACA_ENDPOINT = process.env.ALPACA_ENDPOINT ?? 'https://paper-api.alpaca.markets'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase()

  if (!symbol) {
    return NextResponse.json({ valid: false, error: 'No symbol provided' }, { status: 400 })
  }

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    // Graceful fallback: if credentials not set, allow the ticker (don't block the user)
    return NextResponse.json({ valid: true, name: symbol, warning: 'Alpaca credentials not configured — skipping validation' })
  }

  try {
    const res = await fetch(`${ALPACA_ENDPOINT}/v2/assets/${symbol}`, {
      headers: {
        'APCA-API-KEY-ID':     ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET,
      },
      next: { revalidate: 3600 }, // cache for 1 hour — asset data rarely changes
    })

    if (res.status === 404) {
      return NextResponse.json({ valid: false, error: `"${symbol}" was not found on Alpaca` })
    }
    if (!res.ok) {
      return NextResponse.json({ valid: false, error: `Alpaca returned ${res.status}` })
    }

    const asset = await res.json()

    if (asset.status !== 'active') {
      return NextResponse.json({
        valid: false,
        error: `${symbol} exists but is not actively traded (status: ${asset.status})`,
      })
    }

    if (!asset.tradable) {
      return NextResponse.json({
        valid: false,
        error: `${symbol} is not tradable on your Alpaca account`,
      })
    }

    return NextResponse.json({
      valid: true,
      name: asset.name ?? symbol,
      exchange: asset.exchange,
      asset_class: asset.asset_class,
    })
  } catch (err) {
    console.error('validate-ticker error:', err)
    // Network error — allow the ticker rather than blocking the user
    return NextResponse.json({ valid: true, warning: 'Could not reach Alpaca to validate — symbol accepted' })
  }
}
