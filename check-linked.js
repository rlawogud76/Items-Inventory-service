import { loadInventory } from './src/database-old.js';

const inventory = await loadInventory();

console.log('=== Checking 수호의 정수 category ===\n');

const category = '수호의 정수';
const craftingItems = inventory.crafting?.categories?.[category];

if (!craftingItems) {
  console.log('❌ Category not found in crafting');
  process.exit(0);
}

for (const [name, data] of Object.entries(craftingItems)) {
  console.log(`\n📦 Item: ${name}`);
  console.log(`   Quantity: ${data.quantity}`);
  console.log(`   Required: ${data.required}`);
  console.log(`   ItemType: ${data.itemType || 'undefined'}`);
  console.log(`   LinkedItem: ${data.linkedItem || 'none'}`);
  
  if (data.linkedItem) {
    const [type, cat, itemName] = data.linkedItem.split('/');
    console.log(`   → Linked to: ${type}/${cat}/${itemName}`);
    
    const linked = type === 'inventory' 
      ? inventory.categories?.[cat]?.[itemName]
      : inventory.crafting?.categories?.[cat]?.[itemName];
    
    if (linked) {
      console.log(`   ✅ Linked item exists (qty: ${linked.quantity})`);
    } else {
      console.log(`   ❌ Linked item NOT FOUND`);
    }
  }
}
