import React, { useState } from 'react';
import StaffShell from './StaffShell';
import StatisticsView from '../../components/StatisticsView';

const StatisticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState('month');

  return (
    <StaffShell
      title="Báo cáo & Thống kê"
      subtitle="Tổng quan hoạt động kinh doanh toàn hệ thống"
    // actions={
    //   <div className="flex bg-white/50 backdrop-blur p-1 rounded-2xl border border-gold/10 shadow-inner">
    //     {['week', 'month', 'year'].map((range) => (
    //       <button
    //         key={range}
    //         onClick={() => setTimeRange(range)}
    //         className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
    //           timeRange === range 
    //           ? 'bg-primary text-white shadow-lg' 
    //           : 'text-slate-400 hover:text-primary'
    //         }`}
    //       >
    //         {range === 'week' ? 'Tuần' : range === 'month' ? 'Tháng' : 'Năm'}
    //       </button>
    //     ))}
    //   </div>
    // }
    >
      <StatisticsView isStaff={true} />
    </StaffShell>
  );
};

export default StatisticsPage;
