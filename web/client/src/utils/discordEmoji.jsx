import React from 'react';

/**
 * Discord 커스텀 이모지 패턴
 * <:name:id> - 일반 이모지
 * <a:name:id> - 애니메이션 이모지
 * <:name:id:> - 끝에 콜론이 붙은 형식도 지원
 */
const EMOJI_PATTERN = /<(a)?:([^:]+):(\d+):?>/g;

/**
 * 순수 Discord 이모지 ID 패턴 (17-20자리 숫자만)
 */
const PURE_ID_PATTERN = /^(\d{17,20})$/;

/**
 * Discord 이모지 ID로 CDN URL 생성
 */
export function getEmojiUrl(id, animated = false) {
  const ext = animated ? 'gif' : 'png';
  return `https://cdn.discordapp.com/emojis/${id}.${ext}`;
}

/**
 * 순수 ID를 Discord 이모지 형식으로 변환
 * @param {string} text - 변환할 텍스트
 * @returns {string} - 변환된 텍스트
 */
export function normalizeEmojiFormat(text) {
  if (!text || typeof text !== 'string') return text;
  
  // 순수 ID만 있는 경우 (17-20자리 숫자만)
  if (PURE_ID_PATTERN.test(text.trim())) {
    return `<:emoji:${text.trim()}>`;
  }
  
  return text;
}

/**
 * 텍스트에서 Discord 이모지를 파싱하여 React 요소로 변환
 * @param {string} text - 파싱할 텍스트
 * @param {object} options - 옵션
 * @param {string} options.size - 이모지 크기 (기본: 1.2em)
 * @param {string} options.className - 추가 CSS 클래스
 * @returns {React.ReactNode[]} - React 요소 배열
 */
export function parseDiscordEmojis(text, options = {}) {
  if (!text || typeof text !== 'string') return text;
  
  // 순수 ID를 먼저 이모지 형식으로 변환
  const normalizedText = normalizeEmojiFormat(text);
  
  const { size = '1.2em', className = '' } = options;
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  
  // 매번 새 정규식 인스턴스 생성 (글로벌 플래그의 lastIndex 문제 방지)
  const regex = new RegExp(EMOJI_PATTERN.source, 'g');
  
  while ((match = regex.exec(normalizedText)) !== null) {
    // 이모지 앞의 텍스트 추가
    if (match.index > lastIndex) {
      parts.push(normalizedText.slice(lastIndex, match.index));
    }
    
    const [fullMatch, animated, name, id] = match;
    const url = getEmojiUrl(id, !!animated);
    
    // 이모지 이미지 추가
    parts.push(
      <img
        key={`emoji-${key++}`}
        src={url}
        alt={`:${name}:`}
        title={`:${name}:`}
        className={`inline-block align-middle ${className}`}
        style={{ 
          height: size, 
          width: 'auto',
          verticalAlign: 'middle',
          margin: '0 1px'
        }}
        loading="lazy"
        onError={(e) => {
          // 이모지 로드 실패 시 텍스트로 대체
          e.target.style.display = 'none';
          e.target.insertAdjacentText('afterend', fullMatch);
        }}
      />
    );
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // 남은 텍스트 추가
  if (lastIndex < normalizedText.length) {
    parts.push(normalizedText.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : normalizedText;
}

/**
 * Discord 이모지를 포함한 텍스트를 렌더링하는 컴포넌트
 */
export function DiscordText({ children, size = '1.2em', className = '', as: Component = 'span', ...props }) {
  if (!children || typeof children !== 'string') {
    return <Component className={className} {...props}>{children}</Component>;
  }
  
  const parsed = parseDiscordEmojis(children, { size, className: '' });
  
  return (
    <Component className={className} {...props}>
      {parsed}
    </Component>
  );
}

/**
 * 텍스트에 Discord 이모지가 포함되어 있는지 확인
 */
export function hasDiscordEmoji(text) {
  if (!text || typeof text !== 'string') return false;
  // 순수 ID도 이모지로 인식
  if (PURE_ID_PATTERN.test(text.trim())) return true;
  // 매번 새 정규식 인스턴스 생성 (글로벌 플래그의 lastIndex 문제 방지)
  const regex = new RegExp(EMOJI_PATTERN.source, 'g');
  return regex.test(text);
}

/**
 * Discord 이모지를 제거한 순수 텍스트 반환
 */
export function stripDiscordEmojis(text) {
  if (!text || typeof text !== 'string') return text;
  // 순수 ID만 있는 경우 빈 문자열 반환
  if (PURE_ID_PATTERN.test(text.trim())) return '';
  // 매번 새 정규식 인스턴스 생성 (글로벌 플래그의 lastIndex 문제 방지)
  const regex = new RegExp(EMOJI_PATTERN.source, 'g');
  return text.replace(regex, '').trim();
}
