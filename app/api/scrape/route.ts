import { NextResponse } from 'next/server'
import Parser from 'rss-parser'
import { supabase } from '@/lib/supabase'

const parser = new Parser()

interface Feed {
  url: string
  contentType: 'news' | 'video' | 'photo'
  channelName?: string
  filterKeywords?: string[]
}

const RSS_FEEDS: Feed[] = [
  // News feeds only
  { url: 'https://www.chicagobears.com/rss/news', contentType: 'news' },
  { url: 'https://www.windycitygridiron.com/rss/index.xml', contentType: 'news' },
  { url: 'http://bearingthenews.com/feed/', contentType: 'news' },
  { url: 'https://www.reddit.com/r/chibears/.rss', contentType: 'news' },
  
  // YouTube TIER 1: All uploads (no filter)
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCP0Cdc6moLMyDJiO0s-yhbQ', contentType: 'video', channelName: 'Chicago Bears Official' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCaN9720mbtCGefgjo5Qkr0A', contentType: 'video', channelName: 'Bears Now' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCDZtl0wzSyTgS3l0SwOnRXA', contentType: 'video', channelName: 'Forward Progress' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCHBOlQMu9qMee2Yr42LzAVA', contentType: 'video', channelName: 'Hoge & Jahns' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXCnRo-iwMsS4iC1SobeGHA', contentType: 'video', channelName: 'Locked On Bears' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCnu9684zxjlZWbdU0EhC4ag', contentType: 'video', channelName: 'Bear Down Sports' },
  
  // YouTube TIER 2: "Bears" keyword filter
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC4FSSn6ncqmR_mqwsR_IkVQ', contentType: 'video', channelName: '104.3 The Score', filterKeywords: ['bears', 'bear'] },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC-W2TmgeL6tEzvtvUU7cptg', contentType: 'video', channelName: 'CHGO Sports', filterKeywords: ['bears', 'bear'] },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC3tow0dDpOH8-NlFIb4cBgw', contentType: 'video', channelName: 'ESPN 1000 Chicago', filterKeywords: ['bears', 'bear'] },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC72WUwaRot1Hz3W8ENoOfPQ', contentType: 'video', channelName: 'Waddle and Silvy', filterKeywords: ['bears', 'bear'] },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC3X-L84yCBq0XUd1Whe5u7A', contentType: 'video', channelName: 'Up And Adams Show', filterKeywords: ['bears', 'bear'] },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCC0N8SvRTdBobYO--JJeNjw', contentType: 'video', channelName: 'Barstool Chicago', filterKeywords: ['bears', 'bear'] },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC8JCf26FHQIRAcsMioq1cXA', contentType: 'video', channelName: 'Carmen & Jurko', filterKeywords: ['bears', 'bear'] },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZjoOyDDicAfpILdR6G0Sow', contentType: 'video', channelName: 'Kap & J-Hood', filterKeywords: ['bears', 'bear'] },
  
  // YouTube TIER 3: "Caleb Williams" keyword filter
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZvBu8syAHQ1sySTn17VKiQ', contentType: 'video', channelName: 'All Things QB', filterKeywords: ['caleb', 'williams'] },
]

const BEARS_KEYWORDS = ['bear', 'chicago', 'caleb', 'williams', 'nfl', 'offense', 'defense', 'coaches', 'trainer', 'soldier field', 'ben johnson', 'dennis allen', 'ryan poles', 'training camp', 'camp', 'practice', 'injury', 'draft', 'rookie', 'offense', 'defense', 'game', 'season']

function isBearRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase()
  return BEARS_KEYWORDS.some(keyword => text.includes(keyword))
}

function matchesFilterKeywords(title: string, description: string, filterKeywords?: string[]): boolean {
  if (!filterKeywords || filterKeywords.length === 0) {
    return true
  }
  const text = `${title} ${description}`.toLowerCase()
  return filterKeywords.some(keyword => text.includes(keyword))
}

