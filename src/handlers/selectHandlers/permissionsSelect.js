// 권한 설정 셀렉트 핸들러

import { updateSettings } from '../../database.js';
import { isAdmin, isServerOwner, replyNoPermission } from '../../utils.js';

export async function handlePermissionMemberSelect(interaction) {
  if (!(await isAdmin(interaction))) {
    return await replyNoPermission(interaction, '서버장 또는 관리자만 멤버 권한을 설정할 수 있습니다');
  }

  const selected = interaction.values || [];
  const finalKeys = selected.includes('*') ? ['*'] : selected;

  await updateSettings({ memberAllowedFeatureKeys: finalKeys });
  await interaction.update({
    content: `✅ 멤버 권한이 업데이트되었습니다.\n_선택된 권한: ${finalKeys.join(', ') || '없음'}_`,
    components: []
  });
}

export async function handlePermissionAdminSelect(interaction) {
  if (!(await isServerOwner(interaction))) {
    return await replyNoPermission(interaction, '서버장만 관리자 권한을 설정할 수 있습니다');
  }

  const selected = interaction.values || [];
  const finalKeys = selected.includes('*') ? ['*'] : selected;

  await updateSettings({ adminAllowedFeatureKeys: finalKeys });
  await interaction.update({
    content: `✅ 관리자 권한이 업데이트되었습니다.\n_선택된 권한: ${finalKeys.join(', ') || '없음'}_`,
    components: []
  });
}
