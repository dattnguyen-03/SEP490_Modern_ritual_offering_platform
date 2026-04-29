import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { statisticsService, VendorDashboardResult } from '../../services/statisticsService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

interface VendorComparePageProps { 
  onNavigate: (path: string) => void; 
  isAdmin?: boolean;
}

type GroupBy = 'day' | 'month' | 'year';

interface PeriodCfg { startDate: string; endDate: string; label: string; }

const fmt = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
const fmtN = (v: number) => v.toLocaleString('vi-VN');

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { font: { size: 11, weight: 'bold' as any }, padding: 16, usePointStyle: true } },
    tooltip: { backgroundColor: '#1C1C1C', titleFont: { size: 13, weight: 'bold' as any }, bodyFont: { size: 12 }, padding: 12, cornerRadius: 12 },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10, weight: 'bold' as any }, color: '#64748b' } },
    x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' as any }, color: '#64748b' } },
  },
};

const Empty = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[200px] bg-ritual-bg/20 rounded-[1.5rem] border border-dashed border-gold/20">
    <span className="material-symbols-outlined text-4xl text-gold/30 mb-2">bar_chart</span>
    <p className="text-[10px] font-black uppercase tracking-widest text-primary/30">Chưa có dữ liệu</p>
  </div>
);

const Spinner = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
  </div>
);

