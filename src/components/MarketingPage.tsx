import { APP_DESCRIPTION, APP_NAME, APP_STORE_URL, PLAY_STORE_URL, SITE_URL } from '../brand'
import { PRO_CONFIG } from '../config'
import { DecantiLogo } from './DecantiLogo'

interface Props {
  onOpenApp: () => void
}

const FAQS = [
  {
    question: 'What is Decanti?',
    answer:
      'Decanti is a wine ranking app. You rate bottles you have tried, keep a want-to-try list, and share that cellar with friends.',
  },
  {
    question: 'Is Decanti free?',
    answer: `Decanti is free to start, including two AI menu scans. ${APP_NAME} Pro is ${PRO_CONFIG.priceLabel} and adds a larger cellar, label scans, more menu scans, and insights.`,
  },
  {
    question: 'Can I use Decanti on iPhone or Android?',
    answer:
      'Decanti is built for iPhone and Android, and the same account works on the web. Open Decanti here while the App Store and Google Play listings are being published.',
  },
  {
    question: 'Can I rank wines with friends?',
    answer:
      'Yes. Share your invite code, or add a friend with the email they use to sign in. When someone new rates a wine with your code, you each get a month of Pro.',
  },
] as const

export function MarketingPage({ onOpenApp }: Props) {
  const privacyHref = `${import.meta.env.BASE_URL}privacy.html`
  const termsHref = `${import.meta.env.BASE_URL}terms.html`

  return (
    <div className="mkt">
      <header className="mkt-bar">
        <a className="mkt-brand" href={SITE_URL}>
          <DecantiLogo context="header" />
          <span className="brand-wordmark">{APP_NAME}</span>
        </a>
        <button type="button" className="btn ghost" onClick={onOpenApp}>
          Sign in
        </button>
      </header>

      <main>
        <section className="mkt-hero">
          <p className="mkt-kicker">Wine ranking app</p>
          <h1>Rank every wine you try.</h1>
          <p className="mkt-lead">{APP_DESCRIPTION}</p>
          <div className="mkt-actions">
            <button type="button" className="btn primary" onClick={onOpenApp}>
              Open Decanti
            </button>
            {APP_STORE_URL ? (
              <a className="btn ghost" href={APP_STORE_URL}>
                Download for iPhone
              </a>
            ) : null}
            {PLAY_STORE_URL ? (
              <a className="btn ghost" href={PLAY_STORE_URL}>
                Get it on Google Play
              </a>
            ) : null}
          </div>
        </section>

        <section className="mkt-section" aria-labelledby="mkt-cellar">
          <h2 id="mkt-cellar">A cellar that stays in order</h2>
          <p>
            Log the winery, vintage, region, price, and what you thought. Ratings run from 1 to
            10, and your list stays ranked so the bottles you would buy again sit at the top.
          </p>
          <p>
            Save a bottle you have not opened yet. When you are in a shop or staring at a restaurant
            list, the want-to-try list is the short version of your taste.
          </p>
        </section>

        <section className="mkt-section" aria-labelledby="mkt-scan">
          <h2 id="mkt-scan">Scan a label or a menu</h2>
          <p>
            Decanti Pro reads a photo of a label and fills in the wine for you to check. Point it
            at a restaurant list and it lines those bottles up with what you already like, then
            tells you why.
          </p>
        </section>

        <section className="mkt-section" aria-labelledby="mkt-friends">
          <h2 id="mkt-friends">Drink with friends</h2>
          <p>
            Follow people you actually know. See their recent bottles, compare regions on a wine
            passport, and keep your own notes private until you decide to share a wine.
          </p>
        </section>

        <section className="mkt-section" aria-labelledby="mkt-get">
          <h2 id="mkt-get">Get the app</h2>
          <p>
            Decanti on iPhone and Android uses this same account. The App Store and Google Play
            listings are not public yet, so this page is where you open the app today. On a phone,
            use the browser share menu and add Decanti to your home screen.
          </p>
          <button type="button" className="btn primary" onClick={onOpenApp}>
            Open Decanti
          </button>
        </section>

        <section className="mkt-section" aria-labelledby="mkt-guides">
          <h2 id="mkt-guides">Ways to use it</h2>
          <p>A few pages for the jobs Decanti is built for.</p>
          <p className="mkt-guides">
            <a href={`${import.meta.env.BASE_URL}wine-journal.html`}>Wine journal</a>
            <a href={`${import.meta.env.BASE_URL}restaurant-wine-list.html`}>Restaurant wine list</a>
            <a href={`${import.meta.env.BASE_URL}cellar-tracker.html`}>Cellar tracker</a>
          </p>
        </section>

        <section className="mkt-section" aria-labelledby="mkt-faq">
          <h2 id="mkt-faq">Questions</h2>
          <div className="mkt-faq">
            {FAQS.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="mkt-foot">
        <a href={privacyHref}>Privacy policy</a>
        <a href={termsHref}>Terms of use</a>
        <span>Decanti, a wine ranking app for the bottles you have tried.</span>
      </footer>
    </div>
  )
}
