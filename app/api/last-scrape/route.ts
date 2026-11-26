import { NextResponse } from 'next/server'
import { getLastScrape } from '@/lib/scrape-status'

export async function GET() {
  try {
    const status = await getLastScrape()
    return NextResponse.json({ success: true, lastScrape: status })
  } catch (error) {
    console.error('Error reading last scrape:', error)
    return NextResponse.json({ success: false, lastScrape: null }, { status: 500 })
  }
}
