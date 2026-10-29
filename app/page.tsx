'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface Article {
  id: string
  title: string
  url: string
  source: string
  description: string
  date_published: string
  created_at?: string
  thumbnail: string | null
  content_type: 'news' | 'video' | 'photo'
}

type ContentType = 'news' | 'video'

const PLACEHOLDERS = ['/placeholder-1.png', '/placeholder-2.png', '/placeholder-3.png']
const LAST_VISIT_KEY = 'bearswire-last-visit'

function getPlaceholder(id: string): string {
  const hash = id.charCodeAt(0) + id.charCodeAt(1)
  return PLACEHOLDERS[hash % PLACEHOLDERS.length]
}

function isRedditPost(source: string): boolean {
  return source.includes('reddit.com')
}

function decodeHTMLEntities(str: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}

// When the article landed in our feed (falls back to publish date)
function addedAt(article: Article): number {
  return new Date(article.created_at || article.date_published).getTime()
}

function timeAgo(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function groupByDay(articles: Article[]): { label: string; articles: Article[] }[] {
  const groups: { label: string; articles: Article[] }[] = []
  for (const article of articles) {
    const label = dayLabel(new Date(article.date_published))
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.articles.push(article)
    } else {
      groups.push({ label, articles: [article] })
    }
  }
  return groups
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ContentType>('news')
  const [allSources, setAllSources] = useState<string[]>([])
  const [selectedSourcesNews, setSelectedSourcesNews] = useState<string[]>([])
  const [selectedSourcesVideos, setSelectedSourcesVideos] = useState<string[]>([])
  const [showSourceFilter, setShowSourceFilter] = useState(false)
  const [lastVisit, setLastVisit] = useState<number | null>(null)
  const [record, setRecord] = useState<string | null>(null)
  const isInitialMount = useRef(true)
  const visitRecorded = useRef(false)
  const stickyAnchor = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)

  // Get selected sources for current tab (computed value only)
  const selectedSources = activeTab === 'news' ? selectedSourcesNews : selectedSourcesVideos

  useEffect(() => {
    fetchArticles()
    fetchRecord()
  }, [])

  // Track when the tab bar is stuck to the top of the screen
  useEffect(() => {
    const anchor = stickyAnchor.current
    if (!anchor) return
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting))
    observer.observe(anchor)
    return () => observer.disconnect()
  }, [])

  // Remember the previous visit, then mark this one (ref guards against double-run in dev)
  useEffect(() => {
    if (visitRecorded.current) return
    visitRecorded.current = true
    const saved = localStorage.getItem(LAST_VISIT_KEY)
    if (saved) {
      setLastVisit(Number(saved))
    }
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()))
  }, [])

  // Load source filter from localStorage on mount
  useEffect(() => {
    const savedNews = localStorage.getItem('bearswire-source-filter-news')
    const savedVideos = localStorage.getItem('bearswire-source-filter-videos')
    if (savedNews) {
      setSelectedSourcesNews(JSON.parse(savedNews))
    }
    if (savedVideos) {
      setSelectedSourcesVideos(JSON.parse(savedVideos))
    }
  }, [])

  // Save source filter to localStorage when it changes
  useEffect(() => {
    if (activeTab === 'news' && selectedSourcesNews.length > 0) {
      localStorage.setItem('bearswire-source-filter-news', JSON.stringify(selectedSourcesNews))
    }
  }, [selectedSourcesNews, activeTab])

  useEffect(() => {
    if (activeTab === 'video' && selectedSourcesVideos.length > 0) {
      localStorage.setItem('bearswire-source-filter-videos', JSON.stringify(selectedSourcesVideos))
    }
  }, [selectedSourcesVideos, activeTab])

  // Default to all sources if none selected and articles are loaded (per tab)
  useEffect(() => {
    if (selectedSourcesNews.length === 0 && allSources.length > 0) {
      setSelectedSourcesNews(allSources)
    }
  }, [allSources, selectedSourcesNews.length])

  useEffect(() => {
    if (selectedSourcesVideos.length === 0 && allSources.length > 0) {
      setSelectedSourcesVideos(allSources)
    }
  }, [allSources, selectedSourcesVideos.length])

  // Jump back to the top of the list when tab changes, if scrolled past it (skip on initial load)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const anchorTop = stickyAnchor.current
      ? stickyAnchor.current.getBoundingClientRect().top + window.scrollY
      : 0
    if (window.scrollY > anchorTop) {
      window.scrollTo({ top: anchorTop, behavior: 'instant' })
    }
  }, [activeTab])

  async function fetchArticles() {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('date_published', { ascending: false })
        .limit(200)

      if (error) throw error

      const articlesData = data || []
      setArticles(articlesData)

      // Get unique sources
      const sources = Array.from(new Set(articlesData.map(a => a.source))).sort()
      setAllSources(sources)
    } catch (error) {
      console.error('Error fetching articles:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRecord() {
    try {
      const response = await fetch('/api/record')
      const data = await response.json()
      setRecord(data.record || null)
    } catch (error) {
      console.error('Error fetching record:', error)
    }
  }

  // Close source filter when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (showSourceFilter && !target.closest('[data-source-filter]')) {
        setShowSourceFilter(false)
      }
    }

    if (showSourceFilter) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSourceFilter])

  const filteredArticles = articles.filter(
    article => article.content_type === activeTab && selectedSources.includes(article.source)
  )

  // Get sources only for the active tab
  const tabSources = Array.from(new Set(
    articles
      .filter(a => a.content_type === activeTab)
      .map(a => a.source)
  )).sort()

  // On the Wire stats
  const isNew = (article: Article) => lastVisit !== null && addedAt(article) > lastVisit
  const newCount = lastVisit !== null
    ? articles.filter(isNew).length
    : articles.filter(a => dayLabel(new Date(a.date_published)) === 'Today').length
  const lastUpdated = articles.length > 0 ? Math.max(...articles.map(addedAt)) : null

  const tabConfig = [
    { id: 'news', label: 'News' },
    { id: 'video', label: 'Videos' },
  ]

  const toggleSource = (source: string) => {
    if (activeTab === 'news') {
      setSelectedSourcesNews(prev =>
        prev.includes(source)
          ? prev.filter(s => s !== source)
          : [...prev, source]
      )
    } else {
      setSelectedSourcesVideos(prev =>
        prev.includes(source)
          ? prev.filter(s => s !== source)
          : [...prev, source]
      )
    }
  }

  const toggleAllSources = () => {
    if (activeTab === 'news') {
      if (selectedSourcesNews.length === tabSources.length) {
        setSelectedSourcesNews([])
      } else {
        setSelectedSourcesNews(tabSources)
      }
    } else {
      if (selectedSourcesVideos.length === tabSources.length) {
        setSelectedSourcesVideos([])
      } else {
        setSelectedSourcesVideos(tabSources)
      }
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* Background light blooms */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-36 -right-28 w-[260px] h-[260px] opacity-20 md:-top-40 md:-right-20 md:w-[420px] md:h-[420px] md:opacity-35 rounded-full blur-[80px]" style={{ background: '#FF6600' }} />
        <div className="absolute top-64 -left-60 w-[500px] h-[500px] rounded-full blur-[80px] opacity-30" style={{ background: '#1e4fd8' }} />
        <div className="absolute -bottom-36 right-[10%] w-[360px] h-[360px] rounded-full blur-[80px] opacity-20" style={{ background: '#c83803' }} />
      </div>

      {/* Header */}
      <header className="max-w-4xl mx-auto px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="w-14 md:w-16 flex-shrink-0">
          <Image
            src="/bears-wire-logo2.png"
            alt="BearsWire"
            width={280}
            height={392}
            priority
            style={{ width: '100%', height: 'auto' }}
          />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-none">
            Bears<span style={{ color: '#FF6600' }}>Wire</span>
          </h1>
          <p className="hidden sm:block text-xs md:text-sm mt-1" style={{ color: '#8b95ab' }}>
            Every Bears story, one feed
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4">
        {/* On the Wire */}
        <div
          className="flex items-center rounded-xl overflow-hidden"
          style={{
            border: '1px solid rgba(255,102,0,0.35)',
            background: 'linear-gradient(90deg, rgba(255,102,0,0.18), rgba(255,102,0,0.05))',
            backdropFilter: 'blur(14px)',
          }}
        >
          <span className="orange-gradient flex-shrink-0 flex items-center gap-2 px-3 py-2 font-condensed font-bold uppercase tracking-widest text-sm text-white">
            <span className="wire-dot w-2 h-2 rounded-full bg-white" />
            On the Wire
          </span>
          <div className="flex flex-1 items-center gap-3 px-3 text-xs sm:text-sm whitespace-nowrap overflow-hidden" style={{ color: '#ffd8bf' }}>
            {!loading && (
              <>
                <span>
                  <span className="font-bold" style={{ color: '#FF6600' }}>{newCount} new</span>{' '}
                  <span className="hidden sm:inline">{lastVisit !== null ? 'since your last visit' : 'today'}</span>
                </span>
                {lastUpdated && (
                  <>
                    <span className="hidden sm:block w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'rgba(255,216,191,0.45)' }} />
                    <span className="hidden sm:inline">
                      Updated{' '}
                      <span className="font-semibold text-white">{timeAgo(lastUpdated)}</span>
                    </span>
                  </>
                )}
              </>
            )}
            <span className="ml-auto flex items-center gap-3 flex-shrink-0 font-condensed font-bold uppercase tracking-wider text-sm sm:text-base">
              {record && (
                <span>
                  Bears <span className="text-base sm:text-lg" style={{ color: '#FF6600' }}>{record}</span>
                </span>
              )}
              <a
                href="https://sportslist.org/schedule"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 rounded-md text-xs sm:text-sm text-white transition-colors hover:bg-[rgba(255,102,0,0.25)]"
                style={{ border: '1px solid rgba(255,102,0,0.5)' }}
              >
                Schedule
              </a>
            </span>
          </div>
        </div>

        {/* Tabs and Filter */}
        <div ref={stickyAnchor} />
        <div className="sticky top-0 z-50 py-3">
          {/* Masks rows scrolling under the bar once it's stuck */}
          {isStuck && (
            <div
              aria-hidden
              className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 -z-10"
              style={{ background: 'linear-gradient(#060b16 0 40%, rgba(6,11,22,0))' }}
            />
          )}
          <div className="glass-strong backdrop-blur-xl flex items-center justify-between gap-3 p-1.5 rounded-2xl">
            <div className="flex rounded-xl p-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
              {tabConfig.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ContentType)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab.id ? 'text-white' : 'hover:text-gray-200'
                  }`}
                  style={activeTab === tab.id
                    ? { background: 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' }
                    : { color: '#8b95ab' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Source Filter Button */}
            <div className="relative" data-source-filter>
              <button
                onClick={() => setShowSourceFilter(!showSourceFilter)}
                className="orange-gradient px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{ boxShadow: '0 4px 16px rgba(255,102,0,0.35)' }}
              >
                Sources
              </button>

              {/* Source Filter Dropdown */}
              {showSourceFilter && (
                <div
                  className="glass-strong backdrop-blur-xl absolute right-0 mt-3 p-4 rounded-2xl z-50"
                  style={{ minWidth: '260px', background: 'rgba(13,20,36,0.92)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
                >
                  <div className="mb-3 pb-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <label className="flex items-center gap-2 cursor-pointer text-white font-semibold text-sm">
                      <input
                        type="checkbox"
                        checked={selectedSources.length === tabSources.length}
                        onChange={toggleAllSources}
                        className="w-4 h-4"
                        style={{ accentColor: '#FF6600' }}
                      />
                      All Sources
                    </label>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {tabSources.map((source) => (
                      <label key={source} className="flex items-center gap-2 cursor-pointer text-sm hover:text-white transition-colors" style={{ color: '#b5bfd3' }}>
                        <input
                          type="checkbox"
                          checked={selectedSources.includes(source)}
                          onChange={() => toggleSource(source)}
                          className="w-4 h-4"
                          style={{ accentColor: '#FF6600' }}
                        />
                        {source}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="text-lg" style={{ color: '#8b95ab' }}>Loading...</div>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#8b95ab' }}>No content found with selected filters.</p>
          </div>
        ) : (
          <div className="pb-4">
            {groupByDay(filteredArticles).map((group) => (
              <section key={group.label}>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] mt-4 mb-2 mx-0.5" style={{ color: '#6f7a91' }}>
                  {group.label}
                </h2>
                <div className="flex flex-col gap-1.5">
                  {group.articles.map((article) => {
                    const reddit = isRedditPost(article.source)
                    const imageUrl = reddit ? '/bears-reddit.png' : (article.thumbnail || getPlaceholder(article.id))

                    return (
                      <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="glass group flex items-center gap-3 py-2 pl-2 pr-3 rounded-xl transition-all duration-150 hover:bg-white/10 hover:border-[rgba(255,102,0,0.4)]"
                      >
                        <div className="relative flex-shrink-0 w-[88px] aspect-video rounded-lg overflow-hidden bg-gray-800">
                          <img
                            src={imageUrl}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          {article.content_type === 'video' && (
                            <span className="absolute inset-0 grid place-items-center">
                              <span className="w-6 h-6 rounded-full grid place-items-center text-[9px] text-white" style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.4)' }}>
                                ▶
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-white" style={{ color: '#f1f4fa' }}>
                            {decodeHTMLEntities(article.title)}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-[11.5px] whitespace-nowrap overflow-hidden" style={{ color: '#7d889f' }}>
                            {isNew(article) && (
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#FF6600', boxShadow: '0 0 8px #FF6600' }} />
                            )}
                            <span className="font-semibold truncate" style={{ color: '#ff9a57' }}>{article.source}</span>
                            <time className="flex-shrink-0" dateTime={article.date_published}>
                              · {timeAgo(new Date(article.date_published).getTime())}
                            </time>
                          </div>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-sm flex flex-col items-center" style={{ color: '#8b95ab' }}>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-32 md:w-48 mb-4 cursor-pointer opacity-100 hover:opacity-80 transition-opacity"
            aria-label="Scroll to top"
          >
            <Image
              src="/footer.png"
              alt="BearsWire Footer"
              width={455}
              height={607}
              style={{ width: '100%', height: 'auto' }}
            />
          </button>
          <p>&copy; 2026 Bears<span style={{ color: '#FF6600' }}>Wire</span></p>
          <p className="mt-2">Another <a href="https://wolfpackdesigns.net" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 transition-colors">Wolfpack Designs</a> project</p>
        </div>
      </footer>
    </div>
  )
}