function isYouTubeShort(url: string, title: string, description: string, item: any): boolean {
  // Check URL for /shorts/
  if (url.includes('/shorts/')) {
    return true
  }

  // Check for "short" keyword in title or description
  const text = `${title} ${description}`.toLowerCase()
  if (text.includes('short')) {
    return true
  }

  // Check duration if available in media content
  if (item['media:content']) {
    const mediaContent = Array.isArray(item['media:content']) ? item['media:content'][0] : item['media:content']
    if (mediaContent?.$ && mediaContent.$.duration) {
      const duration = parseInt(mediaContent.$.duration, 10)
      // Shorts are typically under 60 seconds
      if (duration < 60) {
        return true
      }
    }
  }

  // Check yt:duration if available (YouTube-specific)
  if (item['yt:duration']) {
    const duration = item['yt:duration']
    if (duration && parseInt(duration, 10) < 60) {
      return true
    }
  }

  return false
}

function extractYouTubeThumbnail(url: string): string | null {
  // Extract video ID from YouTube URL
  let videoId: string | null = null
  
  if (url.includes('youtube.com/watch?v=')) {
    const match = url.match(/v=([^&]+)/)
    videoId = match ? match[1] : null
  } else if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([^?]+)/)
    videoId = match ? match[1] : null
  }
  
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  }
  
  return null
}

function extractImageFromRSSItem(item: any, url: string): string | null {
  // For YouTube videos, construct thumbnail from video ID
  if (url && url.includes('youtube.com')) {
    const ytThumbnail = extractYouTubeThumbnail(url)
    if (ytThumbnail) {
      return ytThumbnail
    }
  }
  
  // Fallback: YouTube thumbnail extraction (media:thumbnail)
  if (item['media:thumbnail']?.url) {
    return item['media:thumbnail'].url
  }
  
  // Fallback for media array format
  if (item.media && item.media.length > 0) {
    if (item.media[0].thumbnail) {
      return item.media[0].thumbnail
    }
    return item.media[0].$.url || null
  }
  
  // Fallback for enclosure
  if (item.enclosure?.url) {
    return item.enclosure.url
  }
  
  return null
}

export async function GET() {
  try {
    let addedCount = 0
    let skippedCount = 0
    const logs: string[] = []

    logs.push('Starting scrape at ' + new Date().toISOString())

    // Fetch all feeds
    for (const feed of RSS_FEEDS) {
      try {
        logs.push(`Fetching ${feed.contentType} feed: ${feed.url}`)
        console.log(`Fetching ${feed.contentType} feed: ${feed.url}`)
        
        const parsedFeed = await parser.parseURL(feed.url)
        logs.push(`Feed parsed. Items count: ${parsedFeed.items.length}`)
        console.log(`Feed parsed. Items: ${parsedFeed.items.length}`)

        // Process each article
        for (const item of parsedFeed.items) {
          if (!item.link || !item.title) {
            logs.push('Skipping item with missing link or title')
            continue
          }

          const url = item.link
          const title = item.title
          const description = item.contentSnippet || item.summary || ''
          const datePublished = item.pubDate ? new Date(item.pubDate) : new Date()

          // Aggressive YouTube shorts filtering
          if (isYouTubeShort(url, title, description, item)) {
            logs.push(`Filtered out (YouTube short): ${title}`)
            continue
          }

          // Try to extract image from RSS item (pass URL for YouTube thumbnail generation)
          const thumbnail = extractImageFromRSSItem(item, url)

          // Use channel name if available, otherwise use hostname
          const source = feed.channelName || new URL(feed.url).hostname

          // Apply filtering based on feed type
          const isOfficialBears = feed.url.includes('chicagobears.com')
          const isReddit = feed.url.includes('reddit.com')
          const isYouTube = feed.url.includes('youtube.com')
          
          if (isYouTube) {
            // YouTube feeds use tier-based keyword filtering
            if (!matchesFilterKeywords(title, description, feed.filterKeywords)) {
              logs.push(`Filtered out (doesn't match keywords): ${title}`)
              continue
            }
          } else if (!isOfficialBears && !isReddit) {
            // News feeds require Bears-related keywords (except official and Reddit)
            if (!isBearRelated(title, description)) {
              logs.push(`Filtered out (not Bears-related): ${title}`)
              continue
            }
          }

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
                  thumbnail: thumbnail,
                  content_type: feed.contentType,
                },
              ])

            if (insertError) {
              logs.push(`Error inserting article "${title}": ${insertError.message}`)
              console.error('Insert error:', insertError)
            } else {
              addedCount++
              logs.push(`Added (${feed.contentType}): ${title}`)
            }
          } else {
            skippedCount++
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logs.push(`Error parsing feed ${feed.url}: ${errorMsg}`)
        console.error(`Error parsing feed ${feed.url}:`, error)
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
