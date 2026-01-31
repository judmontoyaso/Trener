'use client';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export default function Card({ 
  children, 
  className = '',
  hover = true,
  padding = 'md'
}: CardProps) {
  return (
    <div className={`
      bg-gym-dark/50 backdrop-blur-sm rounded-xl border border-white/10 
      ${paddings[padding]}
      ${hover ? 'transition-all hover:border-white/20 hover:shadow-lg hover:shadow-gym-purple/5' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}


interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
