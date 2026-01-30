import { getEntrenamientos } from '@/lib/entrenamientos';
import EntrenamientosClient from './EntrenamientosClient';

export default function EntrenamientosPage() {
  const entrenamientos = getEntrenamientos();
  
  return <EntrenamientosClient entrenamientos={entrenamientos} />;
}
