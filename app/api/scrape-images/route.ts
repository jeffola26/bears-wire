import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function extractOGImage(html: string): string | null {
  const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
  if (match && match[1]) {
    return match[1]
  }
  return null
}

export async function GET() {
  try {
    const logs: string[] = []
    let updatedCount = 0

    logs.push('Starting OG image fetch at ' + new Date().toISOString())

    // Get articles without thumbnails
    const { data: articlesWithoutImages, error } = await supabase
      .from('articles')
      .select('id, url, title')
      .is('thumbnail', null)
      .limit(50)

    if (error) throw error

    logs.push(`Found ${articlesWithoutImages?.length || 0} articles without images`)

    if (!articlesWithoutImages || articlesWithoutImages.length === 0) {
      logs.push('No articles to process')
      return NextResponse.json({
        success: true,
        updated: 0,
        timestamp: new Date().toISOString(),
        logs,
      })
    }

    // Fetch OG images for each article
    for (const article of articlesWithoutImages) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        const response = await fetch(article.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          logs.push(`Failed to fetch ${article.url}: ${response.status}`)
          continue
        }

        const html = await response.text()
        const ogImage = extractOGImage(html)

        if (ogImage) {
          const { error: updateError } = await supabase
            .from('articles')
            .update({ thumbnail: ogImage })
            .eq('id', article.id)

          if (updateError) {
            logs.push(`Error updating ${article.title}: ${updateError.message}`)
          } else {
            updatedCount++
            logs.push(`Updated: ${article.title}`)
          }
        } else {
          logs.push(`No og:image found for ${article.title}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logs.push(`Error fetching ${article.url}: ${errorMsg}`)
      }
    }

    logs.push(`OG image fetch complete. Updated: ${updatedCount}`)

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      timestamp: new Date().toISOString(),
      logs,
    })
  } catch (error) {
    console.error('OG image fetch error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
