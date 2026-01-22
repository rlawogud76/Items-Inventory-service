// 작업(수집/제작) select 핸들러
import { loadInventory, saveInventory } from '../../database.js';
import { getItemIcon, getItemsByTag } from '../../utils.js';

/**
 * 작업 항목 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleWorkItemSelect(interaction) {
  try {
    const parts = interaction.customId.replace('select_item_', '').split('_');
    const isCrafting = parts[0] === 'crafting';
    const category = parts.slice(1).join('_');
    const selectedValue = interaction.values[0];
    const userId = interaction.user.id;
    const userName = interaction.user.displayName || interaction.user.username;
    
    const inventory = await loadInventory();
    
    // 태그인지 아이템인지 확인
    const isTag = selectedValue.startsWith('tag_');
    let itemsToProcess = [];
    
    if (isTag) {
      // 태그 선택
      const tagName = selectedValue.replace('tag_', '');
      itemsToProcess = getItemsByTag(tagName, category, isCrafting ? 'crafting' : 'inventory', inventory);
      
      if (itemsToProcess.length === 0) {
        return await interaction.update({
          content: `❌ "${tagName}" 태그에 속한 항목이 없습니다.`,
          components: []
        });
      }
    } else {
      // 개별 아이템 선택
      const selectedItem = selectedValue.replace('item_', '');
      itemsToProcess = [selectedItem];
    }
    
    const targetData = isCrafting ? inventory.crafting : inventory;
    const results = [];
    const alreadyComplete = [];
    const alreadyWorking = [];
    const success = [];
    
    // 각 아이템 처리
    for (const selectedItem of itemsToProcess) {
      const itemData = targetData.categories[category][selectedItem];
      if (!itemData) continue;
      
      const percentage = (itemData.quantity / itemData.required) * 100;
      
      // 목표 달성 확인
      if (percentage >= 100) {
        alreadyComplete.push(selectedItem);
        continue;
      }
      
      // 이미 작업 중인지 확인
      let existingWorker = null;
      if (isCrafting) {
        existingWorker = inventory.crafting?.crafting?.[category]?.[selectedItem];
      } else {
        existingWorker = inventory.collecting?.[category]?.[selectedItem];
      }
      
      if (existingWorker && existingWorker.userId !== userId) {
        alreadyWorking.push({ item: selectedItem, worker: existingWorker.userName });
        continue;
      }
      
      // 작업 등록
      if (isCrafting) {
        if (!inventory.crafting.crafting) inventory.crafting.crafting = {};
        if (!inventory.crafting.crafting[category]) inventory.crafting.crafting[category] = {};
        
        inventory.crafting.crafting[category][selectedItem] = {
          userId: userId,
          userName: userName,
          startTime: new Date().toISOString()
        };
      } else {
        if (!inventory.collecting) inventory.collecting = {};
        if (!inventory.collecting[category]) inventory.collecting[category] = {};
        
        inventory.collecting[category][selectedItem] = {
          userId: userId,
          userName: userName,
          startTime: new Date().toISOString()
        };
      }
      
      success.push(selectedItem);
    }
    
    await saveInventory(inventory);
    
    // 결과 메시지 생성
    let message = '';
    
    if (success.length > 0) {
      const successList = success.map(item => {
        const icon = getItemIcon(item, inventory);
        return `${icon} ${item}`;
      }).join(', ');
      message += `✅ **${isCrafting ? '제작' : '수집'} 시작:**\n${successList}\n\n`;
    }
    
    if (alreadyComplete.length > 0) {
      const completeList = alreadyComplete.map(item => {
        const icon = getItemIcon(item, inventory);
        return `${icon} ${item}`;
      }).join(', ');
      message += `⚠️ **이미 완료됨:**\n${completeList}\n\n`;
    }
    
    if (alreadyWorking.length > 0) {
      const workingList = alreadyWorking.map(({ item, worker }) => {
        const icon = getItemIcon(item, inventory);
        return `${icon} ${item} (${worker}님 작업중)`;
      }).join('\n');
      message += `❌ **다른 사람이 작업중:**\n${workingList}\n\n`;
    }
    
    if (success.length === 0) {
      message += `모든 항목이 이미 완료되었거나 다른 사람이 작업 중입니다.`;
    } else {
      message += `다른 사람들이 ${isCrafting ? '제작' : '재고'}을 확인할 때 당신이 ${isCrafting ? '제작' : '수집'} 중임을 볼 수 있습니다.`;
    }
    
    await interaction.update({
      content: message,
      components: []
    });
    
    console.log(`${isCrafting ? '🔨' : '📦'} ${userName}님이 ${category}에서 ${success.length}개 항목 ${isCrafting ? '제작' : '수집'} 시작`);
    
  } catch (error) {
    console.error('❌ 아이템 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}
