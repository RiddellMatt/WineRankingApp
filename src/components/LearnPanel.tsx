import { useEffect } from 'react'
import { LEARN_ARTICLES, learnArticleBySlug, type LearnArticle } from '../content/learnArticles'
import { isNativeApp } from '../lib/platform'

interface Props {
  articleSlug: string | null
  onArticleChange: (slug: string | null) => void
  onBack: () => void
}

function LearnArticleView({ article, onBack }: { article: LearnArticle; onBack: () => void }) {
  useEffect(() => {
    const prevTitle = document.title
    const meta = document.querySelector('meta[name="description"]')
    const prevDesc = meta?.getAttribute('content') ?? ''

    document.title = `${article.title} — Decanti Learn`
    if (meta) meta.setAttribute('content', article.summary)

    return () => {
      document.title = prevTitle
      if (meta) meta.setAttribute('content', prevDesc)
    }
  }, [article])

  return (
    <article className="learn-article">
      <button type="button" className="btn ghost friend-back" onClick={onBack}>
        ← All guides
      </button>
      <header className="learn-article-header">
        <p className="learn-meta">
          {article.readMinutes} min read · Wine basics
        </p>
        <h1 className="learn-article-title">{article.title}</h1>
        <p className="learn-article-summary">{article.summary}</p>
      </header>
      {article.sections.map((section, i) => (
        <section className="learn-section" key={i}>
          {section.heading && <h2 className="learn-section-heading">{section.heading}</h2>}
          {section.paragraphs.map((p, j) => (
            <p className="learn-paragraph" key={j}>
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  )
}

function LearnIndex({ onSelect }: { onSelect: (slug: string) => void }) {
  useEffect(() => {
    const prevTitle = document.title
    const meta = document.querySelector('meta[name="description"]')
    const prevDesc = meta?.getAttribute('content') ?? ''
    const desc =
      'Short wine guides: types, taste, labels, and serving — from Decanti, your personal wine cellar app.'

    document.title = 'Wine basics — Decanti Learn'
    if (meta) meta.setAttribute('content', desc)

    return () => {
      document.title = prevTitle
      if (meta) meta.setAttribute('content', prevDesc)
    }
  }, [])

  return (
    <div className="learn-index">
      <header className="learn-hero">
        <h1 className="learn-hero-title">Wine basics</h1>
        <p className="learn-hero-lead">
          Bite-size guides you can read in a few minutes. We&apos;ll add more topics over time — varietals,
          regions, and food pairing next.
        </p>
        {!isNativeApp() && (
          <p className="learn-hero-note account-hint">
            Share this section with{' '}
            <code className="learn-url-hint">?view=learn</code> in the URL.
          </p>
        )}
      </header>
      <ol className="learn-list">
        {LEARN_ARTICLES.map((article) => (
          <li key={article.slug}>
            <button
              type="button"
              className="learn-card"
              onClick={() => onSelect(article.slug)}
            >
              <span className="learn-card-title">{article.title}</span>
              <span className="learn-card-summary">{article.summary}</span>
              <span className="learn-card-meta">{article.readMinutes} min read</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function LearnPanel({ articleSlug, onArticleChange, onBack }: Props) {
  const article = articleSlug ? learnArticleBySlug(articleSlug) : undefined

  if (articleSlug && !article) {
    return (
      <div className="learn-index">
        <button type="button" className="btn ghost friend-back" onClick={onBack}>
          ← Back
        </button>
        <section className="empty">
          <p>That guide is not available yet.</p>
          <button type="button" className="btn ghost small" onClick={() => onArticleChange(null)}>
            See all guides
          </button>
        </section>
      </div>
    )
  }

  if (article) {
    return <LearnArticleView article={article} onBack={() => onArticleChange(null)} />
  }

  return (
    <>
      <button type="button" className="btn ghost friend-back" onClick={onBack}>
        ← Back
      </button>
      <LearnIndex onSelect={onArticleChange} />
    </>
  )
}
