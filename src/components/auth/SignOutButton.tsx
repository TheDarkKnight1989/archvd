'use client';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.replace('/auth/sign-in');
        router.refresh();
      }}
      className="text-sm underline"
    >
      Sign out
    </button>
  );
}