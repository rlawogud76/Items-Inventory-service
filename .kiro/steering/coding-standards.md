# 코딩 표준

## 작업 이력

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
