'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function LoadingBar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // When the pathname or searchParams change, navigation has completed
        setLoading(false);
    }, [pathname, searchParams]);

    // We expose a way to trigger the loading state manually from the Link clicks
    // This is a bit of a hack since Next.js doesn't provide a direct way to listen to navigation START in Client Components easily without wrapping the Router
    useEffect(() => {
        const handleStart = () => setLoading(true);

        // Custom event to trigger the loading bar from anywhere
        window.addEventListener('navigation-start', handleStart);
        return () => window.removeEventListener('navigation-start', handleStart);
    }, []);

    if (!loading) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1">
            <div className="h-full bg-primary animate-progress-buffer shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            <style jsx>{`
        .animate-progress-buffer {
          width: 0%;
          animation: progress 2s ease-in-out infinite;
        }
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
        </div>
    );
}
