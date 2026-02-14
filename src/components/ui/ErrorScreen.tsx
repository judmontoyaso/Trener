'use client';

import Navbar from '@/components/Navbar';

interface ErrorScreenProps {
  message: string;
  subtitle?: string;
  withNavbar?: boolean;
  onRetry?: () => void;
}

export default function ErrorScreen({
  message,
  subtitle = 'Verifica la conexión con el backend',
  withNavbar = true,
  onRetry,
}: ErrorScreenProps) {
  const content = (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
        <p className="text-red-300 text-lg">{message}</p>
        <p className="text-gray-400 mt-2">{subtitle}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-6 py-2 bg-gym-purple hover:bg-gym-purple/80 rounded-lg text-white text-sm transition-colors"
          >
            Reintentar
          </button>
        )}
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
