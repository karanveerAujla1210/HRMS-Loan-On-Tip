import Link from 'next/link';
import React from 'react';

export interface StatCardProps {
  href: string;
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  progress?: number;
  progressColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  href,
  label,
  value,
  sub,
  icon,
  iconColor,
  iconBg,
  progress,
  progressColor,
}) => {
  return (
    <Link href={href} className="group">
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-transform transform hover:scale-105 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</div>
          <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: iconBg, color: iconColor }} aria-hidden="true">
            {icon}
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value.toLocaleString('en-IN')}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">{sub}</div>
        </div>
        {progress !== undefined && (
          <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: progressColor }} />
          </div>
        )}
      </div>
    </Link>
  );
};
