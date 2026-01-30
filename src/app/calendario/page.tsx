import { getEntrenamientos } from '@/lib/entrenamientos';
import CalendarioClient from './CalendarioClient';

export default function CalendarioPage() {
  const entrenamientos = getEntrenamientos();
  
  return <CalendarioClient entrenamientos={entrenamientos} />;
}
