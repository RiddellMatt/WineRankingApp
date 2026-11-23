import { scoreColor } from '../lib/scoreScale'

const SCORE_GUIDE: {
  score: number
  enjoymentTitle: string
  enjoyment: string
  valueTitle: string
  value: string
}[] = [
  {
    score: 1,
    enjoymentTitle: 'Not for you',
    enjoyment: 'Something is wrong with the glass. You would send it back or pour it out.',
    valueTitle: 'Not worth it',
    value: 'The price and the glass do not belong together. You would not pay it again.',
  },
  {
    score: 2,
    enjoymentTitle: 'Flawed',
    enjoyment: 'You can taste a problem, or it simply misses. You finish it only to be polite.',
    valueTitle: 'Poor value',
    value: 'You overpaid. A cheaper bottle would have done the same job.',
  },
  {
    score: 3,
    enjoymentTitle: 'Forgettable',
    enjoyment: 'Drinkable, and that is the best of it. You would not order it again.',
    valueTitle: 'Weak value',
    value: 'Only fine if someone else is paying. At this price you expected more.',
  },
  {
    score: 4,
    enjoymentTitle: 'Short of the mark',
    enjoyment: 'A few nice notes, then it falls short of what you wanted from the bottle.',
    valueTitle: 'Hard to justify',
    value: 'A few nice things, then the price gets in the way. You would not buy it again at this price.',
  },
  {
    score: 5,
    enjoymentTitle: 'Fine',
    enjoyment: 'You would drink it if it were poured. You would not think about it later.',
    valueTitle: 'Fair',
    value: 'About what the price suggests. Neither a deal nor a regret.',
  },
  {
    score: 6,
    enjoymentTitle: 'Pleasant',
    enjoyment: 'You liked it. Nothing here would make you go out of your way for another bottle.',
    valueTitle: 'Decent value',
    value: 'You got what you paid for, with a little room to spare.',
  },
  {
    score: 7,
    enjoymentTitle: 'Good',
    enjoyment: 'You would recommend it, and you would be happy to drink it again.',
    valueTitle: 'Good value',
    value: 'Worth the money. You would buy it again at this price.',
  },
  {
    score: 8,
    enjoymentTitle: 'Really good',
    enjoyment: 'You would order it on purpose, and you would tell a friend about it.',
    valueTitle: 'Strong value',
    value: 'Clearly worth what you paid. You would tell a friend about the price.',
  },
  {
    score: 9,
    enjoymentTitle: 'Excellent',
    enjoyment: 'One of the bottles you remember. You would buy it again when you see it.',
    valueTitle: 'Excellent value',
    value: 'It overdelivers. You would pick up another bottle when you see this price.',
  },
  {
    score: 10,
    enjoymentTitle: 'As good as it gets',
    enjoyment: 'The top of your scale. You would cross town for another bottle.',
    valueTitle: 'Unbeatable',
    value: 'The best you have had for the money. You would buy every bottle you see at this price.',
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
      <p>
        Each number is two readings, kept together. Enjoyment is how much you liked drinking it,
        apart from what it cost. Value is whether the bottle was worth what you paid. A wine you
        loved can still be a 4 on value when the price is hard to justify. A modest bottle that
        overdelivers can be a 9. Leave value empty when you did not pay, or when you do not want
        price to move the bottle in your list.
      </p>

      <ol className="rating-tip-list">
        {SCORE_GUIDE.map((tip) => (
          <li key={tip.score}>
            <span className="rating-tip-score" style={{ background: scoreColor(tip.score) }}>
              {tip.score}
            </span>
            <span className="rating-tip-copy">
              <span className="rating-tip-axis">
                <span className="rating-tip-kind">Enjoyment</span>
                <span className="rating-tip-axis-text">
                  <span className="rating-tip-title">{tip.enjoymentTitle}. </span>
                  <span className="rating-tip-body">{tip.enjoyment}</span>
                </span>
              </span>
              <span className="rating-tip-axis">
                <span className="rating-tip-kind">Value</span>
                <span className="rating-tip-axis-text">
                  <span className="rating-tip-title">{tip.valueTitle}. </span>
                  <span className="rating-tip-body">{tip.value}</span>
                </span>
              </span>
            </span>
          </li>
        ))}
      </ol>

      <h4>Overall</h4>
      <p>
        Your list rank is calculated. Decanti blends enjoyment and value using the ranking
        preference in this menu. Taste-first leans on enjoyment. Value-first leans on what you
        paid. Balanced weighs them equally. When you skip value, the rank is your enjoyment score.
      </p>
    </section>
  )
}
