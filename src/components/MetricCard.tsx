type Props = {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  icon?: React.ReactNode;
  sub?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal';
};

const colorMap = {
  blue:   'bg-brand-50 text-brand-600',
  green:  'bg-green-50 text-green-600',
  amber:  'bg-amber-50 text-amber-600',
  red:    'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
  teal:   'bg-teal-50 text-teal-600',
};

export default function MetricCard({ label, value, unit, icon, sub, color = 'blue' }: Props) {
  const isEmpty = value == null || value === '' || value === 0;

  return (
    <div className="card card-hover flex flex-col gap-3">
      {icon && (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
      )}
      <div>
        <p className="stat-label">{label}</p>
        <p className="mt-1 text-2xl font-bold text-brand-800">
          {isEmpty ? (
            <span className="text-brand-200">—</span>
          ) : (
            <>
              {typeof value === 'number' ? value.toLocaleString('ro-RO') : value}
              {unit && <span className="text-sm font-normal text-brand-400 ml-1">{unit}</span>}
            </>
          )}
        </p>
        {sub && <p className="mt-0.5 text-xs text-brand-400">{sub}</p>}
      </div>
    </div>
  );
}
