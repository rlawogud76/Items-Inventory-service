// 레시피 관련 커맨드 핸들러

import { EmbedBuilder } from 'discord.js';
import { loadInventory, saveRecipe, removeRecipe } from '../../database.js';
import { getItemIcon, sendTemporaryReply } from '../../utils.js';

/**
 * /레시피조회 커맨드 처리
 */
export async function handleRecipeViewCommand(interaction) {
  const category = interaction.options.getString('카테고리');

  const inventory = await loadInventory();
  
  const recipes = inventory.crafting?.recipes?.[category];
  
  if (!recipes || Object.keys(recipes).length === 0) {
    return sendTemporaryReply(interaction, `❌ "${category}" 카테고리에 등록된 레시피가 없습니다.`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📋 ${category} 카테고리 레시피 목록`)
    .setDescription(`**총 ${Object.keys(recipes).length}개의 레시피**\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    .setFooter({ text: '✅ = 재료 충분 | ❌ = 재료 부족' });

  for (const [craftItem, recipe] of Object.entries(recipes)) {
    const icon = getItemIcon(craftItem, inventory);
    
    const recipeText = recipe.map(m => {
      const matIcon = getItemIcon(m.name, inventory);
      const materialData = inventory.categories[m.category]?.[m.name];
      const currentQty = materialData?.quantity || 0;
      const canCraft = currentQty >= m.quantity ? '✅' : '❌';
      return `${matIcon} ${m.name} x${m.quantity}개 (보유: ${currentQty}개) ${canCraft}`;
    }).join('\n');

    embed.addFields({
      name: `${icon} ${craftItem}`,
      value: recipeText || '재료 없음',
      inline: false
    });
  }
  
  const reply = await interaction.reply({ embeds: [embed], ephemeral: true, fetchReply: true });
  
  // 30초 후 자동 삭제
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {
      // 이미 삭제되었거나 삭제할 수 없는 경우 무시
    }
  }, 30000);
}

/**
 * /레시피수정 커맨드 처리
 */
export async function handleRecipeEditCommand(interaction) {
  const category = interaction.options.getString('카테고리');
  const craftItem = interaction.options.getString('제작품');
  const material1 = interaction.options.getString('재료1');
  const material1Qty = interaction.options.getInteger('재료1수량');
  const material2 = interaction.options.getString('재료2');
  const material2Qty = interaction.options.getInteger('재료2수량');
  const material3 = interaction.options.getString('재료3');
  const material3Qty = interaction.options.getInteger('재료3수량');

  const inventory = await loadInventory();
  
  // 제작품 존재 확인
  if (!inventory.crafting?.categories[category]?.[craftItem]) {
    return sendTemporaryReply(interaction, `❌ "${craftItem}" 제작품을 찾을 수 없습니다.`);
  }

  // 같은 카테고리의 재료만 사용 가능
  if (!inventory.categories[category]) {
    return sendTemporaryReply(interaction, `❌ "${category}" 카테고리에 재료가 없습니다.`);
  }

  // 재료가 같은 카테고리에 존재하는지 확인
  const materials = [];
  
  // 재료1 확인
  if (!inventory.categories[category][material1]) {
    return sendTemporaryReply(interaction, `❌ "${material1}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다.`);
  }
  materials.push({ name: material1, quantity: material1Qty, category: category });

  // 재료2 확인 (선택사항)
  if (material2 && material2Qty) {
    if (!inventory.categories[category][material2]) {
      return sendTemporaryReply(interaction, `❌ "${material2}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다.`);
    }
    materials.push({ name: material2, quantity: material2Qty, category: category });
  }

  // 재료3 확인 (선택사항)
  if (material3 && material3Qty) {
    if (!inventory.categories[category][material3]) {
      return sendTemporaryReply(interaction, `❌ "${material3}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다.`);
    }
    materials.push({ name: material3, quantity: material3Qty, category: category });
  }

  // 레시피 저장 (DB 반영)
  await saveRecipe(craftItem, category, materials);

  // 레시피 표시
  const recipeText = materials.map(m => {
    const icon = getItemIcon(m.name, inventory);
    return `${icon} **${m.name}** x${m.quantity}개`;
  }).join('\n');

  const icon = getItemIcon(craftItem, inventory);
  const successEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ 레시피 수정 완료')
    .setDescription(`**카테고리:** ${category}\n${icon} **${craftItem}**\n\n**필요 재료:**\n${recipeText}`);
  
  await sendTemporaryReply(interaction, { embeds: [successEmbed] });
}

/**
 * /레시피삭제 커맨드 처리
 */
export async function handleRecipeDeleteCommand(interaction) {
  const category = interaction.options.getString('카테고리');
  const craftItem = interaction.options.getString('제작품');

  const inventory = await loadInventory();
  
  if (!inventory.crafting?.recipes?.[category]?.[craftItem]) {
    return sendTemporaryReply(interaction, `❌ "${craftItem}"의 레시피가 등록되지 않았습니다.`);
  }

  // 레시피 삭제 (DB 반영)
  await removeRecipe(craftItem, category);

  const icon = getItemIcon(craftItem, inventory);
  const successEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setDescription(`### ✅ 레시피 삭제 완료\n**카테고리:** ${category}\n${icon} **${craftItem}**의 레시피가 삭제되었습니다.`);
  
  await sendTemporaryReply(interaction, { embeds: [successEmbed] });
}
