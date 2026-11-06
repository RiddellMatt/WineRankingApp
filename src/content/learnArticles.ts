export interface LearnSection {
  heading?: string
  paragraphs: string[]
}

export interface LearnArticle {
  slug: string
  title: string
  summary: string
  readMinutes: number
  sections: LearnSection[]
}

/** Static guides — add slugs here as the library grows. */
export const LEARN_ARTICLES: LearnArticle[] = [
  {
    slug: 'wine-types',
    title: 'Red, white, rosé & sparkling',
    summary: 'How color and winemaking shape what is in your glass.',
    readMinutes: 3,
    sections: [
      {
        paragraphs: [
          'Wine color comes mostly from grape skins, not the juice inside. Red wines ferment with skins for days or weeks, picking up color, tannins, and many aromas. Most white wines are pressed and fermented without skins, which keeps them lighter in body and tannin.',
        ],
      },
      {
        heading: 'Rosé',
        paragraphs: [
          'Rosé sits in the middle: skins contact the juice for a short time (hours to a couple of days), enough for a pink hue and some red-fruit character without full red-wine structure.',
        ],
      },
      {
        heading: 'Sparkling',
        paragraphs: [
          'Sparkling wine is about bubbles. Champagne-style wines get a second fermentation in the bottle; Prosecco often uses a tank method for fresher, fruit-forward bubbles. Bubbles add texture — Decanti’s “gentle vs fizzy” slider is a simple read on that feel.',
        ],
      },
    ],
  },
  {
    slug: 'taste-in-decanti',
    title: 'Reading Decanti’s taste sliders',
    summary: 'Light vs bold, dry vs sweet, and what they mean when you rate a bottle.',
    readMinutes: 4,
    sections: [
      {
        paragraphs: [
          'When you log a wine, the four sliders describe your experience — not a lab score. They help you compare bottles later and explain your taste to friends.',
        ],
      },
      {
        heading: 'Light ↔ Bold',
        paragraphs: [
          'Think weight and intensity in the mouth. A light Pinot Grigio feels lean; a bold Napa Cabernet coats the palate. Alcohol, oak, and extract all push a wine toward “bold.”',
        ],
      },
      {
        heading: 'Smooth ↔ Tannic',
        paragraphs: [
          'Tannins come from grape skins, seeds, and oak. They create grip and dryness on the gums — common in young reds. With age or careful winemaking, tannins feel smoother and integrated.',
        ],
      },
      {
        heading: 'Dry ↔ Sweet',
        paragraphs: [
          'Dry means little or no noticeable sugar. Off-dry Rieslings and many Proseccos have a touch of sweetness balanced by acidity. Dessert wines are intentionally sweet.',
        ],
      },
      {
        heading: 'Soft ↔ Acidic',
        paragraphs: [
          'Acidity is the “fresh” sensation that makes wine food-friendly. High-acid wines (many Sauvignon Blancs, cool-climate Chardonnays) feel crisp; low-acid wines feel rounder and softer.',
        ],
      },
    ],
  },
  {
    slug: 'label-clues',
    title: 'What the label is telling you',
    summary: 'Region, grape, vintage, and a few words that hint at style.',
    readMinutes: 3,
    sections: [
      {
        paragraphs: [
          'Labels vary by country, but most tell you who made the wine, where it comes from, and often which grape or blend is inside.',
        ],
      },
      {
        heading: 'Region vs grape',
        paragraphs: [
          'Old World labels (France, Italy, Spain) often lead with place: “Barolo” implies Nebbiolo from Piedmont. New World labels (US, Chile, Australia) usually put the grape name front and center — “Cabernet Sauvignon.”',
        ],
      },
      {
        heading: 'Vintage',
        paragraphs: [
          'The year on the label is the harvest year, not when it was bottled. In cool regions, vintage matters more; everyday table wines are often blended for consistency year to year.',
        ],
      },
      {
        heading: 'Clues in small print',
        paragraphs: [
          'Terms like Reserva, Riserva, or Grand Cru can signal longer aging or a higher tier within a producer’s range — rules differ by country. When in doubt, a quick search of the producer or appellation name goes a long way.',
        ],
      },
    ],
  },
  {
    slug: 'serve-and-keep',
    title: 'Serving temperature & keeping bottles',
    summary: 'Simple rules so opened and unopened wines show their best.',
    readMinutes: 3,
    sections: [
      {
        paragraphs: [
          'Temperature changes how aromas and alcohol show up. Too cold mutes flavor; too warm makes wine taste flabby or hot.',
        ],
      },
      {
        heading: 'Quick serving guide',
        paragraphs: [
          'Sparkling & light whites: well chilled (around 40–45°F / 4–7°C). Full whites & rosé: cool (45–50°F). Light reds: slightly cool (55–60°F). Big reds: room cool (60–65°F), not warm room temperature.',
        ],
      },
      {
        heading: 'After you open',
        paragraphs: [
          'Recork and refrigerate; most wines are fine for 2–3 days. Use a vacuum stopper if you have one. Oxygen is what slowly flattens an open bottle.',
        ],
      },
      {
        heading: 'Unopened bottles at home',
        paragraphs: [
          'Store away from heat and direct sun, ideally on their side if they have a cork. You do not need a cellar for everyday drinking — a cool closet or interior rack works for bottles you plan to drink within a year or two.',
        ],
      },
    ],
  },
]

export function learnArticleBySlug(slug: string): LearnArticle | undefined {
  return LEARN_ARTICLES.find((a) => a.slug === slug)
}
