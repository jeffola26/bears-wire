import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('enabled_sources')
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      enabledSources: data.enabled_sources || [],
    })
  } catch (error) {
    console.error('Error fetching preferences:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { enabledSources } = await request.json()

    const { data, error } = await supabase
      .from('user_preferences')
      .update({
        enabled_sources: enabledSources,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      enabledSources: data.enabled_sources,
    })
  } catch (error) {
    console.error('Error updating preferences:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}