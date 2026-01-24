# 코딩 표준

## 작업 이력

### 2025-01-25: 자동 정렬에 태그별 정렬 옵션 추가 (완료)
- **새 기능**: 태그별로 묶어서 정렬하는 옵션 추가
- **정렬 방식**:
  - 🏷️ 태그별 (가나다): 태그명으로 먼저 정렬, 같은 태그 내에서는 이름순
  - 🏷️ 태그별 (역순): 태그명 역순으로 정렬, 같은 태그 내에서는 이름순
- **표시 방식**: 태그별로 그룹화하여 표시
  ```
  [광석]
  1. 금광석
  2. 다이아몬드
  3. 철광석
  
  [목재]
  4. 나무
  5. 판자
  ```
- **수정된 파일**: manage.js, manageSelect.js
- **커밋**: "Add: 자동 정렬에 태그별 정렬 옵션 추가 (같은 태그끼리 묶어서 정렬)"

### 2025-01-25: 순서 변경을 위/아래 이동 + 자동 정렬로 대체 (완료)
- **변경 사항**: 기존 복잡한 순서 변경 방식을 직관적인 방식으로 완전 교체
- **새로운 방식**:
  1. **↕️ 위/아래 이동**
     - 항목 선택 → 이동 방향 선택
     - 옵션: 맨 위로, 위로 5칸, 위로 1칸, 아래로 1칸, 아래로 5칸, 맨 아래로
     - 즉시 이동 및 결과 표시
  2. **🔤 자동 정렬**
     - 이름순 (가나다/역순)
     - 현재 수량순 (많은순/적은순)
     - 목표 수량순 (많은순/적은순)
     - 한 번 클릭으로 전체 정렬
- **수정된 파일**: manage.js, manageSelect.js, buttons.js, selects.js, buttonHandlers/index.js, selectHandlers/index.js, modals.js, modalHandlers/index.js
- **추가된 핸들러**:
  - `handleReorderMoveButton`: 위/아래 이동 방식 선택
  - `handleReorderSortButton`: 자동 정렬 방식 선택
  - `handleReorderMoveSelect`: 이동할 항목 선택
  - `handleSortOptionSelect`: 정렬 옵션 선택 및 실행
  - `handleMoveItemButton`: 항목 이동 실행 (top/up5/up1/down1/down5/bottom)
- **제거된 기능**: 빠른/수동 방식 (복잡하고 난해함)
- **장점**: 
  - 훨씬 직관적이고 이해하기 쉬움
  - 자동 정렬로 대량 정리 가능
  - 위/아래 이동으로 세밀한 조정 가능
- **커밋**: "Refactor: 순서 변경을 위/아래 이동 + 자동 정렬로 대체 (더 직관적이고 빠름)"

### 2025-01-25: 순서 변경 빠른/수동 방식 선택 기능 추가 (폐기)
- **새 기능**: 순서 변경 시 빠른 방식과 수동 방식 선택 가능
- **빠른 방식**: 기존 방식 (한 항목씩 선택해서 이동)
  - 1단계: 이동할 항목 선택
  - 2단계: 이동할 위치 선택
- **수동 방식**: 모달로 전체 순서를 한번에 입력 (빠름!)
  - 모달에서 쉼표로 구분된 번호 입력 (예: 3,1,2,4,5)
  - 한번에 전체 순서 변경 가능
  - 입력 검증: 번호 개수, 중복, 범위 체크
- **수정된 파일**: manage.js, manageModal.js, buttons.js, modals.js, buttonHandlers/index.js, modalHandlers/index.js
- **추가된 핸들러**:
  - `handleReorderQuickButton`: 빠른 방식 선택
  - `handleReorderManualButton`: 수동 방식 선택 (모달 표시)
  - `handleReorderModal`: 모달 제출 처리 및 순서 변경 실행
- **커밋**: "Add: 순서 변경 빠른/수동 방식 선택 기능 추가 (모달로 한번에 입력 가능)"

