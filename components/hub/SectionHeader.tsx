import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
    title: string;
    icon: LucideIcon;
    iconColor: string;
    children?: React.ReactNode;
}

const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-100 text-indigo-700',
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
};

export default function SectionHeader({ title, icon: Icon, iconColor, children }: SectionHeaderProps) {
    const colorClass = colorMap[iconColor] || `bg-${iconColor}-100 text-${iconColor}-700`;

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            </div>
            {children && (
                <div className="flex items-center gap-2">
                    {children}
                </div>
            )}
        </div>
    );
}
