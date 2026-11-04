// Menu catalog used to seed the rewards marketplace.
//
// SOURCES (gathered November 2026):
//  - "official": Ema's own menu page, emajapanesecuisine.com/food-menu (dine-in prices)
//  - "chowbus":  Ema's Chowbus online-ordering store (to-go prices, often higher than dine-in)
//  - "delivery": DoorDash / Uber Eats / Yelp listings for the 6700 Woodlands Pkwy location
//                (delivery apps may add a markup, so treat these as an upper bound)
//
// priceStatus:
//  - "verified": price seen on the official menu or Ema's Chowbus store
//  - "confirm":  item name confirmed, but the price came from a third party or was not
//                visible. These are flagged "Price needs confirmation" in the app and must
//                be checked against the in-store menu before launch.
//
// Descriptions are short and factual. Where the source gave no description, we wrote a
// neutral one rather than inventing ingredients.

export const CATEGORIES = [
  { key: 'beverages', label: 'Beverages', jp: '飲み物' },
  { key: 'appetizers', label: 'Appetizers', jp: '前菜' },
  { key: 'sushi', label: 'Sushi & Rolls', jp: '寿司' },
  { key: 'entrees', label: 'Entrées', jp: '主菜' },
  { key: 'specialty', label: 'Specialty', jp: '特選' },
  { key: 'exclusive', label: 'Exclusive', jp: '限定' },
];