### 2025-01-25: 메시지 자동 삭제 시간 사용자 설정 기능 추가 (완료)
- **새 기능**: 사용자가 메시지 자동 삭제 시간을 직접 설정 가능
- **설정 항목**:
  - 셀렉트 메뉴 타이머: 10~300초 (기본 30초)
  - 안내 메시지 타이머: 5~300초 (기본 15초)
- **수정된 파일**: 총 19개 핸들러 파일
  - Setting 모델에 `selectMessageTimeout`, `infoMessageTimeout` 필드 추가
  - utils.js에 `getTimeoutSettings()`, `getTimeoutSettingsAsync()` 함수 추가
  - embeds.js에 "⏱️ 타이머" 설정 버튼 추가
  - settingsModal.js에 타이머 설정 모달 추가
  - 모든 핸들러 파일의 하드코딩된 타이머(15000, 30000)를 설정값으로 교체
- **적용된 핸들러**:
  - Button handlers: manage.js, tag.js, reset.js, quantity.js, pagination.js, contribution.js, recipe.js, work.js
  - Modal handlers: manageModal.js, recipeModal.js, tagModal.js, quantityModal.js
  - Select handlers: manageSelect.js, tagSelect.js, quantitySelect.js, resetSelect.js, workSelect.js, recipeSelect.js
- **커밋**:
  - "Add: 메시지 자동 삭제 시간 사용자 설정 기능 추가 (Setting 모델, utils, embeds, settingsModal)"
  - "Update: manage.js, tag.js, reset.js에 사용자 설정 타이머 적용"
  - "Update: 모달 핸들러들에 사용자 설정 타이머 적용 (manageModal, recipeModal, tagModal, quantityModal)"
  - "Update: 셀렉트 핸들러들에 사용자 설정 타이머 적용 (manageSelect, tagSelect, quantitySelect, resetSelect, workSelect, recipeSelect)"
  - "Update: work.js에 사용자 설정 타이머 적용 (4개 타이머)"
  - "Update: 나머지 핸들러 파일들에 사용자 설정 타이머 적용 (quantity, pagination, contribution, recipe)"

### 2025-01-25: 순서 변경 버튼 라우팅 충돌 해결 (완료)
- **문제**: 순서 변경 버튼 클릭 시 관리 메뉴가 다시 표시됨
- **원인**: buttons.js의 일반 `manage` 핸들러가 `manage_reorder`를 먼저 잡아챔
- **증상**: `manage_reorder_inventory_해양` 클릭 시 `handleManageButton`이 실행되어 관리 메뉴 재표시
- **해결**: 
  1. buttons.js 120번째 줄 제외 조건에 `!startsWith('manage_reorder')` 추가
  2. manage.js의 `handleManageReorderButton`에서 `interaction.update()` → `interaction.reply()` 변경
- **수정된 파일**: buttons.js, manage.js
- **핵심 교훈**: 
  - 라우팅 순서가 중요: 더 구체적인 패턴을 먼저 체크하거나 일반 패턴에서 제외해야 함
  - 새로운 `manage_*` 핸들러 추가 시 반드시 일반 `manage` 핸들러의 제외 조건에 추가 필요
  - `interaction.update()`는 기존 메시지 업데이트용, 새 메시지는 `interaction.reply()` 사용
- **커밋**: 
  - "Fix: 순서 변경 버튼 클릭 시 관리 메뉴 재표시 버그 수정 (update → reply)"
  - "Fix: buttons.js에서 manage_reorder 라우팅 제외 조건 추가"

### 2025-01-25: 중복 인터랙션 방지를 디바운스 방식으로 개선 (완료)
- **문제**: 같은 버튼 클릭이 여러 번 처리되어 "이미 응답한 인터랙션" 에러 발생
- **근본 원인**: Discord가 같은 버튼 클릭을 **다른 interaction.id**로 여러 번 전송
- **이전 해결책의 문제**: `interaction.id + customId` 조합으로 체크했지만, ID가 매번 달라서 작동 안함
- **새로운 해결책**: **customId만으로 디바운스** (1초 내 같은 customId 무시)
- **수정된 파일**: index.js
- **적용 내용**:
  - `lastProcessedTime` Map으로 customId별 마지막 처리 시간 추적
  - 1초 내 같은 customId 인터랙션 자동 무시 (디바운스)
  - 5초 후 Map에서 자동 제거 (메모리 관리)
  - 상세한 디버그 로그 추가 (처리 시작, 중복 감지 시간 표시)
