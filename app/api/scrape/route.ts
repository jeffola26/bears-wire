import { NextResponse } from 'next/server'
import Parser from 'rss-parser'
import { supabase } from '@/lib/supabase'

const parser = new Parser()

const RSS_FEEDS = [
  'https://www.espn.com/espn/rss/nfl/chicago-bears',
  'https://www.windycitygridiron.com/rss/index.xml',
  'http://bearingthenews.com/feed/',
  'https://www.bleachernation.com/bears/feed/',
]

export async function GET() {
  try {
    let addedCount = 0
    let skippedCount = 0
    const logs: string[] = []

    logs.push('Starting scrape at ' + new Date().toISOString())

    // Fetch all feeds
    for (const feedUrl of RSS_FEEDS) {
      try {
        logs.push(`Fetching feed: ${feedUrl}`)
        console.log(`Fetching feed: ${feedUrl}`)
        
        const feed = await parser.parseURL(feedUrl)
        logs.push(`Feed parsed. Items count: ${feed.items.length}`)
        console.log(`Feed parsed. Items: ${feed.items.length}`)

        // Process each article
        for (const item of feed.items) {
          if (!item.link || !item.title) {
            logs.push('Skipping item with missing link or title')
            continue
          }

          const url = item.link
          const title = item.title
          const source = new URL(feedUrl).hostname
          const description = item.contentSnippet || item.summary || ''
          const datePublished = item.pubDate ? new Date(item.pubDate) : new Date()

          // Check if article already exists
          const { data: existing, error: checkError } = await supabase
            .from('articles')
            .select('id')
            .eq('url', url)
            .single()

          if (checkError && checkError.code !== 'PGRST116') {
            logs.push(`Error checking article: ${checkError.message}`)
            console.error('Check error:', checkError)
            continue
          }

          if (!existing) {
            // Insert new article
            const { error: insertError } = await supabase
              .from('articles')
              .insert([
                {
                  title,
                  source,
                  url,
                  description,
                  date_published: datePublished.toISOString(),
                  thumbnail: null,
                },
              ])

            if (insertError) {
              logs.push(`Error inserting article "${title}": ${insertError.message}`)
              console.error('Insert error:', insertError)
            } else {
              addedCount++
              logs.push(`Added: ${title}`)
            }
          } else {
            skippedCount++
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logs.push(`Error parsing feed ${feedUrl}: ${errorMsg}`)
        console.error(`Error parsing feed ${feedUrl}:`, error)
      }
    }

    logs.push(`Scrape complete. Added: ${addedCount}, Skipped: ${skippedCount}`)
    console.log(logs.join('\n'))

    return NextResponse.json({
      success: true,
      added: addedCount,
      skipped: skippedCount,
      timestamp: new Date().toISOString(),
      logs,
    })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
