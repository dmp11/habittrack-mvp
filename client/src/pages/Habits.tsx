import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../api';
import { HabitCard } from '../components/HabitCard';
import { HabitModal } from '../components/HabitModal';
import { useAuth } from '../context/AuthContext';
import type { Habit, HabitInput, HabitStat, RecordItem, Stats } from '../types';
import { formatDate } from '../utils/date';

export function Habits() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const reload = useCallback(async () => {
    const nextStats = await api.getStats(30);
    const [habitResponse, recordResponse] = await Promise.all([
      api.listHabits(),
      api.listRecords(nextStats.today, nextStats.today),
    ]);
    setStats(nextStats);
    setHabits(habitResponse.habits);
    setRecords(recordResponse.records);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((caught) => active && setError(errorMessage(caught)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reload]);

  const statsByHabit = useMemo(() => {
    const map = new Map<string, HabitStat>();
    stats?.habits.forEach((item) => map.set(item.id, item));
    return map;
  }, [stats]);

  const recordsByHabit = useMemo(() => {
    const map = new Map<string, RecordItem>();
    records.forEach((item) => map.set(item.habit_id, item));
    return map;
  }, [records]);

  const visibleHabits = habits.filter((habit) => (showArchive ? habit.status === 'archive' : habit.status === 'active'));
  const archivedCount = habits.filter((habit) => habit.status === 'archive').length;

  const openCreate = () => {
    setEditingHabit(null);
    setModalOpen(true);
  };

  const openEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setModalOpen(true);
  };

  const saveHabit = async (data: HabitInput) => {
    if (editingHabit) await api.updateHabit(editingHabit.id, data);
    else await api.createHabit(data);
    await reload();
  };

  const saveRecord = async (habitId: string, date: string, value: number) => {
    await api.saveRecord({ habitId, date, value });
    await reload();
  };

  const toggleStatus = async (habit: Habit) => {
    await api.updateHabit(habit.id, { status: habit.status === 'archive' ? 'active' : 'archive' });
    await reload();
  };

  const removeHabit = async (habit: Habit) => {
    if (!window.confirm(`Удалить привычку «${habit.name}» и все её отметки?`)) return;
    await api.deleteHabit(habit.id);
    await reload();
  };

  const handleError = (caught: unknown) => setError(errorMessage(caught));

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden brand-tint p-5 text-brand-ink sm:p-7">
        <p className="text-base font-semibold text-brand-blue-strong">Привет{user?.name ? `, ${user.name}` : ''}!</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Сегодня, {stats ? formatDate(stats.today, { day: 'numeric', month: 'long', weekday: 'long' }) : '...'}</h1>
        <p className="mt-2 max-w-xl text-base text-brand-muted">
          Отмечайте привычки каждый день — и следите, как растёт ваша серия.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={openCreate} className="btn-primary">
            + Новая привычка
          </button>
          <span className="text-sm font-medium text-brand-muted">Активных: {habits.filter((habit) => habit.status === 'active').length}</span>
        </div>
      </section>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-brand-danger-soft px-4 py-3 text-sm text-brand-danger" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="font-semibold" aria-label="Закрыть ошибку">✕</button>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-brand-line">
        <button type="button" onClick={() => setShowArchive(false)} className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${!showArchive ? 'border-brand-green text-brand-blue-strong' : 'border-transparent text-brand-muted hover:text-brand-ink'}`}>
          Активные
        </button>
        <button type="button" onClick={() => setShowArchive(true)} className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${showArchive ? 'border-brand-green text-brand-blue-strong' : 'border-transparent text-brand-muted hover:text-brand-ink'}`}>
          Архив {archivedCount > 0 && `(${archivedCount})`}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4" role="status">
          {[1, 2].map((item) => <div key={item} className="card h-64 animate-pulse bg-brand-line" />)}
        </div>
      ) : visibleHabits.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-lg font-bold text-brand-ink">{showArchive ? 'В архиве пока пусто' : 'Привычек пока нет'}</p>
          <p className="mt-2 text-base text-brand-muted">
            {showArchive ? 'Архивированные привычки появятся здесь.' : 'Ты на верном пути — добавьте первую привычку и отмечайте её каждый день.'}
          </p>
          {!showArchive && <button type="button" onClick={openCreate} className="btn-primary mt-5">Создать привычку</button>}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              stat={statsByHabit.get(habit.id)}
              record={recordsByHabit.get(habit.id)}
              today={stats?.today || new Date().toISOString().slice(0, 10)}
              onSaveRecord={saveRecord}
              onEdit={openEdit}
              onToggleStatus={(item) => toggleStatus(item).catch(handleError)}
              onDelete={(item) => removeHabit(item).catch(handleError)}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <HabitModal
          habit={editingHabit}
          onClose={() => setModalOpen(false)}
          onSave={saveHabit}
        />
      )}
    </div>
  );
}