- **커밋**: "Fix: 중복 인터랙션 방지를 디바운스 방식으로 변경 (customId 기반)"

### 2025-01-25: 중복 인터랙션 방지 메커니즘 추가 (실패 - 위 방식으로 대체됨)
- **문제**: 같은 버튼 클릭이 여러 번 처리되어 "이미 응답한 인터랙션" 에러 발생
- **원인**: Discord가 같은 인터랙션을 여러 번 전송하는 경우 발생
- **해결**: 전역 Set을 사용한 중복 인터랙션 필터링
- **수정된 파일**: index.js, manage.js
- **적용 내용**:
  - `processedInteractions` Set 추가 (interaction.id + customId 조합으로 추적)
  - 5초 윈도우 내 중복 인터랙션 자동 무시
  - 5초 후 자동 제거로 메모리 누수 방지
  - 순서 변경 핸들러에 디버그 로그 추가
- **커밋**: "Fix: 중복 인터랙션 방지 메커니즘 추가 (5초 윈도우)"

### 2025-01-24: 물품 순서 변경 기능 추가 (완료)
- **새 기능**: 관리 메뉴에서 물품/품목 순서를 변경할 수 있는 기능 추가
- **수정된 파일**: manage.js, manageSelect.js, buttons.js, selects.js, buttonHandlers/index.js, selectHandlers/index.js, Item.js, database.js
- **추가된 핸들러**:
  - `handleManageReorderButton`: 순서 변경 버튼 (🔀 순서 변경)
  - `handleManageReorderPageButton`: 순서 변경 페이지네이션
  - `handleReorderFirstSelect`: 이동할 항목 선택 (1단계)
  - `handleReorderSecondSelect`: 이동할 위치 선택 및 실행 (2단계)
- **적용 내용**:
  - 관리 메뉴에 "🔀 순서 변경" 버튼 추가
  - 2단계 선택 방식: 이동할 항목 선택 → 이동할 위치 선택
  - 현재 순서를 번호와 함께 표시
  - 선택한 항목을 원하는 위치로 이동
  - Item 모델에 `order` 필드 추가 (정렬용)
  - loadInventory에서 order 필드로 자동 정렬
  - 페이지네이션 지원 (25개 초과 시)
  - 히스토리 기록 (reorder 액션)
- **해결된 문제**: 물품이 뒤죽박죽 섞여있어 찾기 어려운 문제 해결
- **커밋**: "Add: 물품 순서 변경 기능 추가 (2단계 선택 방식)"

### 2025-01-24: 페이지 점프 기능 추가 (완료)
- **새 기능**: 페이지 번호 버튼 클릭 시 모달로 원하는 페이지로 직접 이동
- **수정된 파일**: embeds.js, pagination.js, buttons.js, modals.js
- **적용 내용**:
  - 페이지 정보 버튼을 클릭 가능하게 변경 (📄 아이콘 추가)
  - 클릭 시 페이지 번호 입력 모달 표시
  - 입력한 페이지로 즉시 이동
  - 페이지 번호 검증 (1~총페이지 범위)
  - activeMessages 페이지 상태도 자동 업데이트
- **해결된 문제**: 한 페이지씩 이동해야 하는 불편함 해소
- **커밋**: "Add: 페이지 점프 기능 추가 (페이지 번호 클릭 시 모달로 직접 이동)"

### 2025-01-24: 통계 및 수정내역 메시지 영구 지속 (완료)
- **변경 사항**: `/통계` 및 `/수정내역` 명령어 메시지가 사용자가 닫을 때까지 유지
- **수정된 파일**: stats.js, misc.js
- **적용 내용**:
  - 기존 30초 자동 삭제 타이머 제거
  - 사용자가 직접 메시지를 닫을 때까지 영구 지속
  - 통계 정보를 충분히 확인할 수 있도록 개선
