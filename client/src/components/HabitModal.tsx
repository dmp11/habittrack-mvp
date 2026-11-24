import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import type { DayCode, Habit, HabitInput, HabitType } from '../types';
import { DAY_CODES, dayLabel } from '../utils/date';

interface Props {
  habit: Habit | null;
  onClose: () => void;
  onSave: (data: HabitInput) => Promise<void>;
}

export function HabitModal({ habit, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<HabitType>('binary');
  const [frequency, setFrequency] = useState<DayCode[]>([...DAY_CODES]);
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(habit?.name || '');
    setType(habit?.type || 'binary');
    setFrequency(habit?.frequency?.length ? habit.frequency : [...DAY_CODES]);
    setTarget(habit?.target ? String(habit.target) : '');
    setUnit(habit?.unit || '');
    setDescription(habit?.description || '');
    setError('');
  }, [habit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleDay = (day: DayCode) => {
    setFrequency((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) return setError('Введите название привычки');
    if (!frequency.length) return setError('Выберите хотя бы один день недели');
    if (type === 'counter' && (!target || Number(target) < 1 || Number(target) > 9999)) {
      return setError('Целевое значение должно быть от 1 до 9999');
    }

    const data: HabitInput = {
      name: name.trim(),
      type,
      frequency: DAY_CODES.filter((day) => frequency.includes(day)),
      target: type === 'counter' ? Number(target) : null,
      unit: unit.trim() || null,
      description: description.trim() || null,
    };
    if (habit) data.status = habit.status;

    setSaving(true);
    try {
      await onSave(data);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-brand-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="habit-modal-title">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="habit-modal-title" className="text-xl font-bold text-brand-ink">
              {habit ? 'Редактировать привычку' : 'Новая привычка'}
            </h2>
            <p className="mt-1 text-sm text-brand-muted">Настройте привычку под себя</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-brand-muted hover:bg-brand-soft" aria-label="Закрыть">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="habit-name">Название</label>
            <input id="habit-name" className="input" value={name} maxLength={80} placeholder="Например, Пить воду" onChange={(event) => setName(event.target.value)} />
          </div>

          <div>
            <span className="label">Тип</span>
            <div className="grid grid-cols-2 gap-2">
              {(['binary', 'counter'] as HabitType[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setType(option)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                    type === option ? 'border-brand-green bg-brand-mint text-brand-blue-strong' : 'border-brand-line bg-white text-brand-muted hover:bg-brand-soft'
                  }`}
                >
                  {option === 'binary' ? 'Сделано / пропущено' : 'Счётчик'}
                </button>
              ))}
            </div>
          </div>

          {type === 'counter' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="habit-target">Цель в день</label>
                <input id="habit-target" className="input" type="number" min={1} max={9999} value={target} placeholder="2000" onChange={(event) => setTarget(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="habit-unit">Единица</label>
                <input id="habit-unit" className="input" maxLength={20} value={unit} placeholder="мл" onChange={(event) => setUnit(event.target.value)} />
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="label mb-0">Дни недели</span>
              <button type="button" className="link text-xs" onClick={() => setFrequency(frequency.length === DAY_CODES.length ? [] : [...DAY_CODES])}>
                {frequency.length === DAY_CODES.length ? 'Снять все' : 'Каждый день'}
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_CODES.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={frequency.includes(day)}
                  className={`min-h-10 rounded-lg border text-xs font-semibold transition-colors ${
                    frequency.includes(day)
                      ? 'border-brand-green bg-brand-green-strong text-white'
                      : 'border-brand-line bg-white text-brand-muted hover:bg-brand-soft'
                  }`}
                >
                  {dayLabel(day)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="habit-description">Описание (необязательно)</label>
            <textarea id="habit-description" className="input min-h-20 resize-y" maxLength={300} value={description} placeholder="Зачем вам эта привычка?" onChange={(event) => setDescription(event.target.value)} />
          </div>

          {error && <p className="alert-error" role="alert">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Отмена</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Сохраняем…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
