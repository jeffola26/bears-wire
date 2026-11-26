import { getStore } from '@netlify/blobs'

const STORE = 'scrape-status'
const KEY = 'last-scrape'

export interface ScrapeStatus {
  timestamp: string
  added: number
  skipped: number
}

export async function setLastScrape(status: ScrapeStatus): Promise<void> {
  await getStore(STORE).setJSON(KEY, status)
}

export async function getLastScrape(): Promise<ScrapeStatus | null> {
  return (await getStore(STORE).get(KEY, { type: 'json' })) as ScrapeStatus | null
}