- **커밋**: "Update: 통계 및 수정내역 메시지 영구 지속 (사용자가 닫을 때까지)"

### 2025-01-24: 임시 메시지 타이머 구분 적용 (완료)
- **변경 사항**: 셀렉트 메뉴는 30초, 단순 안내 메시지는 15초로 타이머 구분
- **수정된 파일**: quantity.js, quantitySelect.js, tag.js
- **적용 내용**:
  - **30초 타이머**: 사용자가 선택해야 하는 셀렉트 메뉴 (수량 관리, 태그 관리, 레시피 관리, 물품 관리 등)
  - **15초 타이머**: 단순 성공/완료 안내 메시지 (추가 완료, 삭제 완료, 수정 완료 등)
  - 사용자가 선택 작업을 완료할 충분한 시간 제공
- **커밋**: "Update: 셀렉트 메뉴 타이머 30초, 단순 안내 메시지 15초로 변경 (진행중)"

### 2025-01-24: 자동 새로고침 시 사용자별 페이지 상태 유지 (완료)
- **새 기능**: 다른 사용자가 수집하기/새로고침 버튼 클릭 시 각 사용자의 현재 페이지 유지
- **문제**: 자동 새로고침 시 모든 사용자의 메시지가 1페이지로 리셋됨
- **해결**: `activeMessages` Map에 페이지 번호 추가 및 페이지네이션 핸들러에서 업데이트
- **수정된 파일**: index.js, inventory.js, crafting.js, pagination.js
- **적용 내용**:
  - `activeMessages` 구조에 `page` 필드 추가 (messageId → { interaction, category, type, page, timestamp })
  - 커맨드 핸들러에서 초기 page: 0 설정
  - 페이지네이션 핸들러에서 페이지 이동 시 `activeMessages` 업데이트
  - 자동 새로고침 시 저장된 페이지 번호 사용 (기존 하드코딩된 0 대신)
  - `global.activeMessages` 전역 노출로 모듈 간 접근 가능
- **커밋**: "Fix: 자동 새로고침 시 사용자별 페이지 상태 유지"

### 2025-01-24: 임시 메시지 자동 삭제 타이머 표시 추가 (완료)
- **새 기능**: 모든 임시 ephemeral 메시지에 자동 삭제 타이머 표시
- **수정된 파일**: 14개 핸들러 파일
  - Button handlers: quantity.js, recipe.js, tag.js, work.js, manage.js
  - Modal handlers: quantityModal.js, recipeModal.js, tagModal.js, manageModal.js
  - Select handlers: quantitySelect.js, resetSelect.js, tagSelect.js, manageSelect.js
  - Utils: utils.js (sendTemporaryReply 함수)
- **적용 내용**:
  - 15초 자동 삭제 메시지: "_이 메시지는 15초 후 자동 삭제됩니다_" 추가
  - 30초 자동 삭제 메시지: "_이 메시지는 30초 후 자동 삭제됩니다_" 추가
  - 모든 `interaction.reply()` 및 `interaction.update()` 메시지에 타이머 표시
  - 사용자가 메시지가 언제 사라지는지 명확히 알 수 있도록 개선
- **커밋**: "Add: 모든 임시 메시지에 자동 삭제 타이머 표시 추가"

### 2025-01-24: 레시피 재료 페이지네이션 파싱 버그 수정 (완료)
- **문제**: `page_next_recipe_material_edit_해양_물결 수호의 핵_1_0` 파싱 시 category가 'material'로 잘못 파싱됨
- **원인**: pagination.js에서 `parts[3] === 'edit'` 체크가 잘못됨 (parts[3]은 'material', parts[4]가 'edit')
- **증상**: 레시피 수정 시 재료 페이지네이션 클릭하면 "material 카테고리를 찾을 수 없습니다" 에러
- **해결**: `parts[4] === 'edit'` 체크로 수정, 인덱스도 +1 조정 (category = parts[5], itemName = parts.slice(6, -2))
- **수정된 파일**: pagination.js
- **커밋**: "Fix: pagination.js recipe material edit parsing - check parts[4] instead of parts[3] for edit flag"

