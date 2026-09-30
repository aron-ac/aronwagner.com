// The two stops of the shopping day, laid out left to right. World units: the
// scene is 600 tall with the floor at FLOOR_Y. `spots` are where Rebecca stops
// to browse, `counters` sell a coffee or a treat, and `sections` label the aisles.
// Item names refer to sprites in sprites.js.

const target = {
  id: 'target',
  name: 'Target',
  short: 'TARGET',
  length: 3500,
  theme: 'target',
  exitLabel: 'CHECKOUT',
  sections: [
    { name: 'COFFEE', x: 390 },
    { name: 'DOLLAR SECTION', x: 720 },
    { name: 'HOME', x: 1120 },
    { name: 'DECOR', x: 1600 },
    { name: 'BEAUTY', x: 2060 },
    { name: 'BABY', x: 2500 },
    { name: 'STYLE', x: 2930 },
    { name: 'CHECKOUT', x: 3350 },
  ],
  spots: [
    { id: 'dollar', x: 720, dept: 'dollar', fixture: 'dollar' },
    { id: 'home-a', x: 1000, dept: 'home', fixture: 'table' },
    { id: 'home-b', x: 1240, dept: 'home', fixture: 'endcap' },
    { id: 'decor-a', x: 1480, dept: 'decor', fixture: 'table' },
    { id: 'decor-b', x: 1720, dept: 'decor', fixture: 'endcap' },
    { id: 'beauty-a', x: 1960, dept: 'beauty', fixture: 'endcap' },
    { id: 'beauty-b', x: 2160, dept: 'beauty', fixture: 'table' },
    { id: 'baby-a', x: 2400, dept: 'baby', fixture: 'table' },
    { id: 'baby-b', x: 2600, dept: 'baby', fixture: 'endcap' },
    { id: 'style-a', x: 2840, dept: 'style', fixture: 'rack' },
    { id: 'style-b', x: 3030, dept: 'style', fixture: 'rack' },
  ],
  mustVisit: 'style',
  outfitDepts: ['style'],
  outfitIcon: 'cardigan',
  counters: [
    { id: 'coffee', x: 390, kind: 'coffee', name: 'Iced latte', price: 6, icon: 'iced-latte' },
  ],
  craving: 'coffee',
  pickups: [
    { id: 'coupon-1', kind: 'coupon', x: 880 },
    { id: 'coupon-2', kind: 'coupon', x: 1850 },
    { id: 'coupon-3', kind: 'coupon', x: 2720 },
  ],
  exit: { x: 3240, spot: 3330 },
  spawn: { aron: 110, rebecca: 230 },
  items: {
    dollar: [
      ['Seasonal mug', 5, 2, 'seasonal-mug'],
      ['Tiny pumpkins', 5, 1, 'pumpkins'],
    ],
    home: [
      ['Throw blanket', 35, 2, 'throw-blanket'],
      ['Candle', 14, 1, 'candle'],
      ['Throw pillow', 24, 2, 'throw-pillow'],
    ],
    decor: [
      ['Faux olive tree', 60, 3, 'olive-tree'],
      ['Woven basket', 22, 1, 'basket'],
      ['Table lamp', 45, 2, 'lamp'],
    ],
    beauty: [
      ['Lip gloss', 9, 1, 'lip-gloss'],
      ['Face masks', 12, 2, 'face-masks'],
      ['Perfume mini', 28, 2, 'perfume'],
    ],
    baby: [
      ['Onesies for Jack', 20, 3, 'onesies'],
      ['Board books', 12, 2, 'board-books'],
      ['Teddy bear', 16, 2, 'teddy-bear'],
    ],
    style: [
      ['Cardigan', 32, 2, 'cardigan'],
      ['Jeans', 38, 2, 'jeans'],
    ],
  },
};

const mall = {
  id: 'mall',
  name: 'International Plaza',
  short: 'THE MALL',
  length: 3800,
  theme: 'mall',
  exitLabel: 'EXIT',
  sections: [],
  storefronts: [
    { name: 'Sugar Rush', x: 850, color: '#f6d3c0', display: ['cupcake', 'cupcake', 'cupcake'] },
    { name: 'Palm & Linen', x: 1110, color: '#e6c9b8', display: ['sundress', 'handbag'] },
    { name: 'Sole Mates', x: 1500, color: '#c9d8e6', display: ['sandals', 'sneakers'] },
    { name: 'Glow Bar', x: 1820, color: '#f0c9d4', display: ['perfume', 'lip-gloss'] },
    { name: 'Sparkle & Co.', x: 2440, color: '#d9d0ee', display: ['necklace', 'earrings'] },
    { name: 'Page Turner', x: 2720, color: '#e8dcc0', display: ['novel', 'board-books'] },
    { name: 'Shade', x: 3000, color: '#c7e3e8', display: ['sunglasses', 'sun-hat'] },
    { name: 'Little Ones', x: 3280, color: '#f3e2b3', display: ['teddy-bear', 'onesies'] },
  ],
  fountain: 2130,
  spots: [
    { id: 'boutique-a', x: 1040, dept: 'boutique' },
    { id: 'boutique-b', x: 1190, dept: 'boutique' },
    { id: 'shoes', x: 1500, dept: 'shoes' },
    { id: 'beauty', x: 1820, dept: 'beauty' },
    { id: 'jewelry', x: 2440, dept: 'jewelry' },
    { id: 'books', x: 2720, dept: 'books' },
    { id: 'sunglasses', x: 3000, dept: 'sunglasses' },
    { id: 'kids', x: 3280, dept: 'kids' },
  ],
  mustVisit: 'boutique',
  outfitDepts: ['boutique', 'shoes'],
  outfitIcon: 'sundress',
  counters: [
    { id: 'sweets', x: 850, kind: 'treat', name: 'Cupcake', price: 5, icon: 'cupcake' },
    { id: 'coffee', x: 2330, kind: 'coffee', name: 'Iced latte', price: 6, icon: 'iced-latte' },
  ],
  craving: 'treat',
  pickups: [
    { id: 'coupon-1', kind: 'coupon', x: 1340 },
    { id: 'coupon-2', kind: 'coupon', x: 2260 },
    { id: 'coupon-3', kind: 'coupon', x: 3140 },
  ],
  exit: { x: 3540, spot: 3640 },
  spawn: { aron: 110, rebecca: 230 },
  items: {
    boutique: [
      ['Sundress', 68, 2, 'sundress'],
      ['Handbag', 120, 3, 'handbag'],
    ],
    shoes: [
      ['Sandals', 55, 2, 'sandals'],
      ['White sneakers', 80, 2, 'sneakers'],
    ],
    beauty: [
      ['Perfume', 95, 3, 'perfume'],
      ['Lip gloss', 18, 1, 'lip-gloss'],
    ],
    jewelry: [
      ['Necklace', 85, 3, 'necklace'],
      ['Gold hoops', 40, 2, 'earrings'],
    ],
    books: [['A new novel', 18, 2, 'novel']],
    sunglasses: [
      ['Sunglasses', 45, 2, 'sunglasses'],
      ['Sun hat', 30, 1, 'sun-hat'],
    ],
    kids: [
      ['Teddy bear for Jack', 22, 2, 'teddy-bear'],
      ['Outfit for Jack', 30, 3, 'onesies'],
    ],
  },
};

export const STORES = [target, mall];
