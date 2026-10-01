import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';

export default function Guest({ children }) {
    return (
        <div className="min-h-screen flex flex-col sm:justify-center items-center pt-8 sm:pt-0 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950 via-slate-900 to-slate-950 px-4">
            <div className="flex flex-col items-center gap-2 mb-4">
                <Link href="/" className="transition-transform hover:scale-105">
                    <ApplicationLogo className="h-16 sm:h-20 w-auto max-h-20 object-contain" containerClassName="p-3 bg-white rounded-2xl shadow-2xl ring-1 ring-white/20" />
                </Link>
            </div>

            <div className="w-full sm:max-w-md px-6 py-6 bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden rounded-2xl border border-emerald-900/20">
                {children}
            </div>
        </div>
    );
}