### 2025-01-24: 레시피 수정 라우팅 충돌 해결 (완료)
- **문제**: `select_recipe_edit_` 핸들러가 `select_recipe_material_edit_`도 매칭하여 잘못된 카테고리 파싱
- **원인**: `select_recipe_material_edit_해양_아이템_1`이 `select_recipe_edit_`로 시작하므로 index.js 핸들러가 먼저 매칭됨
- **증상**: 레시피 수정 시 "material 카테고리를 찾을 수 없습니다" 에러 발생
- **해결**: index.js 232번째 줄에 제외 조건 추가 (`!startsWith('select_recipe_material_edit_')`)
- **수정된 파일**: index.js
- **커밋**: "Fix: index.js select_recipe_edit_ handler routing conflict with select_recipe_material_edit_"

### 2025-01-24: 레시피 핸들러 전체 Optional Chaining 적용 (완료)
- **수정된 파일**: recipe.js, recipeSelect.js, recipeModal.js, pagination.js, index.js
- **적용 내용**:
  - 모든 `inventory.categories[category]` → `inventory.categories?.[category]` 검증 추가
  - 모든 `inventory.crafting.recipes[category][itemName]` → optional chaining 적용
  - 레시피 구조 초기화 시 `inventory.crafting` 존재 확인 추가
  - `currentRecipe` 접근 시 기본값 `[]` 설정
  - pagination.js 95번째 줄: `handleRecipeMaterialPageNavigation`에 카테고리 존재 확인 추가
  - index.js: `select_recipe_edit_` 핸들러에 emoji validation 적용
- **해결된 문제**: 레시피 관련 모든 기능에서 발생하던 undefined 에러 완전 제거
- **커밋**: "Fix: pagination.js handleRecipeMaterialPageNavigation category existence check"

### 2025-01-24: 레시피 독립 추가 기능 구현
- **새 기능**: 레시피 메뉴에서 직접 레시피 추가 가능 (품목 추가와 별도)
- **수정된 파일**: recipe.js, recipeSelect.js, recipeModal.js, pagination.js, buttons.js, selects.js, modals.js, index.js (3개)
- **추가된 핸들러**:
  - `handleRecipeAddButton`: 레시피 추가 버튼 (➕ 추가)
  - `handleRecipeAddSelect`: 제작품 선택
  - `handleRecipeMaterialStandaloneSelect`: 재료 선택
  - `handleRecipeStandaloneQuantityModal`: 수량 입력
  - `handleRecipeStandaloneMoreFinishButton`: 재료 추가/완료
  - `handleRecipeMaterialStandalonePageNavigation`: 재료 페이지네이션
  - `handleRecipeAddPageNavigation`: 제작품 페이지네이션
- **해결된 문제**: 품목 추가 중 중단 시 레시피 추가 불가 → 독립 실행으로 해결

### 2025-01-24: 레시피 핸들러 이모지 검증 및 페이지네이션 추가
- **수정된 파일**: recipe.js, pagination.js, buttons.js, index.js
- **이모지 검증**: `validateEmoji()` 함수 추가 및 모든 select menu options에 적용
- **페이지네이션 추가**: 25개 초과 재료 선택 시 페이지네이션 지원 (`handleRecipeMaterialPageNavigation`)
- **해결된 에러**: 
  - DiscordAPIError[50035] Invalid emoji in recipe add button
  - ExpectedConstraintError: Select menu options exceeds 25 limit

