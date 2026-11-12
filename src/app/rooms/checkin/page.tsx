import { redirect } from 'next/navigation';

// O check-in é um pop-up na página de quartos (também no telemóvel). Esta rota fica só para links antigos.
export default function CheckInPage() {
  redirect('/rooms?checkin=1');
}
