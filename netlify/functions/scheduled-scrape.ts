// Business hours in Chicago (local time, DST-aware): scrape every 15 minutes.
// Outside business hours: scrape once an hour, at the top of the hour.
function shouldRun(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find(p => p.type === 'hour')?.value)
  const minute = Number(parts.find(p => p.type === 'minute')?.value)
  const businessHours = hour >= 9 && hour < 17
  return businessHours || minute < 15
}

export default async () => {
  if (!shouldRun(new Date())) {
    console.log('Off-hours, not top of the hour — skipping scrape')
    return
  }

  const siteUrl = process.env.NETLIFY_SITE_URL || 'https://bearswire.netlify.app'

  try {
    console.log('Starting scheduled scrape...')

    // Scrape articles
    const scrapeResponse = await fetch(`${siteUrl}/api/scrape`)
    const scrapeData = await scrapeResponse.json()
    console.log('Scrape result:', scrapeData.message || scrapeData)

    // Fetch OG images
    const imagesResponse = await fetch(`${siteUrl}/api/scrape-images`)
    const imagesData = await imagesResponse.json()
    console.log('Images result:', imagesData.message || imagesData)

    console.log('Scheduled scrape completed successfully')
  } catch (error) {
    console.error('Scheduled scrape failed:', error)
  }
}



