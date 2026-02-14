'use client';

import { Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface LoadingScreenProps {
  message?: string;
  withNavbar?: boolean;
}

export default function LoadingScreen({
  message = 'Cargando...',
  withNavbar = true,
}: LoadingScreenProps) {
  const content = (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gym-purple" />
        <span className="ml-3 text-gray-400">{message}</span>
      </div>
    </main>
  );

  if (!withNavbar) return content;

  return (
    <>
      <Navbar />
      {content}
    </>
  );
}