### 2025-01-23: 수량 관리 시스템 전면 검토 및 수정
- **Optional Chaining 일관성 적용**: 모든 핸들러에서 `targetData?.categories?.[category]` 패턴 적용
- **수정된 파일**: quantity.js, quantitySelect.js, quantityActions.js, quantityModal.js, resetSelect.js, work.js, reset.js
- **버튼 라우팅 수정**: `page_quantity_` 페이지네이션 버튼 라우팅 추가
- **이모지 검증**: `validateEmoji()` 함수로 커스텀 Discord 이모지 필터링
- **Description 길이 제한**: Select menu description 100자 제한 적용
- **Modal 입력 처리**: 빈 입력값 기본값 `'0'` 처리
- **자동 삭제 로직**: 성공 메시지 15초 자동 삭제 추가
- **Null 필터링**: 모든 `.map()` 함수에 `.filter(item => item !== null)` 추가

## 최근 발견된 이슈 및 해결 방법

### 중복 인터랙션 문제 (2025-01-25 해결)
**문제**: 같은 버튼을 한 번만 클릭해도 여러 번 처리되어 "이미 응답한 인터랙션" 에러 발생

**근본 원인**: 
- Discord가 같은 버튼 클릭을 **다른 interaction.id**로 여러 번 전송
- 네트워크 지연이나 Discord 서버 문제로 발생

**해결 방법**:
```javascript
// index.js에 디바운스 메커니즘 추가
const lastProcessedTime = new Map();
const DEBOUNCE_MS = 1000; // 1초

client.on('interactionCreate', async (interaction) => {
  const customId = interaction.customId || `command_${interaction.commandName}`;
  const now = Date.now();
  
  // 1초 내 같은 customId 무시
  const lastTime = lastProcessedTime.get(customId);
  if (lastTime && (now - lastTime) < DEBOUNCE_MS) {
    console.log('⚠️ 중복 인터랙션 감지 (디바운스), 무시');
    return;
  }
  
  lastProcessedTime.set(customId, now);
  // ... 나머지 처리
});
```

**핵심**: 
- `interaction.id`가 아닌 **`customId`만으로 체크**
- 1초 디바운스 윈도우 적용
- Map으로 마지막 처리 시간 추적

### Discord API 제한 사항
1. **Select Menu Options 제한**: 최대 25개
   - 해결: 25개 초과 시 페이지네이션 버튼 추가

2. **Select Menu Description 제한**: 최대 100자
   - 해결: 100자 초과 시 자동 truncate (`description.substring(0, 97) + '...'`)

3. **Select Menu Emoji 제한**: 유니코드 이모지만 허용
   - 커스텀 Discord 이모지(`<:name:id>`) 사용 불가
   - 해결: `validateEmoji()` 함수로 검증 후 기본 이모지로 대체

4. **Modal Input 기본값 처리**: 빈 입력값은 `''`가 아닌 `'0'`으로 처리
   - `sanitizeNumber('')`는 `null` 반환
   - 해결: `?.trim() || '0'`로 기본값 설정

### 버튼 라우팅 규칙
- **페이지네이션 버튼 형식**: `page_quantity_${type}_${category}_${direction}_${page}`
  - 예: `page_quantity_inventory_해양_next_0`
  - 라우팅: `startsWith('page_quantity_')` 조건 필요
  - `page_prev_` 또는 `page_next_`로 시작하지 않음!
- **라우팅 순서 중요**: 더 구체적인 조건을 먼저 체크
  - 예: `add_more_recipe_standalone_`는 `add_more_recipe_`보다 먼저 체크
  - `startsWith('add_more_recipe_')`가 `startsWith('add_more_recipe_standalone_')`를 포함하므로 순서 주의
- **중첩 패턴 충돌 주의**: 짧은 패턴이 긴 패턴을 포함하는 경우 제외 조건 필요
  - 예: `select_recipe_edit_`는 `select_recipe_material_edit_`도 매칭
  - 해결: `startsWith('select_recipe_edit_') && !startsWith('select_recipe_material_edit_')`

### CustomId 파싱 패턴
- 카테고리명에 `_`가 포함될 수 있음 (예: `해양_심해`)
- 마지막 요소부터 역순으로 파싱 권장
- 예: `parts.slice(3, -2).join('_')` (마지막 2개 제외)
- **주의**: `standalone`, `edit` 등 키워드가 중간에 있을 경우 인덱스 조정 필요
  - 예: `page_prev_recipe_material_standalone_해양_아이템_2_0`
  - parts[5]부터 카테고리 시작 (parts[4]는 'standalone')

