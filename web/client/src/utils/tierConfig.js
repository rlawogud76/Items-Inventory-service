import { Package, Layers, Star } from 'lucide-react'

// 공유 티어 설정
export const TIER_CONFIG = {
  1: { 
    name: '1차 재료', 
    icon: Package, 
    color: 'bg-blue-500', 
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400'
  },
  2: { 
    name: '2차 중간재', 
    icon: Layers, 
    color: 'bg-purple-500', 
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400'
  },
  3: { 
    name: '3차 완성품', 
    icon: Star, 
    color: 'bg-yellow-500', 
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400'
  }
}
