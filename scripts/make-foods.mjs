// Crea src/data/foods.json: alimenti comuni con nome italiano e valori per 100 g
// presi da USDA FoodData Central, SR Legacy (pubblico dominio, CC0).
// Uso: scarica e scompatta https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
//      poi: node scripts/make-foods.mjs <cartella con food.csv e food_nutrient.csv>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// [nome italiano, categoria, descrizione USDA esatta, grammi di un pezzo (facoltativo, stima)]
const FOODS = [
  // cereali, pane, patate
  ['Pasta di semola (cruda)', 'Cereali', 'Pasta, dry, unenriched'],
  ['Pasta di semola (cotta)', 'Cereali', 'Pasta, cooked, unenriched, without added salt'],
  ['Pasta integrale (cruda)', 'Cereali', 'Pasta, whole-wheat, dry (Includes foods for USDA\'s Food Distribution Program)'],
  ['Pasta integrale (cotta)', 'Cereali', 'Pasta, whole-wheat, cooked (Includes foods for USDA\'s Food Distribution Program)'],
  ['Riso bianco (crudo)', 'Cereali', 'Rice, white, long-grain, regular, raw, unenriched'],
  ['Riso bianco (cotto)', 'Cereali', 'Rice, white, long-grain, regular, unenriched, cooked without salt'],
  ['Riso integrale (crudo)', 'Cereali', 'Rice, brown, long-grain, raw (Includes foods for USDA\'s Food Distribution Program)'],
  ['Riso integrale (cotto)', 'Cereali', 'Rice, brown, long-grain, cooked (Includes foods for USDA\'s Food Distribution Program)'],
  ['Fiocchi d\'avena', 'Cereali', 'Cereals, oats, regular and quick, not fortified, dry'],
  ['Pane bianco', 'Cereali', 'Bread, white, commercially prepared (includes soft bread crumbs)'],
  ['Pane integrale', 'Cereali', 'Bread, whole-wheat, commercially prepared'],
  ['Fette biscottate', 'Cereali', 'Crackers, melba toast, plain, without salt', 8],
  ['Gallette di riso', 'Cereali', 'Snacks, rice cakes, brown rice, plain, unsalted', 9],
  ['Farro (crudo)', 'Cereali', 'Spelt, uncooked'],
  ['Orzo perlato (crudo)', 'Cereali', 'Barley, pearled, raw'],
  ['Quinoa (cruda)', 'Cereali', 'Quinoa, uncooked'],
  ['Cous cous (crudo)', 'Cereali', 'Couscous, dry'],
  ['Farina di frumento 00', 'Cereali', 'Wheat flour, white, all-purpose, unenriched'],
  ['Farina di mais (polenta)', 'Cereali', 'Cornmeal, degermed, unenriched, yellow'],
  ['Cracker', 'Cereali', 'Crackers, saltines (includes oyster, soda, soup)'],
  ['Patate', 'Cereali', 'Potatoes, flesh and skin, raw'],
  ['Patate lesse', 'Cereali', 'Potatoes, boiled, cooked without skin, flesh, without salt'],
  ['Patate dolci', 'Cereali', 'Sweet potato, raw, unprepared (Includes foods for USDA\'s Food Distribution Program)'],
  // carne e salumi
  ['Petto di pollo (crudo)', 'Carne', 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw'],
  ['Petto di pollo (cotto)', 'Carne', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted'],
  ['Coscia di pollo senza pelle (cruda)', 'Carne', 'Chicken, broilers or fryers, dark meat, thigh, meat only, raw'],
  ['Petto di tacchino (crudo)', 'Carne', 'Turkey, retail parts, breast, meat only, raw'],
  ['Macinato di manzo magro 5% (crudo)', 'Carne', 'Beef, ground, 95% lean meat / 5% fat, raw'],
  ['Macinato di manzo 15% (crudo)', 'Carne', 'Beef, ground, 85% lean meat / 15% fat, raw (Includes foods for USDA\'s Food Distribution Program)'],
  ['Manzo, controfiletto magro (crudo)', 'Carne', 'Beef, top sirloin, steak, separable lean only, trimmed to 1/8" fat, choice, raw'],
  ['Vitello, fesa (cruda)', 'Carne', 'Veal, leg (top round), separable lean only, raw'],
  ['Lonza di maiale (cruda)', 'Carne', 'Pork, fresh, loin, center loin (chops), bone-in, separable lean only, raw'],
  ['Prosciutto cotto', 'Carne', 'Ham, sliced, regular (approximately 11% fat)'],
  ['Salame', 'Carne', 'Salami, Italian, pork'],
  ['Mortadella', 'Carne', 'Mortadella, beef, pork'],
  // pesce
  ['Salmone (crudo)', 'Pesce', 'Fish, salmon, Atlantic, farmed, raw'],
  ['Salmone affumicato', 'Pesce', 'Fish, salmon, chinook, smoked'],
  ['Tonno al naturale (sgocciolato)', 'Pesce', 'Fish, tuna, light, canned in water, drained solids (Includes foods for USDA\'s Food Distribution Program)'],
  ['Tonno sott\'olio (sgocciolato)', 'Pesce', 'Fish, tuna, light, canned in oil, drained solids'],
  ['Merluzzo (crudo)', 'Pesce', 'Fish, cod, Atlantic, raw'],
  ['Branzino (crudo)', 'Pesce', 'Fish, sea bass, mixed species, raw'],
  ['Sgombro (crudo)', 'Pesce', 'Fish, mackerel, Atlantic, raw'],
  ['Pesce spada (crudo)', 'Pesce', 'Fish, swordfish, raw'],
  ['Sardine sott\'olio (sgocciolate)', 'Pesce', 'Fish, sardine, Atlantic, canned in oil, drained solids with bone'],
  ['Gamberi (crudi)', 'Pesce', 'Crustaceans, shrimp, raw'],
  ['Calamari (crudi)', 'Pesce', 'Mollusks, squid, mixed species, raw'],
  ['Cozze (crude)', 'Pesce', 'Mollusks, mussel, blue, raw'],
  // uova e latticini
  ['Uovo intero', 'Uova e latticini', 'Egg, whole, raw, fresh', 55],
  ['Albume', 'Uova e latticini', 'Egg, white, raw, fresh', 33],
  ['Tuorlo', 'Uova e latticini', 'Egg, yolk, raw, fresh', 17],
  ['Latte intero', 'Uova e latticini', 'Milk, whole, 3.25% milkfat, with added vitamin D'],
  ['Latte parzialmente scremato', 'Uova e latticini', 'Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D'],
  ['Latte scremato', 'Uova e latticini', 'Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)'],
  ['Yogurt bianco intero', 'Uova e latticini', 'Yogurt, plain, whole milk', 125],
  ['Yogurt greco 0%', 'Uova e latticini', 'Yogurt, Greek, plain, nonfat (Includes foods for USDA\'s Food Distribution Program)', 170],
  ['Yogurt greco intero', 'Uova e latticini', 'Yogurt, Greek, plain, whole milk', 170],
  ['Parmigiano / Grana', 'Uova e latticini', 'Cheese, parmesan, hard'],
  ['Mozzarella', 'Uova e latticini', 'Cheese, mozzarella, whole milk', 125],
  ['Mozzarella light', 'Uova e latticini', 'Cheese, mozzarella, part skim milk', 125],
  ['Ricotta', 'Uova e latticini', 'Cheese, ricotta, whole milk'],
  ['Ricotta light', 'Uova e latticini', 'Cheese, ricotta, part skim milk'],
  ['Fiocchi di latte', 'Uova e latticini', 'Cheese, cottage, lowfat, 2% milkfat'],
  ['Feta', 'Uova e latticini', 'Cheese, feta'],
  ['Provolone', 'Uova e latticini', 'Cheese, provolone'],
  ['Formaggio spalmabile', 'Uova e latticini', 'Cheese, cream'],
  ['Burro', 'Uova e latticini', 'Butter, without salt'],
  ['Panna fresca', 'Uova e latticini', 'Cream, fluid, heavy whipping'],
  ['Proteine del siero (whey isolate)', 'Uova e latticini', 'Beverages, Whey protein powder isolate', 30],
  // legumi e soia
  ['Ceci secchi', 'Legumi', 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw'],
  ['Ceci lessati', 'Legumi', 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt'],
  ['Lenticchie secche', 'Legumi', 'Lentils, raw'],
  ['Lenticchie lessate', 'Legumi', 'Lentils, mature seeds, cooked, boiled, without salt'],
  ['Fagioli borlotti secchi', 'Legumi', 'Beans, cranberry (roman), mature seeds, raw'],
  ['Fagioli cannellini in scatola', 'Legumi', 'Beans, white, mature seeds, canned'],
  ['Piselli', 'Legumi', 'Peas, green, raw'],
  ['Piselli surgelati', 'Legumi', 'Peas, green, frozen, unprepared (Includes foods for USDA\'s Food Distribution Program)'],
  ['Tofu', 'Legumi', 'Tofu, raw, firm, prepared with calcium sulfate'],
  ['Bevanda di soia', 'Legumi', 'Soymilk, original and vanilla, unfortified'],
  ['Hummus', 'Legumi', 'Hummus, commercial'],
  // verdure
  ['Zucchine', 'Verdure', 'Squash, summer, zucchini, includes skin, raw'],
  ['Pomodori', 'Verdure', 'Tomatoes, red, ripe, raw, year round average'],
  ['Passata di pomodoro', 'Verdure', 'Tomato products, canned, puree, without salt added'],
  ['Lattuga', 'Verdure', 'Lettuce, green leaf, raw'],
  ['Rucola', 'Verdure', 'Arugula, raw'],
  ['Spinaci', 'Verdure', 'Spinach, raw'],
  ['Broccoli', 'Verdure', 'Broccoli, raw'],
  ['Cavolfiore', 'Verdure', 'Cauliflower, raw'],
  ['Verza', 'Verdure', 'Cabbage, savoy, raw'],
  ['Carote', 'Verdure', 'Carrots, raw'],
  ['Peperoni', 'Verdure', 'Peppers, sweet, red, raw'],
  ['Melanzane', 'Verdure', 'Eggplant, raw'],
  ['Cetrioli', 'Verdure', 'Cucumber, with peel, raw'],
  ['Cipolle', 'Verdure', 'Onions, raw'],
  ['Funghi champignon', 'Verdure', 'Mushrooms, white, raw'],
  ['Fagiolini', 'Verdure', 'Beans, snap, green, raw'],
  ['Asparagi', 'Verdure', 'Asparagus, raw'],
  ['Finocchi', 'Verdure', 'Fennel, bulb, raw'],
  ['Carciofi', 'Verdure', 'Artichokes, (globe or french), raw'],
  ['Zucca', 'Verdure', 'Pumpkin, raw'],
  ['Bietole', 'Verdure', 'Chard, swiss, raw'],
  ['Sedano', 'Verdure', 'Celery, raw'],
  ['Radicchio', 'Verdure', 'Radicchio, raw'],
  ['Mais in scatola (sgocciolato)', 'Verdure', 'Corn, sweet, yellow, canned, whole kernel, drained solids'],
  ['Olive verdi', 'Verdure', 'Olives, pickled, canned or bottled, green'],
  ['Avocado', 'Verdure', 'Avocados, raw, all commercial varieties'],
  // frutta
  ['Mela', 'Frutta', 'Apples, raw, with skin (Includes foods for USDA\'s Food Distribution Program)', 180],
  ['Banana', 'Frutta', 'Bananas, raw', 120],
  ['Arancia', 'Frutta', 'Oranges, raw, all commercial varieties', 150],
  ['Mandarino', 'Frutta', 'Tangerines, (mandarin oranges), raw', 75],
  ['Kiwi', 'Frutta', 'Kiwifruit, green, raw', 75],
  ['Pera', 'Frutta', 'Pears, raw', 170],
  ['Pesca', 'Frutta', 'Peaches, yellow, raw', 150],
  ['Albicocca', 'Frutta', 'Apricots, raw', 35],
  ['Prugna', 'Frutta', 'Plums, raw', 65],
  ['Fragole', 'Frutta', 'Strawberries, raw'],
  ['Mirtilli', 'Frutta', 'Blueberries, raw'],
  ['Lamponi', 'Frutta', 'Raspberries, raw'],
  ['Uva', 'Frutta', 'Grapes, red or green (European type, such as Thompson seedless), raw'],
  ['Ciliegie', 'Frutta', 'Cherries, sweet, raw'],
  ['Ananas', 'Frutta', 'Pineapple, raw, all varieties'],
  ['Anguria', 'Frutta', 'Watermelon, raw'],
  ['Melone', 'Frutta', 'Melons, cantaloupe, raw'],
  ['Fichi', 'Frutta', 'Figs, raw', 50],
  ['Cachi', 'Frutta', 'Persimmons, japanese, raw', 170],
  ['Melagrana', 'Frutta', 'Pomegranates, raw'],
  ['Pompelmo', 'Frutta', 'Grapefruit, raw, pink and red, all areas'],
  ['Limone (succo)', 'Frutta', 'Lemon juice, raw'],
  ['Datteri', 'Frutta', 'Dates, medjool', 24],
  ['Uvetta', 'Frutta', 'Raisins, dark, seedless (Includes foods for USDA\'s Food Distribution Program)'],
  ['Succo d\'arancia', 'Frutta', 'Orange juice, raw (Includes foods for USDA\'s Food Distribution Program)'],
  // frutta secca, semi, grassi
  ['Mandorle', 'Frutta secca e grassi', 'Nuts, almonds'],
  ['Noci', 'Frutta secca e grassi', 'Nuts, walnuts, english'],
  ['Nocciole', 'Frutta secca e grassi', 'Nuts, hazelnuts or filberts'],
  ['Anacardi', 'Frutta secca e grassi', 'Nuts, cashew nuts, raw'],
  ['Pistacchi', 'Frutta secca e grassi', 'Nuts, pistachio nuts, raw'],
  ['Arachidi', 'Frutta secca e grassi', 'Peanuts, all types, raw'],
  ['Burro di arachidi', 'Frutta secca e grassi', 'Peanut butter, smooth style, without salt'],
  ['Semi di chia', 'Frutta secca e grassi', 'Seeds, chia seeds, dried'],
  ['Semi di lino', 'Frutta secca e grassi', 'Seeds, flaxseed'],
  ['Semi di zucca', 'Frutta secca e grassi', 'Seeds, pumpkin and squash seed kernels, dried'],
  ['Olio extravergine d\'oliva', 'Frutta secca e grassi', 'Oil, olive, salad or cooking'],
  ['Olio di semi di girasole', 'Frutta secca e grassi', 'Oil, sunflower, linoleic, (approx. 65%)'],
  ['Cioccolato fondente 70-85%', 'Frutta secca e grassi', 'Chocolate, dark, 70-85% cacao solids'],
  ['Cacao amaro in polvere', 'Frutta secca e grassi', 'Cocoa, dry powder, unsweetened'],
  // altro
  ['Miele', 'Altro', 'Honey'],
  ['Zucchero', 'Altro', 'Sugars, granulated'],
  ['Marmellata', 'Altro', 'Jams and preserves'],
  ['Maionese', 'Altro', 'Salad dressing, mayonnaise, regular'],
  ['Caffè (tazzina)', 'Altro', 'Beverages, coffee, brewed, prepared with tap water'],
  ['Birra', 'Altro', 'Alcoholic beverage, beer, regular, all'],
  ['Vino rosso', 'Altro', 'Alcoholic beverage, wine, table, red'],
  ['Bibita tipo cola', 'Altro', 'Beverages, carbonated, cola, regular']
];

const NUTRIENTS = { 1008: 'kcal', 1003: 'p', 1005: 'c', 1004: 'f', 1079: 'fib', 2000: 'sug', 1093: 'na' };

function* rows(path) {
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    // i CSV USDA hanno ogni campo tra virgolette
    yield line.slice(1, -1).split('","');
  }
}

const dir = process.argv[2];
if (!dir) throw new Error('Indica la cartella del dataset USDA SR Legacy (CSV).');

const idByDesc = new Map();
for (const [id, , desc] of rows(join(dir, 'food.csv'))) idByDesc.set(desc.replace(/""/g, '"'), id);

const missing = FOODS.filter(([, , desc]) => !idByDesc.has(desc));
if (missing.length) {
  console.error('Descrizioni non trovate:\n' + missing.map((f) => `  ${f[0]}: ${f[2]}`).join('\n'));
  process.exit(1);
}

const wanted = new Map(FOODS.map((f) => [idByDesc.get(f[2]), {}]));
for (const [, fdcId, nutrientId, amount] of rows(join(dir, 'food_nutrient.csv'))) {
  const key = NUTRIENTS[nutrientId];
  if (key && wanted.has(fdcId)) wanted.get(fdcId)[key] = Number(amount);
}

const r1 = (n) => (n === undefined ? undefined : Math.round(n * 10) / 10);
const out = FOODS.map(([name, cat, desc, unitG]) => {
  const id = idByDesc.get(desc);
  const n = wanted.get(id);
  if (n.kcal === undefined) throw new Error(`${name}: mancano le calorie`);
  return {
    id: `fdc-${id}`, name, cat, kcal: Math.round(n.kcal), p: r1(n.p), c: r1(n.c), f: r1(n.f),
    fib: r1(n.fib), sug: r1(n.sug), salt: n.na === undefined ? undefined : r1((n.na * 2.5) / 1000), unitG
  };
});

writeFileSync('src/data/foods.json', JSON.stringify(out) + '\n');
console.log(`Scritti ${out.length} alimenti in src/data/foods.json`);
