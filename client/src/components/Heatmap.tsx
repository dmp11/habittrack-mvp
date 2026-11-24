import type { HeatmapDay, HeatState } from '../types';
import { formatDate } from '../utils/date';

const STATE_CLASS: Record<HeatState, string> = {
  done: 'bg-brand-green ring-1 ring-inset ring-brand-green-strong',
  skipped: 'bg-[#e74c3c] ring-1 ring-inset ring-brand-danger',
  partial: 'bg-brand-accent ring-1 ring-inset ring-brand-blue-strong',
  unmarked: 'bg-brand-line',
  unscheduled: 'bg-white ring-1 ring-inset ring-brand-line',
};

const STATE_LABEL: Record<HeatState, string> = {
  done: 'Выполнено',
  skipped: 'Пропущено',
  partial: 'Частично',
  unmarked: 'Не отмечено',
  unscheduled: 'Не запланировано',
};

interface Props {
  days: HeatmapDay[];
  showLegend?: boolean;
  onSelect?: (date: string) => void;
}

export function Heatmap({ days, showLegend = true, onSelect }: Props) {
  return (
    <div>
      <div className="grid grid-cols-10 gap-1" role={onSelect ? 'group' : 'img'} aria-label="Календарь активности за 30 дней">
        {days.map((day) => {
          const title = `${formatDate(day.date, { day: 'numeric', month: 'short' })} — ${STATE_LABEL[day.state]}${day.value != null ? `: ${day.value}` : ''}`;
          return onSelect ? (
            <button
              key={day.date}
              type="button"
              title={title}
              aria-label={`${title}. Изменить отметку`}
              onClick={() => onSelect(day.date)}
              className={`aspect-square rounded-[4px] transition-transform hover:scale-110 ${STATE_CLASS[day.state]}`}
            />
          ) : (
            <div key={day.date} title={title} className={`aspect-square rounded-[4px] ${STATE_CLASS[day.state]}`} />
          );
        })}
      </div>
      {showLegend && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-brand-muted">
          {(['done', 'skipped', 'partial', 'unmarked'] as HeatState[]).map((state) => (
            <span key={state} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${STATE_CLASS[state]}`} />
              {STATE_LABEL[state]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