function defaultPeriod(groupBy: GroupBy, offset: number): PeriodCfg {
  const now = new Date();
  if (groupBy === 'year' || groupBy === 'month') {
    const y = now.getFullYear() - offset;
    return { startDate: `${y}-01-01`, endDate: `${y}-12-31`, label: `Năm ${y}` };
  }
  // day → show a specific month
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    startDate: d.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`,
  };
}

function calcDiff(a: number, b: number) { return b === 0 ? 0 : ((a - b) / b) * 100; }

const StatCard: React.FC<{ label: string; va: string; vb: string; icon: string; diff: number }> = ({ label, va, vb, icon, diff }) => (
  <div className="bg-white rounded-[1.75rem] p-5 border border-gold/10 shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-9 h-9 rounded-xl bg-ritual-bg flex items-center justify-center">
        <span className="material-symbols-outlined text-lg text-primary">{icon}</span>
      </div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    </div>
    <div className="flex gap-3">
      <div className="flex-1 bg-amber-50 rounded-xl p-3">
        <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1">Kỳ A</p>
        <p className="text-sm font-black text-primary leading-tight">{va}</p>
      </div>
      <div className="flex-1 bg-blue-50 rounded-xl p-3">
        <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">Kỳ B</p>
        <p className="text-sm font-black text-primary leading-tight">{vb}</p>
      </div>
    </div>
    <div className={`mt-2 text-[10px] font-black px-2 py-0.5 rounded-lg inline-block ${diff >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
      {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
    </div>
  </div>
);

const PeriodInput: React.FC<{ cfg: PeriodCfg; onChange: (c: PeriodCfg) => void; tag: string; color: string }> = ({ cfg, onChange, tag, color }) => (
  <div className={`bg-white rounded-[1.5rem] p-5 border-2 ${color} shadow-sm`}>
    <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${color.includes('amber') ? 'text-amber-500' : 'text-blue-500'}`}>{tag}</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { lbl: 'Từ ngày', val: cfg.startDate, key: 'startDate' as const, type: 'date' },
        { lbl: 'Đến ngày', val: cfg.endDate, key: 'endDate' as const, type: 'date' },
        { lbl: 'Tên kỳ', val: cfg.label, key: 'label' as const, type: 'text' },
      ].map(f => (
        <div key={f.key}>
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{f.lbl}</label>
          <input
            type={f.type}
            value={f.val}
            placeholder={f.type === 'text' ? 'VD: Tháng 1' : undefined}
            onChange={e => onChange({ ...cfg, [f.key]: e.target.value })}
            className="w-full px-3 py-2 text-xs font-bold text-primary bg-ritual-bg/50 border border-gold/10 rounded-xl outline-none focus:border-primary transition-colors"
          />
        </div>
      ))}
    </div>
  </div>
);

const VendorComparePage: React.FC<VendorComparePageProps> = ({ onNavigate: _, isAdmin = false }) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('year');
  const [cfgA, setCfgA] = useState<PeriodCfg>(() => defaultPeriod('year', 0));
  const [cfgB, setCfgB] = useState<PeriodCfg>(() => defaultPeriod('year', 1));
  const [dataA, setDataA] = useState<any>(null);
  const [dataB, setDataB] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runFetch = async (a: PeriodCfg, b: PeriodCfg) => {
    setLoading(true);
    const fetchFn = isAdmin ? statisticsService.getOverview : statisticsService.getVendorDashboard;
    try {
      const [ra, rb] = await Promise.all([
        fetchFn({ startDate: a.startDate, endDate: a.endDate }).catch(() => null),
        fetchFn({ startDate: b.startDate, endDate: b.endDate }).catch(() => null),
      ]);
      setDataA(ra);
      setDataB(rb);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runFetch(cfgA, cfgB); }, []);

  const handleGroupBy = (g: GroupBy) => {
    setGroupBy(g);
    const a = defaultPeriod(g, 0);
    const b = defaultPeriod(g, 1);
    setCfgA(a); setCfgB(b);
  };

  // Revenue line chart
  const revLabels = useMemo(() => {
    const setA = (dataA?.revenueChart || []).map(i => i.label);
    const setB = (dataB?.revenueChart || []).map(i => i.label);
    return Array.from(new Set([...setA, ...setB]));
  }, [dataA, dataB]);

  const revChart = useMemo(() => ({
    labels: revLabels,
    datasets: [
      {
        label: `Doanh thu — ${cfgA.label}`,
        data: revLabels.map(l => dataA?.revenueChart?.find(i => i.label === l)?.value ?? 0),
        borderColor: '#C98C1A', backgroundColor: 'rgba(201,140,26,0.12)',
        fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#C98C1A',
      },
      {
        label: `Doanh thu — ${cfgB.label}`,
        data: revLabels.map(l => dataB?.revenueChart?.find(i => i.label === l)?.value ?? 0),
        borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#3b82f6',
      },
    ],
  }), [dataA, dataB, revLabels, cfgA.label, cfgB.label]);

  // Order status bar chart
  const ordLabels = useMemo(() => {
    const sA = (dataA?.orderStatusChart || []).map(i => i.status);
    const sB = (dataB?.orderStatusChart || []).map(i => i.status);
    return Array.from(new Set([...sA, ...sB]));
  }, [dataA, dataB]);

  const ordChart = useMemo(() => ({
    labels: ordLabels,
    datasets: [
      {
        label: `Đơn hàng — ${cfgA.label}`,
        data: ordLabels.map(s => dataA?.orderStatusChart?.find(i => i.status === s)?.count ?? 0),
        backgroundColor: 'rgba(201,140,26,0.7)', borderColor: '#C98C1A', borderWidth: 2, borderRadius: 8,
      },
      {
        label: `Đơn hàng — ${cfgB.label}`,
        data: ordLabels.map(s => dataB?.orderStatusChart?.find(i => i.status === s)?.count ?? 0),
        backgroundColor: 'rgba(59,130,246,0.6)', borderColor: '#3b82f6', borderWidth: 2, borderRadius: 8,
      },
    ],
  }), [dataA, dataB, ordLabels, cfgA.label, cfgB.label]);

  // Top products bar chart
  const prodLabels = useMemo(() => {
    const pA = (dataA?.topProducts || []).map(p => p.productName);
    const pB = (dataB?.topProducts || []).map(p => p.productName);
    return Array.from(new Set([...pA, ...pB])).slice(0, 8);
  }, [dataA, dataB]);

  const prodChart = useMemo(() => ({
    labels: prodLabels,
    datasets: [
      {
        label: `Doanh thu SP — ${cfgA.label}`,
        data: prodLabels.map(n => dataA?.topProducts?.find(p => p.productName === n)?.revenue ?? 0),
        backgroundColor: 'rgba(201,140,26,0.75)', borderColor: '#C98C1A', borderWidth: 2, borderRadius: 6,
      },
      {
        label: `Doanh thu SP — ${cfgB.label}`,
        data: prodLabels.map(n => dataB?.topProducts?.find(p => p.productName === n)?.revenue ?? 0),
        backgroundColor: 'rgba(59,130,246,0.65)', borderColor: '#3b82f6', borderWidth: 2, borderRadius: 6,
      },
    ],
  }), [dataA, dataB, prodLabels, cfgA.label, cfgB.label]);

  const revA = dataA?.totalRevenue ?? 0, revB = dataB?.totalRevenue ?? 0;
  const ordA = dataA?.totalOrders ?? 0, ordB = dataB?.totalOrders ?? 0;
  const avgA = dataA?.averageOrderValue ?? 0, avgB = dataB?.averageOrderValue ?? 0;
  const hasRevData = revChart.datasets.some(d => d.data.some(v => v > 0));
  const hasOrdData = ordLabels.length > 0;
  const hasProdData = prodLabels.length > 0;

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="bg-white rounded-[2rem] p-5 border border-gold/10 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-gold">compare_arrows</span>
            So sánh theo kỳ
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Chọn khoảng thời gian để đối chiếu</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-ritual-bg/50 p-1.5 rounded-2xl border border-gold/10">
            {(['day', 'month', 'year'] as GroupBy[]).map(g => (
              <button key={g} onClick={() => handleGroupBy(g)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${groupBy === g ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-primary'}`}>
                {g === 'day' ? 'Ngày' : g === 'month' ? 'Tháng' : 'Năm'}
              </button>
            ))}
          </div>
          <button onClick={() => runFetch(cfgA, cfgB)} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50">
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <span className="material-symbols-outlined text-sm">sync</span>}
            So sánh
          </button>
        </div>
      </div>

      {/* Period selectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PeriodInput cfg={cfgA} onChange={setCfgA} tag="🟡 Kỳ A" color="border-amber-200" />
        <PeriodInput cfg={cfgB} onChange={setCfgB} tag="🔵 Kỳ B" color="border-blue-200" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Doanh thu" icon="payments" va={fmt(revA)} vb={fmt(revB)} diff={calcDiff(revA, revB)} />
        <StatCard label="Đơn hàng" icon="receipt_long" va={fmtN(ordA)} vb={fmtN(ordB)} diff={calcDiff(ordA, ordB)} />
        <StatCard label="Giá trị TB / đơn" icon="trending_up" va={fmt(avgA)} vb={fmt(avgB)} diff={calcDiff(avgA, avgB)} />
      </div>

      {/* Revenue line chart */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
        <h4 className="text-base font-black text-primary mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-gold">show_chart</span>Biểu đồ doanh thu so sánh
        </h4>
        <div className="h-[300px]">
          {loading ? <Spinner /> : hasRevData ? <Line data={revChart} options={CHART_OPTS} /> : <Empty />}
        </div>
      </div>

      {/* Order status */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
        <h4 className="text-base font-black text-primary mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-gold">bar_chart</span>Trạng thái đơn hàng so sánh
        </h4>
        <div className="h-[280px]">
          {loading ? <Spinner /> : hasOrdData ? <Bar data={ordChart} options={CHART_OPTS} /> : <Empty />}
        </div>
      </div>

      {/* Top products */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm">
        <h4 className="text-base font-black text-primary mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-gold">inventory_2</span>Top sản phẩm so sánh
        </h4>
        <div className="h-[320px]">
          {loading ? <Spinner /> : hasProdData
            ? <Bar data={prodChart} options={{ ...CHART_OPTS, indexAxis: 'y' as const }} />
            : <Empty />}
        </div>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-gold/10 shadow-sm overflow-x-auto">
        <h4 className="text-base font-black text-primary mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-gold">table_chart</span>Bảng tổng hợp
        </h4>
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-gold/10">
              <th className="text-left py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Chỉ số</th>
              <th className="text-right py-3 px-4 text-[9px] font-black text-amber-500 uppercase tracking-widest">🟡 {cfgA.label}</th>
              <th className="text-right py-3 px-4 text-[9px] font-black text-blue-500 uppercase tracking-widest">🔵 {cfgB.label}</th>
              <th className="text-right py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Chênh lệch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/5">
            {[
              { lbl: 'Tổng doanh thu', va: fmt(revA), vb: fmt(revB), d: calcDiff(revA, revB) },
              { lbl: 'Số đơn hàng', va: fmtN(ordA), vb: fmtN(ordB), d: calcDiff(ordA, ordB) },
              { lbl: 'Giá trị TB / đơn', va: fmt(avgA), vb: fmt(avgB), d: calcDiff(avgA, avgB) },
              { lbl: 'Tổng sản phẩm', va: fmtN(dataA?.totalProducts ?? 0), vb: fmtN(dataB?.totalProducts ?? 0), d: calcDiff(dataA?.totalProducts ?? 0, dataB?.totalProducts ?? 0) },
            ].map((r, i) => (
              <tr key={i} className="hover:bg-ritual-bg/20 transition-colors">
                <td className="py-4 px-4 font-bold text-primary">{r.lbl}</td>
                <td className="py-4 px-4 text-right font-black text-primary">{r.va}</td>
                <td className="py-4 px-4 text-right font-black text-primary">{r.vb}</td>
                <td className="py-4 px-4 text-right">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${r.d >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {r.d >= 0 ? '▲' : '▼'} {Math.abs(r.d).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VendorComparePage;
