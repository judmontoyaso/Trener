import { getEntrenamientos } from '@/lib/entrenamientos';
import GenerarClient from './GenerarClient';

export default function GenerarPage() {
  const entrenamientos = getEntrenamientos();
  
  // Ordenar por fecha y obtener los más recientes
  const entrenamientosRecientes = entrenamientos
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 10);
  
  return <GenerarClient entrenamientosRecientes={entrenamientosRecientes} />;
}
