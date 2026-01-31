'use client';

import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: number; // porcentaje de cambio
  color?: 'purple' | 'green' | 'blue' | 'orange' | 'red';
}

const colors = {
  purple: {
    bg: 'from-gym-purple/20 to-gym-accent/20',
    border: 'border-gym-purple/30',
    icon: 'bg-gym-purple',
    text: 'text-gym-purple',
  },
  green: {
    bg: 'from-gym-green/20 to-teal-500/20',
    border: 'border-gym-green/30',
    icon: 'bg-gym-green',
    text: 'text-gym-green',
  },
  blue: {
    bg: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-500/30',
    icon: 'bg-blue-500',
    text: 'text-blue-500',
  },
  orange: {
    bg: 'from-orange-500/20 to-yellow-500/20',
    border: 'border-orange-500/30',
    icon: 'bg-orange-500',
    text: 'text-orange-500',
  },
  red: {
    bg: 'from-red-500/20 to-pink-500/20',
    border: 'border-red-500/30',
    icon: 'bg-red-500',
    text: 'text-red-500',
  },
};

export default function MetricCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon,
  trend,
  color = 'purple'
}: MetricCardProps) {
  const colorScheme = colors[color];
  
  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor = trend && trend > 0 ? 'text-green-400' : trend && trend < 0 ? 'text-red-400' : 'text-gray-400';
  
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${colorScheme.bg} border ${colorScheme.border} p-5 transition-all hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
              <TrendIcon className="w-4 h-4" />
              <span className="text-sm font-medium">
                {trend > 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-xs text-gray-500">vs semana pasada</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg ${colorScheme.icon} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
