import React from 'react';

interface AlertProps {
  variant: 'success' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ variant, children, className = '' }) => {
  const styles = {
    success: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300',
    error: 'bg-rose-950/40 border-rose-800/60 text-rose-300',
    info: 'bg-sky-950/40 border-sky-800/60 text-sky-300',
  };

  const roles = {
    success: 'status',
    error: 'alert',
    info: 'status',
  };

  return (
    <div
      role={roles[variant]}
      className={`p-4 rounded-xl border text-sm flex items-start gap-3 backdrop-blur-md shadow-lg ${styles[variant]} ${className}`}
    >
      <div className="shrink-0 mt-0.5">
        {variant === 'success' && (
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        )}
        {variant === 'error' && (
          <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {variant === 'info' && (
          <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
};
