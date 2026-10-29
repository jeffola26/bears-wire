import { NextResponse } from 'next/server'

const ESPN_TEAM_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/chi'

export async function GET() {
  try {
    // Cached for an hour so we don't hit ESPN on every page load
    const response = await fetch(ESPN_TEAM_URL, { next: { revalidate: 3600 } })
    if (!response.ok) throw new Error(`ESPN responded ${response.status}`)

    const data = await response.json()
    const items: { type: string; summary: string }[] = data.team?.record?.items || []
    const total = items.find(item => item.type === 'total')

    return NextResponse.json({
      success: true,
      record: total?.summary || null,
    })
  } catch (error) {
    console.error('Error fetching record:', error)
    return NextResponse.json(
      { success: false, record: null, error: String(error) },
      { status: 500 }
    )
  }
}
