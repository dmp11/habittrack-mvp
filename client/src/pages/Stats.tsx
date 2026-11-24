import { useCallback, useEffect, useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { api, downloadStatsCsv, errorMessage } from '../api';
import { Heatmap } from '../components/Heatmap';
import type { Stats as StatsData } from '../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// Палитра графика построена на цветах брендбука.
const PALETTE = ['#2ECC71', '#3498DB', '#85C1E9', '#2C3E50', '#E74C3C', '#5D6D7E', '#2D8560'];

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
    tooltip: {
      callbacks: {
        label: (context) => {
          const value = context.parsed.y;
          return value == null ? 'нет данных' : `${context.dataset.label}: ${value}`;
        },
      },
    },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: '#e3ebf1' }, ticks: { color: '#576877' } },
    x: { grid: { display: false }, ticks: { color: '#576877', maxRotation: 0, autoSkip: true } },
  },
};

function Metric({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-bold text-brand-ink">{value}</p>
      <p className="mt-1 text-sm font-semibold text-brand-ink">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-brand-muted">{hint}</p>}
    </div>
  );
}

export function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setStats(await api.getStats(30, period));
  }, [period]);

  useEffect(() => {
    let active = true;
    load().catch((caught) => active && setError(errorMessage(caught)));
    return () => {
      active = false;
    };
  }, [load]);

  const exportCsv = async () => {
    setDownloading(true);
    setError('');
    try {
      await downloadStatsCsv();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDownloading(false);
    }
  };

  if (!stats) {
    return <div className="card p-8 text-center text-sm text-brand-muted" role="status">Загружаем статистику…</div>;
  }

  const chartData = {
    labels: stats.chart.labels,
    datasets: stats.chart.datasets.map((dataset, index) => ({
      label: dataset.unit ? `${dataset.name} (${dataset.unit})` : dataset.name,
      data: dataset.data,
      borderColor: PALETTE[index % PALETTE.length],
      backgroundColor: PALETTE[index % PALETTE.length],
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      spanGaps: false,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">Статистика</h1>
          <p className="mt-1 text-base text-brand-muted">Данные за последние 30 дней · часовой пояс {stats.timezone}</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={downloading} className="btn-secondary">
          ↓ {downloading ? 'Готовим CSV…' : 'Скачать CSV'}
        </button>
      </div>

      {error && <p className="alert-error" role="alert">{error}</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric value={stats.summary.totalCompletedDays} label="Выполненных дней" hint="за всё время" />
        <Metric value={stats.summary.currentStreak} label="Лучшая серия" hint="среди активных привычек" />
        <Metric value={`${stats.summary.completion7d.percent}%`} label="За 7 дней" hint={`${stats.summary.completion7d.completed} из ${stats.summary.completion7d.scheduled}`} />
        <Metric value={`${stats.summary.completion30d.percent}%`} label="За 30 дней" hint={`${stats.summary.completion30d.completed} из ${stats.summary.completion30d.scheduled}`} />
      </section>

      <section className="card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-ink">Календарь активности</h2>
            <p className="text-sm text-brand-muted">Все активные привычки за 30 дней</p>
          </div>
        </div>
        <Heatmap days={stats.heatmap} />
      </section>

      <section className="card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-ink">Динамика счётчиков</h2>
            <p className="text-sm text-brand-muted">Среднее значение по дням с отметками</p>
          </div>
          <div className="flex rounded-lg bg-brand-line p-1" role="group" aria-label="Период графика">
            {(['week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                className={`min-h-9 rounded-md px-3 text-sm font-semibold ${period === option ? 'bg-white text-brand-blue-strong shadow-sm' : 'text-brand-muted'}`}
              >
                {option === 'week' ? 'Недели' : 'Месяцы'}
              </button>
            ))}
          </div>
        </div>
        {stats.chart.datasets.length === 0 ? (
          <p className="rounded-xl bg-brand-soft p-6 text-center text-sm text-brand-muted">
            Добавьте привычку типа «Счётчик», чтобы увидеть график.
          </p>
        ) : (
          <div className="h-72 sm:h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-brand-line px-4 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-brand-ink">По привычкам</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-brand-soft text-xs uppercase tracking-wide text-brand-muted">
              <tr>
                <th className="px-4 py-3 sm:px-6">Привычка</th>
                <th className="px-3 py-3">Серия</th>
                <th className="px-3 py-3">7 дней</th>
                <th className="px-3 py-3">30 дней</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {stats.habits.map((habit) => (
                <tr key={habit.id}>
                  <td className="px-4 py-3 sm:px-6">
                    <span className="font-semibold text-brand-ink">{habit.name}</span>
                    {habit.status === 'archive' && <span className="ml-2 badge bg-brand-warning-soft text-brand-warning">Архив</span>}
                  </td>
                  <td className="px-3 py-3 text-brand-ink">{habit.streak} дн.</td>
                  <td className="px-3 py-3 text-brand-ink">{habit.completion7d.percent}%</td>
                  <td className="px-3 py-3 text-brand-ink">{habit.completion30d.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
