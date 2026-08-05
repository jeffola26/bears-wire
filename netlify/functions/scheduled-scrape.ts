export default async () => {
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

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Scheduled scrape completed',
        scrape: scrapeData,
        images: imagesData,
      }),
    }
  } catch (error) {
    console.error('Scheduled scrape failed:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