## JavaScript 규칙

### 안전한 객체 접근
- **항상 optional chaining (`?.`)을 사용하여 중첩된 객체 속성에 안전하게 접근**
- 예: `inventory.categories?.[category]?.[itemName]`
- 데이터베이스에서 가져온 데이터는 항상 undefined일 수 있다고 가정

### 에러 처리
- 모든 async 함수는 try-catch로 감싸기
- 데이터베이스 접근, Discord API 호출 등은 필수
- 에러 발생 시 사용자에게 친절한 한국어 메시지 제공
- 콘솔 로그에 이모지 사용: ✅ (성공), ❌ (에러), 🔄 (진행중), ⚠️ (경고)

### 코드 스타일
- 한국어 주석과 로그 메시지 사용
- 변수명은 영어로, 설명은 한국어로
- async/await 선호 (Promise.then 대신)

## Discord Bot 규칙

### Interaction 처리
- 모든 interaction 응답은 에러 처리 포함
- `interaction.reply()`, `interaction.update()` 등은 `.catch()` 추가
- **ephemeral 메시지는 15초 후 자동 삭제 필수**
  - 성공 메시지: 15초 후 삭제
  - 에러 메시지: 에러 핸들러에서는 자동 삭제 불필요 (사용자가 읽어야 함)
  - 단, 일반 에러가 아닌 검증 실패 메시지는 15초 후 삭제
- 3초 이상 걸리는 작업은 `deferReply()` 먼저 호출

### 자동 삭제 패턴
```javascript
// 성공 메시지 (15초 후 삭제)
await interaction.reply({ content: '✅ 완료!', ephemeral: true });
setTimeout(async () => {
  try {
    await interaction.deleteReply();
  } catch (error) {}
}, 15000);

// 에러 메시지 (catch 블록 - 삭제 안함)
catch (error) {
  await interaction.reply({ content: '❌ 오류', ephemeral: true }).catch(() => {});
}
```

### 데이터 검증
- 사용자 입력은 항상 sanitize (utils.js의 sanitizeInput 사용)
- 숫자 입력은 sanitizeNumber로 검증
- 카테고리/아이템 이름은 isValidName으로 검증

## 데이터베이스 규칙

### MongoDB 접근
- `loadInventory()`로 데이터 로드
- 수정 후 반드시 `saveInventory()` 호출
- 중첩 객체 수정 시 `markModified()` 사용 (Mixed 타입)

### 데이터 구조 보장
- 객체 접근 전 존재 여부 확인
- 배열 접근 전 `Array.isArray()` 체크
- 기본값 설정: `inventory.categories = inventory.categories || {}`

## 작업 흐름

1. 데이터 로드 → 검증 → 처리 → 저장 → 응답
2. 에러 발생 시 롤백 불필요 (MongoDB가 처리)
3. 동시성 충돌은 optimistic locking으로 자동 재시도

## Git 작업 규칙

### 커밋 전략
- **모든 작업 중간중간에 의미있는 단위로 커밋**
- 파일 수정 완료 시마다 커밋 (예: 버그 수정, 기능 추가, 리팩토링)
- 커밋 메시지는 한국어로 명확하게 작성
- 예: "Fix: workSelect.js optional chaining 적용", "Add: 태그 색상 기능 추가"

### 최종 작업 완료
- **모든 작업이 완료되면 항상 git push 실행**
- push 전에 현재 브랜치 확인
- push 실패 시 pull 후 재시도

## 언어 사용 규칙

### 작업 과정
- **모든 작업 과정은 영어로 진행**
- 코드 작성, 파일 읽기, 분석 등 모든 중간 과정은 영어 사용
- 기술적 설명과 추론도 영어로

### 최종 정리
- **작업 완료 후 최종 정리만 한국어로 제공**
- 사용자에게 보여지는 최종 요약/결과만 한국어
- 무엇을 했는지, 어떤 변경사항이 있는지 간단명료하게