export const MENU = [
  // Beverages – the official menu lists the categories, but no prices were visible.
  { id: 'soft-drink', name: 'Soft Drink', category: 'beverages', price: 3.0, priceStatus: 'confirm', source: 'official (category only)', description: 'Any fountain soft drink.' },
  { id: 'japanese-soda', name: 'Japanese Soda', category: 'beverages', price: 4.0, priceStatus: 'confirm', source: 'official (category only)', description: 'Classic Japanese marble-bottle soda.' },
  { id: 'lychee-rose-tea', name: 'Lychee Rose Green Tea', category: 'beverages', price: 5.0, priceStatus: 'confirm', source: 'emajapanesecuisine.com', description: 'House specialty tea featured on Ema’s homepage.' },
  { id: 'bubble-tea', name: 'Bubble Tea', category: 'beverages', price: 6.0, priceStatus: 'confirm', source: 'Yelp category', description: 'Milk or fruit tea with tapioca pearls.' },

  // Appetizers
  { id: 'edamame', name: 'Edamame', category: 'appetizers', price: 5.0, priceStatus: 'verified', source: 'official', description: 'Steamed soybeans with sea salt.' },
  { id: 'spicy-garlic-edamame', name: 'Spicy Garlic Edamame', category: 'appetizers', price: 5.0, priceStatus: 'verified', source: 'official', description: 'Edamame tossed in spicy garlic.' },
  { id: 'fried-spring-roll', name: 'Fried Spring Roll', category: 'appetizers', price: 5.5, priceStatus: 'verified', source: 'chowbus (to-go)', description: 'Crispy fried spring rolls.' },
  { id: 'pork-gyoza', name: 'Pork Gyoza', category: 'appetizers', price: 6.0, priceStatus: 'verified', source: 'official', description: 'Pan-fried pork dumplings.' },
  { id: 'crab-puff', name: 'Crab Puff', category: 'appetizers', price: 6.6, priceStatus: 'confirm', source: 'delivery', description: 'Crispy wonton puffs with crab filling.' },
  { id: 'crispy-sushi-rice', name: 'Crispy Sushi Rice', category: 'appetizers', price: 8.0, priceStatus: 'verified', source: 'official', description: 'Golden-fried sushi rice with a fresh topping.' },
  { id: 'sake-abalone', name: 'Sake-Simmered Abalone', category: 'appetizers', price: 8.0, priceStatus: 'verified', source: 'official', description: 'Cold appetizer of abalone gently simmered in sake.' },
  { id: 'seven-spice-calamari', name: 'Seven-Spiced Calamari', category: 'appetizers', price: 9.0, priceStatus: 'verified', source: 'official', description: 'Fried calamari dusted with shichimi seven-spice.' },
  { id: 'mini-ema-don', name: 'Mini Ema Don', category: 'appetizers', price: 10.0, priceStatus: 'verified', source: 'official', description: 'A small rice bowl topped with the chef’s selection of sashimi.' },

  // Sushi & rolls
  { id: 'salmon-nigiri', name: 'Salmon Sushi (1 pc)', category: 'sushi', price: 2.5, priceStatus: 'verified', source: 'official', description: 'Fresh salmon over seasoned rice.' },
  { id: 'unagi-nigiri', name: 'Unagi Sushi (1 pc)', category: 'sushi', price: 2.5, priceStatus: 'verified', source: 'official', description: 'Grilled freshwater eel with eel sauce.' },
  { id: 'california-roll', name: 'California Roll', category: 'sushi', price: 6.0, priceStatus: 'verified', source: 'chowbus', description: 'Crab stick, avocado and cucumber.' },
  { id: 'spicy-tuna-roll', name: 'Spicy Tuna Roll', category: 'sushi', price: 7.0, priceStatus: 'verified', source: 'chowbus', description: 'Tuna with spicy mayo.' },
  { id: 'volcano-roll', name: 'Volcano Roll', category: 'sushi', price: 13.2, priceStatus: 'confirm', source: 'Yelp', description: 'House specialty roll.' },
  { id: 'shaggy-dog-roll', name: 'Shaggy Dog Roll (Spicy)', category: 'sushi', price: 14.3, priceStatus: 'confirm', source: 'delivery', description: 'Spicy specialty roll.' },
  { id: 'flaming-lips-roll', name: 'Flaming Lips Roll', category: 'sushi', price: 15.0, priceStatus: 'confirm', source: 'Yelp', description: 'House specialty roll.' },
  { id: 'astro-roll', name: 'Astro Roll', category: 'sushi', price: 15.4, priceStatus: 'confirm', source: 'Yelp', description: 'House specialty roll.' },
  { id: 'houston-roll', name: 'Houston Roll (Spicy)', category: 'sushi', price: 16.5, priceStatus: 'confirm', source: 'delivery', description: 'Spicy specialty roll named for the city.' },
  { id: 'captain-america-roll', name: 'Captain America Roll', category: 'sushi', price: 16.5, priceStatus: 'confirm', source: 'delivery', description: 'Featured specialty roll.' },

  // Entrées
  { id: 'mini-spicy-miso-ramen', name: 'Mini Spicy Miso Ramen', category: 'entrees', price: 8.8, priceStatus: 'verified', source: 'chowbus (to-go)', description: 'Half-size bowl of spicy miso ramen.' },
  { id: 'chicken-fried-rice', name: 'Chicken Fried Rice', category: 'entrees', price: 12.0, priceStatus: 'confirm', source: 'delivery', description: 'Wok-fried rice with chicken and vegetables.' },
  { id: 'chicken-yaki-udon', name: 'Chicken Yaki Udon', category: 'entrees', price: 12.0, priceStatus: 'confirm', source: 'delivery', description: 'Stir-fried udon noodles with chicken.' },
  { id: 'grilled-short-ribs', name: 'Grilled Short Ribs', category: 'entrees', price: 15.4, priceStatus: 'confirm', source: 'delivery', description: 'From the kitchen grill.' },
  { id: 'sashimi-combo', name: 'Sashimi Combo', category: 'entrees', price: 25.9, priceStatus: 'verified', source: 'official', description: 'Chef’s assortment of sliced sashimi.' },

  // Specialty
  { id: 'ema-roll', name: 'The Ema Roll', category: 'specialty', price: 17.6, priceStatus: 'verified', source: 'chowbus (to-go)', description: 'Fresh salmon, escolar and jalapeño inside; yellowtail, ikura and yuzu sauce on top.' },
  { id: 'boss-roll', name: 'Boss Roll', category: 'specialty', price: 18.0, priceStatus: 'confirm', source: 'delivery', description: 'Premium specialty roll.' },
  { id: 'chu-toro-sushi', name: 'Chu Toro Sushi (1 pc)', category: 'specialty', price: 5.0, priceStatus: 'verified', source: 'official', description: 'Medium-fatty bluefin tuna.' },
  { id: 'toro-sushi', name: 'Toro Sushi (1 pc)', category: 'specialty', price: 7.0, priceStatus: 'verified', source: 'official', description: 'Fatty bluefin tuna belly.' },
  { id: 'wagyu-sushi', name: 'Wagyu Sushi (1 pc)', category: 'specialty', price: 10.0, priceStatus: 'verified', source: 'official', description: 'Seared wagyu beef nigiri.' },
  { id: 'bluefin-sashimi', name: 'Blue Fin Tuna Sashimi', category: 'specialty', price: 13.0, priceStatus: 'verified', source: 'official', description: 'Sliced bluefin tuna sashimi.' },

  // Exclusive (tier-gated)
  { id: 'woodlands-roll', name: 'The Woodlands Roll', category: 'exclusive', price: 22.0, priceStatus: 'confirm', source: 'official (price not visible)', description: 'Bluefin, salmon, hamachi, chu toro, white tuna, madai, chopped spicy scallop and unagi.', minTier: 'gold' },
  { id: 'unlimited-classic', name: 'Unlimited Sushi – Classic', category: 'exclusive', price: 39.95, priceStatus: 'confirm', source: 'Yelp Q&A', description: 'One guest at Ema’s signature all-you-can-eat Classic tier.', minTier: 'platinum' },
];
