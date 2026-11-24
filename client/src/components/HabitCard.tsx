import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import type { Habit, HabitStat, RecordItem } from '../types';
import { formatDate, isScheduled } from '../utils/date';
import { Heatmap } from './Heatmap';

interface Props {
  habit: Habit;
  stat?: HabitStat;
  record?: RecordItem;
  today: string;
  onSaveRecord: (habitId: string, date: string, value: number) => Promise<void>;
  onEdit: (habit: Habit) => void;
  onToggleStatus: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

export function HabitCard({ habit, stat, record, today, onSaveRecord, onEdit, onToggleStatus, onDelete }: Props) {
  const [inputValue, setInputValue] = useState(String(record?.value ?? 0));
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setInputValue(String(record?.value ?? 0));
  }, [record?.value]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(''), 1800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const scheduledToday = isScheduled(habit.frequency, today);
  const archived = habit.status === 'archive';

  const commit = async (date: string, rawValue: string) => {
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0 || value > 9999) {
      setError('Значение должно быть целым числом от 0 до 9999');
      return;
    }
    if (habit.type === 'binary' && value !== 0 && value !== 1) {
      setError('Для этой привычки допустимы только 0 или 1');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSaveRecord(habit.id, date, value);
      setFeedback('Отличная работа! Сохранено');
      setEditDate(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (date: string) => {
    const day = stat?.heatmap.find((item) => item.date === date);
    setEditDate(date);
    setEditValue(String(day?.value ?? 0));
    setError('');
  };

  return (
    <article className={`card p-4 sm:p-5 ${archived ? 'opacity-80' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-brand-ink sm:text-lg">{habit.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-brand-muted">
            <span className="badge bg-brand-line text-brand-ink">
              {habit.type === 'binary' ? 'Сделано / пропущено' : `Счётчик${habit.target ? ` · цель ${habit.target}${habit.unit ? ` ${habit.unit}` : ''}` : ''}`}
            </span>
            {archived && <span className="badge bg-brand-warning-soft text-brand-warning">Архив</span>}
            {!scheduledToday && !archived && <span className="badge bg-brand-line text-brand-muted">Сегодня не запланировано</span>}
          </div>
          {habit.description && <p className="mt-2 text-sm text-brand-muted">{habit.description}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => onEdit(habit)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-muted hover:bg-brand-soft">Изменить</button>
          <button type="button" onClick={() => onToggleStatus(habit)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-muted hover:bg-brand-soft">
            {archived ? 'Вернуть' : 'В архив'}
          </button>
          <button type="button" onClick={() => onDelete(habit)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-danger hover:bg-brand-danger-soft">Удалить</button>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-brand-soft p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">
          Сегодня, {formatDate(today)}
        </p>
        {habit.type === 'binary' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={saving || archived || !scheduledToday}
              onClick={() => commit(today, '1')}
              className={`btn min-h-10 ${record?.value === 1 ? 'btn-primary' : 'border border-brand-accent bg-white text-brand-blue-strong hover:bg-brand-soft'}`}
            >
              ✓ Сделано
            </button>
            <button
              type="button"
              disabled={saving || archived || !scheduledToday}
              onClick={() => commit(today, '0')}
              className={`btn min-h-10 ${record?.value === 0 ? 'bg-brand-danger text-white hover:bg-brand-danger' : 'border border-[#f5c6c0] bg-white text-brand-danger hover:bg-brand-danger-soft'}`}
            >
              ✕ Пропущено
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              className="input min-h-10 flex-1"
              type="number"
              min={0}
              max={9999}
              inputMode="numeric"
              value={inputValue}
              disabled={saving || archived || !scheduledToday}
              aria-label={`Значение привычки ${habit.name}`}
              onChange={(event) => setInputValue(event.target.value)}
            />
            <button
              type="button"
              disabled={saving || archived || !scheduledToday}
              onClick={() => commit(today, inputValue)}
              className="btn-primary min-h-10 shrink-0"
            >
              Сохранить
            </button>
          </div>
        )}
        {feedback && <p className="mt-2 text-xs font-semibold text-brand-green-strong" role="status">{feedback}</p>}
      </div>

      {editDate && (
        <div className="mt-3 rounded-xl border border-brand-accent bg-brand-mint p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-brand-ink">Отметка за {formatDate(editDate)}</p>
            <button type="button" onClick={() => setEditDate(null)} className="text-xs font-semibold text-brand-muted hover:text-brand-ink">Закрыть</button>
          </div>
          {habit.type === 'binary' ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondary min-h-10" onClick={() => commit(editDate, '1')}>Сделано</button>
              <button type="button" className="btn-secondary min-h-10" onClick={() => commit(editDate, '0')}>Пропущено</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input className="input min-h-10 flex-1" type="number" min={0} max={9999} value={editValue} onChange={(event) => setEditValue(event.target.value)} aria-label={`Значение за ${editDate}`} />
              <button type="button" className="btn-primary min-h-10" onClick={() => commit(editDate, editValue)}>Сохранить</button>
            </div>
          )}
        </div>
      )}

      {error && <p className="alert-error mt-3" role="alert">{error}</p>}

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-brand-line pt-4 text-center">
        <div>
          <p className="text-lg font-bold text-brand-ink">{stat?.streak ?? 0}</p>
          <p className="text-[11px] text-brand-muted">серия, дней</p>
        </div>
        <div>
          <p className="text-lg font-bold text-brand-ink">{stat?.completion7d.percent ?? 0}%</p>
          <p className="text-[11px] text-brand-muted">за 7 дней</p>
        </div>
        <div>
          <p className="text-lg font-bold text-brand-ink">{stat?.completion30d.percent ?? 0}%</p>
          <p className="text-[11px] text-brand-muted">за 30 дней</p>
        </div>
      </div>

      {stat?.heatmap && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">Последние 30 дней · нажмите, чтобы исправить</p>
          <Heatmap days={stat.heatmap} onSelect={openEditor} showLegend={false} />
        </div>
      )}
    </article>
  );
}
