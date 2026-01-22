// 버튼 인터랙션 핸들러 - 메인 라우터
import { handlePageNavigation } from './buttonHandlers/pagination.js';
import { handleRefresh } from './buttonHandlers/refresh.js';

// 버튼 인터랙션 처리 함수
export async function handleButtonInteraction(interaction) {
  console.log('버튼 클릭 감지! customId:', interaction.customId);
  
  // 페이지네이션 버튼 (임베드)
  if (interaction.customId.startsWith('page_prev_embed_') || interaction.customId.startsWith('page_next_embed_')) {
    return await handlePageNavigation(interaction);
  }
  
  // 새로고침 버튼
  else if (interaction.customId.startsWith('refresh')) {
    return await handleRefresh(interaction);
  }
  
  // TODO: 나머지 핸들러들 추가 예정
  else {
    console.log('⚠️ 처리되지 않은 버튼:', interaction.customId);
  }
}
