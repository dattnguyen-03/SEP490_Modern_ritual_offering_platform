import React from 'react';

interface StaffShellProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const StaffShell: React.FC<StaffShellProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = 'Quay lai',
  actions,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f6f3ee,_#f4f2ec_45%,_#efede6_100%)] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-full items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <span className="text-lg font-bold font-display">M</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Staff Console</p>
                <h1 className="text-lg font-bold text-slate-900 md:text-xl">{title}</h1>
                {subtitle && <p className="text-xs text-black md:text-sm">{subtitle}</p>}
              </div>
            </div>
          </div>
          {(onBack || actions) && (
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-4 py-2 rounded-full border border-slate-200 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  {backLabel}
                </button>
              )}
              {actions}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-full px-5 py-8 md:px-8 lg:px-12 xl:px-16">
        {children}
      </main>
    </div>
  );
};

export default StaffShell;
