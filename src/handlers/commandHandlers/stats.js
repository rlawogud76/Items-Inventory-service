// 통계 커맨드 핸들러

import { EmbedBuilder } from 'discord.js';
import { loadInventory, getHistory } from '../../database.js';
import { getItemIcon, sendTemporaryReply } from '../../utils.js';

/**
 * /통계 커맨드 처리
 */
export async function handleStatsCommand(interaction) {
  const inventory = await loadInventory();
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  
  // 전체 진행률 계산
  let totalQuantity = 0, totalRequired = 0;
  let inventoryQuantity = 0, inventoryRequired = 0;
  let craftingQuantity = 0, craftingRequired = 0;
  
  // 카테고리별 통계
  const categoryStats = {
    inventory: {},
    crafting: {}
  };
  
  // 재고 통계
  for (const [category, items] of Object.entries(inventory.categories || {})) {
    let catQty = 0, catReq = 0, completed = 0, total = 0;
    
    for (const [itemName, itemData] of Object.entries(items)) {
      catQty += itemData.quantity;
      catReq += itemData.required;
      total++;
      if (itemData.quantity >= itemData.required) completed++;
    }
    
    inventoryQuantity += catQty;
    inventoryRequired += catReq;
    
    const percentage = catReq > 0 ? Math.round((catQty / catReq) * 100) : 0;
    const emoji = percentage >= 90 ? '🟢' : percentage >= 25 ? '🟡' : '🔴';
    
    categoryStats.inventory[category] = {
      percentage,
      emoji,
      completed,
      total
    };
  }
  
  // 제작 통계
  for (const [category, items] of Object.entries(inventory.crafting?.categories || {})) {
    let catQty = 0, catReq = 0, completed = 0, total = 0;
    
    for (const [itemName, itemData] of Object.entries(items)) {
      catQty += itemData.quantity;
      catReq += itemData.required;
      total++;
      if (itemData.quantity >= itemData.required) completed++;
    }
    
    craftingQuantity += catQty;
    craftingRequired += catReq;
    
    const percentage = catReq > 0 ? Math.round((catQty / catReq) * 100) : 0;
    const emoji = percentage >= 90 ? '🟢' : percentage >= 25 ? '🟡' : '🔴';
    
    categoryStats.crafting[category] = {
      percentage,
      emoji,
      completed,
      total
    };
  }
  
  totalQuantity = inventoryQuantity + craftingQuantity;
  totalRequired = inventoryRequired + craftingRequired;
  
  const totalPercentage = totalRequired > 0 ? Math.round((totalQuantity / totalRequired) * 100) : 0;
  const inventoryPercentage = inventoryRequired > 0 ? Math.round((inventoryQuantity / inventoryRequired) * 100) : 0;
  const craftingPercentage = craftingRequired > 0 ? Math.round((craftingQuantity / craftingRequired) * 100) : 0;
  
  // 최근 7일 활동 통계 (History 컬렉션에서 조회)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const histories = await getHistory(1000);
  const recentHistory = histories.filter(h => new Date(h.timestamp) >= sevenDaysAgo);
  
  // 사용자별 활동
  const userActivity = {};
  recentHistory.forEach(h => {
    userActivity[h.userName] = (userActivity[h.userName] || 0) + 1;
  });
  
  const topUsers = Object.entries(userActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  // 아이템별 변경 횟수
  const itemActivity = {};
  recentHistory.forEach(h => {
    itemActivity[h.itemName] = (itemActivity[h.itemName] || 0) + 1;
  });
  
  const topItems = Object.entries(itemActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  // 부족한 아이템 (30% 미만)
  const lackingItems = [];
  for (const [category, items] of Object.entries(inventory.categories || {})) {
    for (const [itemName, itemData] of Object.entries(items)) {
      const percentage = (itemData.quantity / itemData.required) * 100;
      if (percentage < 30) {
        lackingItems.push({
          category,
          name: itemName,
          quantity: itemData.quantity,
          required: itemData.required,
          icon: getItemIcon(itemName, inventory)
        });
      }
    }
  }
  lackingItems.sort((a, b) => (a.quantity / a.required) - (b.quantity / b.required));
  
  // 제작 불가 아이템 (재료 부족)
  const cannotCraft = [];
  for (const [category, items] of Object.entries(inventory.crafting?.categories || {})) {
    for (const [itemName, itemData] of Object.entries(items)) {
      const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
      if (recipe) {
        let canCraft = true;
        const missingMaterials = [];
        
        for (const material of recipe) {
          const matData = inventory.categories[material.category]?.[material.name];
          const currentQty = matData?.quantity || 0;
          if (currentQty < material.quantity) {
            canCraft = false;
            missingMaterials.push(material.name);
          }
        }
        
        if (!canCraft) {
          cannotCraft.push({
            name: itemName,
            missing: missingMaterials,
            icon: getItemIcon(itemName, inventory)
          });
        }
      }
    }
  }
  
  // Embed 생성
  const statsEmbed = new EmbedBuilder()
    .setTitle(`📊 마을 재고 통계 (${today})`)
    .setColor(0x5865F2)
    .setDescription([
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `📦 **전체 진행률: ${totalPercentage}%**`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '🏘️ **재고:** ' + inventoryPercentage + '%',
      ...Object.entries(categoryStats.inventory).map(([cat, stats]) => 
        `${cat}: ${stats.percentage}% ${stats.emoji} (${stats.completed}/${stats.total} 완료)`
      ),
      '',
      '🔨 **제작:** ' + craftingPercentage + '%',
      ...Object.entries(categoryStats.crafting).map(([cat, stats]) => 
        `${cat}: ${stats.percentage}% ${stats.emoji} (${stats.completed}/${stats.total} 완료)`
      ),
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n'))
    .setTimestamp();
  
  // 활동 현황 필드
  if (recentHistory.length > 0) {
    // 점수 계산 함수 (횟수 x 수량)
    const calculateScore = (historyList) => {
      const userScores = {};
      
      historyList.forEach(h => {
        if (!userScores[h.userName]) {
          userScores[h.userName] = {
            score: 0,
            count: 0,
            add: 0,
            update: 0,
            remove: 0,
            reset: 0
          };
        }
        
        // details에서 수량 추출 - 추가는 +점수, 차감은 -점수
        let quantity = 0; // 기본값 0
        
        if (h.action === 'add') {
          // 아이템 추가
          const match = h.details.match(/초기:\s*(\d+)개/);
          if (match) {
            const initialQty = parseInt(match[1]);
            quantity = initialQty > 0 ? initialQty : 10; // 초기 수량이 있으면 그만큼, 없으면 10점
          } else {
            quantity = 10; // 기본 10점
          }
        } else if (h.action === 'update_quantity') {
          // "0 -> 192" 형식 - 증가는 +점수, 감소는 0점
          const match1 = h.details.match(/(\d+)\s*->\s*(\d+)/);
          if (match1) {
            const oldQty = parseInt(match1[1]);
            const newQty = parseInt(match1[2]);
            const diff = newQty - oldQty;
            quantity = diff > 0 ? diff : 0; // 증가만 점수, 감소는 0점
          }
          
          // "192개 추가" 형식 - +점수
          const match2 = h.details.match(/(\d+)개\s*추가/);
          if (match2) {
            quantity = parseInt(match2[1]);
          }
          
          // "192개 차감" 형식 - 마이너스 점수
          const match3 = h.details.match(/(\d+)개\s*차감/);
          if (match3) {
            quantity = -parseInt(match3[1]); // 차감은 마이너스 점수
          }
        }
        // remove, reset, update_required는 모두 0점
        
        userScores[h.userName].score += quantity;
        userScores[h.userName].count += 1;
        
        // 활동 유형별 카운트
        if (h.action === 'add') userScores[h.userName].add += 1;
        else if (h.action === 'update_quantity' || h.action === 'update_required') userScores[h.userName].update += 1;
        else if (h.action === 'remove') userScores[h.userName].remove += 1;
        else if (h.action === 'reset') userScores[h.userName].reset += 1;
      });
      
      return Object.entries(userScores)
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 3);
    };
    
    // 재고 활동 분석
    const inventoryHistory = recentHistory.filter(h => h.type === 'inventory');
    const topInventoryUsers = calculateScore(inventoryHistory);
    
    // 제작 활동 분석
    const craftingHistory = recentHistory.filter(h => h.type === 'crafting');
    const topCraftingUsers = calculateScore(craftingHistory);
    
    const activityText = [];
    
    // 재고 기여도
    if (topInventoryUsers.length > 0) {
      activityText.push('**📦 재고 관리 기여도 (TOP 3)**');
      activityText.push('');
      
      const medals = ['🥇', '🥈', '🥉'];
      
      topInventoryUsers.forEach(([user, data], idx) => {
        // 상세 정보
        const details = [];
        if (data.add > 0) details.push(`추가 ${data.add}`);
        if (data.update > 0) details.push(`수정 ${data.update}`);
        if (data.remove > 0) details.push(`삭제 ${data.remove}`);
        if (data.reset > 0) details.push(`초기화 ${data.reset}`);
        
        activityText.push(`${medals[idx]} **${user}** - ${Math.round(data.score)}점 (${data.count}회)`);
        activityText.push(`   └ ${details.join(', ')}`);
        activityText.push('');
      });
    }
    
    // 제작 기여도
    if (topCraftingUsers.length > 0) {
      activityText.push('**🔨 제작 관리 기여도 (TOP 3)**');
      activityText.push('');
      
      const medals = ['🥇', '🥈', '🥉'];
      
      topCraftingUsers.forEach(([user, data], idx) => {
        // 상세 정보
        const details = [];
        if (data.add > 0) details.push(`추가 ${data.add}`);
        if (data.update > 0) details.push(`수정 ${data.update}`);
        if (data.remove > 0) details.push(`삭제 ${data.remove}`);
        if (data.reset > 0) details.push(`초기화 ${data.reset}`);
        
        activityText.push(`${medals[idx]} **${user}** - ${Math.round(data.score)}점 (${data.count}회)`);
        activityText.push(`   └ ${details.join(', ')}`);
        activityText.push('');
      });
    }
    
    // 가장 많이 변경된 아이템
    if (topItems.length > 0) {
      activityText.push('**📦 가장 많이 변경된 아이템 (TOP 5)**');
      topItems.slice(0, 5).forEach(([item, count], idx) => {
        activityText.push(`${idx + 1}. ${item} - ${count}회`);
      });
    }
    
    if (activityText.length > 0) {
      statsEmbed.addFields({
        name: '👥 활동 현황 (최근 7일)',
        value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + activityText.join('\n') + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        inline: false
      });
    }
  }
  
  // 주의 필요 필드
  const warningText = [];
  
  if (lackingItems.length > 0) {
    warningText.push(`🔴 **부족한 아이템 (${lackingItems.length}개):**`);
    lackingItems.slice(0, 5).forEach(item => {
      warningText.push(`- ${item.category} > ${item.icon} ${item.name} (${item.quantity}/${item.required})`);
    });
    if (lackingItems.length > 5) {
      warningText.push(`... 외 ${lackingItems.length - 5}개`);
    }
    warningText.push('');
  }
  
  if (cannotCraft.length > 0) {
    warningText.push(`❌ **제작 불가 (재료 부족):**`);
    cannotCraft.slice(0, 5).forEach(item => {
      warningText.push(`- ${item.icon} ${item.name} (${item.missing.join(', ')} 부족)`);
    });
    if (cannotCraft.length > 5) {
      warningText.push(`... 외 ${cannotCraft.length - 5}개`);
    }
  }
  
  if (warningText.length > 0) {
    statsEmbed.addFields({
      name: '⚠️ 주의 필요',
      value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + warningText.join('\n'),
      inline: false
    });
  }
  
  // 통계 메시지는 사용자가 직접 닫을 때까지 유지 (자동 삭제 안함)
  await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
}
