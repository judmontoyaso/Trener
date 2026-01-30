'use client';

import { Dumbbell, Target, Flame, Calendar } from 'lucide-react';

interface StatsCardsProps {
  totalEntrenamientos: number;
  totalEjercicios: number;
  ejerciciosUnicos: number;
  diasEntrenados: number;
}

export default function StatsCards({
  totalEntrenamientos,
  totalEjercicios,
  ejerciciosUnicos,
  diasEntrenados,
}: StatsCardsProps) {
  const stats = [
    {
      label: 'Entrenamientos',
      value: totalEntrenamientos,
      icon: Dumbbell,
      color: 'from-gym-purple to-purple-600',
    },
    {
      label: 'Total Ejercicios',
      value: totalEjercicios,
      icon: Target,
      color: 'from-gym-accent to-cyan-600',
    },
    {
      label: 'Ejercicios Únicos',
      value: ejerciciosUnicos,
      icon: Flame,
      color: 'from-gym-orange to-red-500',
    },
    {
      label: 'Días Entrenados',
      value: diasEntrenados,
      icon: Calendar,
      color: 'from-gym-green to-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="bg-gym-dark/50 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-gray-400">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}
