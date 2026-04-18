// lib/foods.ts — Nutrient database (from Vitro, extended)
export type FoodCategory = 'grains'|'protein'|'dairy'|'fruits'|'veggies'|'snacks'|'indian'

export interface Food {
  id: number; emoji: string; name: string; cal: number
  protein: number; carbs: number; fat: number; fiber: number
  category: FoodCategory; per: string; insight: string
}

export const foodDatabase: Food[] = [
  { id:1, emoji:'🍚', name:'Cooked rice', cal:130, protein:2.7, carbs:28, fat:0.3, fiber:0.4, category:'grains', per:'100g', insight:'Great energy source. Pair with dal or lean protein for a complete amino acid profile.' },
  { id:2, emoji:'🫓', name:'Chapati / roti', cal:104, protein:3.1, carbs:18, fat:2.8, fiber:1.9, category:'indian', per:'1 piece (40g)', insight:'More fibre than plain rice. Whole wheat version helps with sustained energy and blood sugar.' },
  { id:3, emoji:'🥚', name:'Boiled egg', cal:78, protein:6.3, carbs:0.6, fat:5.3, fiber:0, category:'protein', per:'1 large', insight:'All 9 essential amino acids. One of the highest bioavailable protein sources — ideal post-workout.' },
  { id:4, emoji:'🍗', name:'Chicken breast', cal:165, protein:31, carbs:0, fat:3.6, fiber:0, category:'protein', per:'100g cooked', insight:'Best protein-to-calorie ratio of common meats. Perfect for fat loss while preserving muscle.' },
  { id:5, emoji:'🥛', name:'Full cream milk', cal:61, protein:3.2, carbs:4.8, fat:3.3, fiber:0, category:'dairy', per:'100ml', insight:'Rich in calcium and casein. Best before bed for overnight muscle repair.' },
  { id:6, emoji:'🫙', name:'Greek yogurt', cal:59, protein:10, carbs:3.6, fat:0.4, fiber:0, category:'dairy', per:'100g', insight:'High protein, low fat, great for gut health. Excellent post-workout snack.' },
  { id:7, emoji:'🍌', name:'Banana', cal:89, protein:1.1, carbs:23, fat:0.3, fiber:2.6, category:'fruits', per:'100g', insight:'Quick natural energy with potassium for muscle cramps. Best pre-workout.' },
  { id:8, emoji:'🍎', name:'Apple', cal:52, protein:0.3, carbs:14, fat:0.2, fiber:2.4, category:'fruits', per:'100g', insight:'Low calorie, high fibre. Keeps you full and steady — great mid-morning snack.' },
  { id:9, emoji:'🥦', name:'Broccoli', cal:34, protein:2.8, carbs:7, fat:0.4, fiber:2.6, category:'veggies', per:'100g', insight:'Vitamin C, K, and folate powerhouse. Anti-inflammatory and anti-cancer compounds.' },
  { id:10, emoji:'🥕', name:'Carrot', cal:41, protein:0.9, carbs:10, fat:0.2, fiber:2.8, category:'veggies', per:'100g', insight:'Beta-carotene (vitamin A) for eye health. Great raw as a crunchy snack.' },
  { id:11, emoji:'🫘', name:'Dal (lentils)', cal:116, protein:9, carbs:20, fat:0.4, fiber:7.9, category:'indian', per:'100g cooked', insight:'Plant-based protein powerhouse. Rice+dal = complete amino acid profile — the perfect vegetarian meal.' },
  { id:12, emoji:'🥜', name:'Peanut butter', cal:588, protein:25, carbs:20, fat:50, fiber:6, category:'snacks', per:'100g', insight:'Calorie dense — 1 tbsp is ~94 kcal. Great healthy fat but strict portion control is key.' },
  { id:13, emoji:'🧀', name:'Paneer', cal:265, protein:18, carbs:1.2, fat:21, fiber:0, category:'indian', per:'100g', insight:'Rich in casein protein and calcium. Best grilled or baked — avoid frying for lower fat.' },
  { id:14, emoji:'🌾', name:'Oats', cal:389, protein:17, carbs:66, fat:7, fiber:10, category:'grains', per:'100g dry', insight:'Beta-glucan fibre lowers cholesterol and stabilises blood sugar. Ideal breakfast.' },
  { id:15, emoji:'🐟', name:'Salmon', cal:208, protein:20, carbs:0, fat:13, fiber:0, category:'protein', per:'100g', insight:'Omega-3 fatty acids reduce inflammation and support brain health — great for recovery.' },
  { id:16, emoji:'🥑', name:'Avocado', cal:160, protein:2, carbs:9, fat:15, fiber:7, category:'fruits', per:'100g', insight:'Heart-healthy monounsaturated fats and potassium. High fibre keeps you full for hours.' },
  { id:17, emoji:'🍠', name:'Sweet potato', cal:86, protein:1.6, carbs:20, fat:0.1, fiber:3, category:'veggies', per:'100g', insight:'Complex carbs with low GI. Rich in vitamin A. Ideal pre-workout carb source.' },
  { id:18, emoji:'🫐', name:'Blueberries', cal:57, protein:0.7, carbs:14, fat:0.3, fiber:2.4, category:'fruits', per:'100g', insight:'Antioxidant powerhouse. Anthocyanins reduce inflammation and oxidative stress from exercise.' },
  { id:19, emoji:'🥩', name:'Mutton / lamb', cal:258, protein:25, carbs:0, fat:17, fiber:0, category:'protein', per:'100g cooked', insight:'High in iron, zinc and B12. Good for anaemia prevention. Best 2–3 times a week.' },
  { id:20, emoji:'🍫', name:'Dark chocolate 70%', cal:598, protein:7.8, carbs:46, fat:42, fiber:10.9, category:'snacks', per:'100g', insight:'Rich in magnesium and antioxidants. A 20–25g portion is a healthy treat daily.' },
  { id:21, emoji:'🫚', name:'Olive oil', cal:884, protein:0, carbs:0, fat:100, fiber:0, category:'snacks', per:'100g', insight:'Rich in oleic acid (heart-healthy). Use 1 tbsp (14g ≈ 120 kcal) for cooking or dressing.' },
  { id:22, emoji:'🌰', name:'Almonds', cal:579, protein:21, carbs:22, fat:50, fiber:13, category:'snacks', per:'100g', insight:'A handful (28g) = 164 kcal. Excellent for satiety, vitamin E, and magnesium.' },
  { id:23, emoji:'🍳', name:'Idli (steamed)', cal:39, protein:2, carbs:8, fat:0.2, fiber:0.5, category:'indian', per:'1 piece (40g)', insight:'Low calorie, easy to digest. Fermentation improves bioavailability of B vitamins.' },
  { id:24, emoji:'🥗', name:'Quinoa', cal:120, protein:4.4, carbs:21, fat:1.9, fiber:2.8, category:'grains', per:'100g cooked', insight:'One of the few plant foods with all 9 essential amino acids. High in magnesium and iron.' },
]
