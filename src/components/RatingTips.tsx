import { scoreColor } from '../lib/scoreScale'

const SCORE_GUIDE: { score: number; title: string; body: string }[] = [
  {
    score: 1,
    title: 'Not for you',
    body: 'Something is wrong with the glass. You would send it back or pour it out.',
  },
  {
    score: 2,
    title: 'Flawed',
    body: 'You can taste a problem, or it simply misses. You finish it only to be polite.',
  },
  {
    score: 3,
    title: 'Forgettable',
    body: 'Drinkable, and that is the best of it. You would not order it again.',
  },
  {
    score: 4,
    title: 'Short of the mark',
    body: 'A few nice notes, then it falls short of what you wanted from the bottle.',
  },
  {
    score: 5,
    title: 'Fine',
    body: 'You would drink it if it were poured. You would not think about it later.',
  },
  {
    score: 6,
    title: 'Pleasant',
    body: 'You liked it. Nothing here would make you go out of your way for another bottle.',
  },
  {
    score: 7,
    title: 'Good',
    body: 'You would recommend it, and you would be happy to drink it again.',
  },
  {
    score: 8,
    title: 'Really good',
    body: 'You would order it on purpose, and you would tell a friend about it.',
  },
  {
    score: 9,
    title: 'Excellent',
    body: 'One of the bottles you remember. You would buy it again when you see it.',
  },
  {
    score: 10,
    title: 'As good as it gets',
    body: 'The top of your scale. You would cross town for another bottle.',
  },
]

export function RatingTips() {
  return (
    <section className="account-section rating-tips">
      <h3>Rating tips</h3>
      <p>
        Scores run from 1 to 10. The slider moves in quarter steps, so 7.25, 7.5, and 7.75 sit
        between the whole numbers. Drag the bar, or tap the score and type. A number that is not
        on a quarter step is rounded to the nearest one.
      </p>
      <p>The bar is dark red at the bottom, yellow in the middle, and dark green at a 10. A 7 is already green, and a 10 is a deeper green.</p>

      <h4>Enjoyment</h4>
      <p>Enjoyment is how much you liked drinking it, apart from what it cost.</p>
      <ol className="rating-tip-list">
        {SCORE_GUIDE.map((tip) => (
          <li key={tip.score}>
            <span className="rating-tip-score" style={{ background: scoreColor(tip.score) }}>
              {tip.score}
            </span>
            <span className="rating-tip-copy">
              <span className="rating-tip-title">{tip.title}</span>
              <span className="rating-tip-body">{tip.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <h4>Value</h4>
      <p>
        Value uses the same 1 to 10 for whether the bottle was worth what you paid. A wine you
        loved can still be a 4 on value when the price is hard to justify. A modest bottle that
        overdelivers can be a 9. Leave value empty when you did not pay, or when you do not want
        price to move the bottle in your list.
      </p>

      <h4>Overall</h4>
      <p>
        Your list rank is calculated. Decanti blends enjoyment and value using the ranking
        preference in this menu. Taste-first leans on enjoyment. Value-first leans on what you
        paid. Balanced weighs them equally. When you skip value, the rank is your enjoyment score.
      </p>
    </section>
  )
}
