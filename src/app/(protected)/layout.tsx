import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isValidDeviceToken } from '@/utils/devices';

// Server-side auth check for all protected pages.
// Runs on every page navigation so device deletion takes effect immediately.
// Localhost requests are already passed by middleware — this only affects remote devices.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('pc-control-auth')?.value;

  if (token && !isValidDeviceToken(token)) {
    // Token is HMAC-valid (middleware let it through) but device has been removed
    redirect('/login');
  }

  return <>{children}</>;
}
