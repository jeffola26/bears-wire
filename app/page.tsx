'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface Article {
  id: string
  title: string
  url: string
  source: string
  description: string
  date_published: string
  thumbnail: string | null
  content_type: 'news' | 'video' | 'photo'
}

type ContentType = 'news' | 'video'

const PLACEHOLDERS = ['/placeholder-1.png', '/placeholder-2.png', '/placeholder-3.png']

function getPlaceholder(id: string): string {
  const hash = id.charCodeAt(0) + id.charCodeAt(1)
  return PLACEHOLDERS[hash % PLACEHOLDERS.length]
}

function isRedditPost(source: string): boolean {
  return source.includes('reddit.com')
}

function cleanRedditDescription(description: string): string {
  // Remove "[link] [comments]" and similar Reddit UI text
  return description
    .replace(/\[link\]\s*\[comments\]/gi, '')
    .replace(/submitted by[\s\S]*?\[link\]\s*\[comments\]/g, '')
    .trim()
}

function decodeHTMLEntities(str: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ContentType>('news')
  const [allSources, setAllSources] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [showSourceFilter, setShowSourceFilter] = useState(false)

  useEffect(() => {
    fetchArticles()
  }, [])

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

  // Load source filter from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bearswire-source-filter')
    if (saved) {
      setSelectedSources(JSON.parse(saved))
    }
  }, [])

  // Save source filter to localStorage when it changes
  useEffect(() => {
    if (selectedSources.length > 0) {
      localStorage.setItem('bearswire-source-filter', JSON.stringify(selectedSources))
    }
  }, [selectedSources])

  async function fetchArticles() {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('date_published', { ascending: false })
        .limit(100)

      if (error) throw error
      
      const articlesData = data || []
      setArticles(articlesData)
      
      // Get unique sources
      const sources = Array.from(new Set(articlesData.map(a => a.source))).sort()
      setAllSources(sources)
      
      // If no filter saved, enable all sources by default
      if (selectedSources.length === 0) {
        setSelectedSources(sources)
      }
    } catch (error) {
      console.error('Error fetching articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredArticles = articles.filter(
    article => article.content_type === activeTab && selectedSources.includes(article.source)
  )

  // Get sources only for the active tab
  const tabSources = Array.from(new Set(
    articles
      .filter(a => a.content_type === activeTab)
      .map(a => a.source)
  )).sort()

  const tabConfig = [
    { id: 'news', label: 'News' },
    { id: 'video', label: 'Videos' },
  ]

  const toggleSource = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    )
  }

  const toggleAllSources = () => {
    if (selectedSources.length === tabSources.length) {
      setSelectedSources([])
    } else {
      setSelectedSources(tabSources)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0B162A' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#0B162A' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-center">
          <Image
            src="/bears-wire-logo.png"
            alt="BearsWire"
            width={330}
            height={265}
            priority
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Hero Section */}
        <div className="mb-6">
          <h2 className="text-4xl font-bold mb-3" style={{ color: '#FF6600' }}>
            Latest Bears News
          </h2>
          <p className="text-gray-300 text-lg">
            Your go-to source for Chicago Bears coverage.
          </p>
        </div>

        {/* Tabs and Filter */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <div className="flex gap-3 border-b flex-1" style={{ borderColor: '#FF6600', borderBottomWidth: '2px' }}>
            {tabConfig.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ContentType)}
                className={`px-4 py-3 font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                style={{
                  borderBottomWidth: activeTab === tab.id ? '3px' : '0px',
                  borderBottomColor: '#FF6600',
                  marginBottom: '-2px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Source Filter Button */}
          <div className="relative" data-source-filter>
            <button
              onClick={() => setShowSourceFilter(!showSourceFilter)}
              className="px-4 py-3 rounded font-semibold text-white transition-all hover:opacity-80"
              style={{ backgroundColor: '#FF6600' }}
            >
              Sources
            </button>

            {/* Source Filter Dropdown */}
            {showSourceFilter && (
              <div
                className="absolute right-0 mt-2 p-4 rounded shadow-lg z-50"
                style={{ backgroundColor: '#1a2847', borderColor: '#FF6600', borderWidth: '2px', minWidth: '250px' }}
              >
                <div className="mb-3 pb-3 border-b" style={{ borderColor: '#FF6600' }}>
                  <label className="flex items-center gap-2 cursor-pointer text-white font-semibold">
                    <input
                      type="checkbox"
                      checked={selectedSources.length === tabSources.length}
                      onChange={toggleAllSources}
                      className="w-4 h-4"
                    />
                    All Sources
                  </label>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tabSources.map((source) => (
                    <label key={source} className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedSources.includes(source)}
                        onChange={() => toggleSource(source)}
                        className="w-4 h-4"
                      />
                      {source}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="text-gray-400 text-lg">Loading...</div>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No content found with selected filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => {
              const reddit = isRedditPost(article.source)
              const imageUrl = reddit ? '/bears-reddit.png' : (article.thumbnail || getPlaceholder(article.id))

              return (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-lg overflow-hidden shadow hover:shadow-2xl transition-all duration-300 block"
                  style={{ backgroundColor: '#1a2847', borderLeftColor: '#FF6600', borderLeftWidth: '4px' }}
                >
                  {/* Image */}
                  <div className="aspect-video bg-gray-800 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={article.title}
                      className={`w-full h-full group-hover:scale-105 transition-transform duration-300 ${
                        article.content_type === 'video' ? 'object-cover' : 'object-contain'
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <span
                        className="text-xs font-semibold px-3 py-1 rounded text-white flex-shrink-0"
                        style={{ backgroundColor: '#FF6600' }}
                      >
                        {article.source}
                      </span>
                      <time className="text-xs text-gray-400 flex-shrink-0" dateTime={article.date_published}>
                        {new Date(article.date_published).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                    </div>

                    <h3 className="font-bold text-lg mb-3 group-hover:text-orange-400 transition-colors text-white leading-tight">
                      {decodeHTMLEntities(article.title)}
                    </h3>

                    <p className="text-gray-300 text-sm line-clamp-2">
                      {isRedditPost(article.source) ? cleanRedditDescription(article.description) : article.description}
                    </p>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16" style={{ borderTopColor: '#FF6600', borderTopWidth: '2px' }}>
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-400 text-sm">
          <p>&copy; 2026 BearsWire</p>
          <p className="mt-2">Another <a href="https://wolfpackdesigns.net" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 transition-colors">Wolfpack Designs</a> project</p>
        </div>
      </footer>
    </div>
  )
}
