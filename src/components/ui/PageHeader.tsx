'use client';

import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  gradient?: 'purple' | 'green' | 'blue' | 'orange';
  actions?: React.ReactNode;
}

const gradients = {
  purple: 'from-gym-purple to-gym-accent',
  green: 'from-gym-green to-teal-500',
  blue: 'from-blue-500 to-cyan-500',
  orange: 'from-orange-500 to-yellow-500',
};

export default function PageHeader({ 
  title, 
  subtitle, 
  icon: Icon,
  gradient = 'purple',
  actions 
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className={`p-3 rounded-xl bg-gradient-to-br ${gradients[gradient]} shadow-lg`}>
              <Icon className="w-8 h-8 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            {subtitle && (
              <p className="text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
