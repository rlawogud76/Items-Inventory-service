// Discord 봇 상태 로깅 유틸리티
import fs from 'fs';
import path from 'path';

const STATUS_LOG_FILE = 'discord-status.json';
const MAX_EVENTS = 100;

let statusData = {
  botInfo: null,
  recentEvents: [],
  lastUpdate: null
};

// 파일에서 상태 로드
export function loadStatus() {
  try {
    if (fs.existsSync(STATUS_LOG_FILE)) {
      const data = fs.readFileSync(STATUS_LOG_FILE, 'utf8');
      statusData = JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ 상태 로드 실패:', error.message);
  }
  return statusData;
}

// 파일에 상태 저장
function saveStatus() {
  try {
    fs.writeFileSync(STATUS_LOG_FILE, JSON.stringify(statusData, null, 2));
  } catch (error) {
    console.error('❌ 상태 저장 실패:', error.message);
  }
}

// 봇 정보 업데이트
export function updateBotInfo(client) {
  statusData.botInfo = {
    username: client.user?.tag,
    id: client.user?.id,
    status: client.isReady() ? 'online' : 'offline',
    guilds: client.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount
    })),
    ping: client.ws.ping,
    uptime: process.uptime(),
    lastUpdate: new Date().toISOString()
  };
  statusData.lastUpdate = new Date().toISOString();
  saveStatus();
}

// 이벤트 추가
export function addEvent(type, data) {
  const event = {
    timestamp: new Date().toISOString(),
    type,
    data
  };
  
  statusData.recentEvents.unshift(event);
  
  // 최대 개수 제한
  if (statusData.recentEvents.length > MAX_EVENTS) {
    statusData.recentEvents = statusData.recentEvents.slice(0, MAX_EVENTS);
  }
  
  saveStatus();
}

// 상태 조회
export function getStatus(filter = {}) {
  const { type, limit = 10 } = filter;
  
  let events = statusData.recentEvents;
  if (type && type !== 'all') {
    events = events.filter(e => e.type === type);
  }
  
  return {
    botInfo: statusData.botInfo,
    events: events.slice(0, limit),
    totalEvents: events.length,
    lastUpdate: statusData.lastUpdate
  };
}

// 상태 초기화
export function clearStatus() {
  statusData = {
    botInfo: null,
    recentEvents: [],
    lastUpdate: null
  };
  saveStatus();
}
