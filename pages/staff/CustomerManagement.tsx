import React, { useState } from 'react';

interface CustomerManagementProps {
  onNavigate: (path: string) => void;
  onLogout?: () => void;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'blocked';
  totalOrders: number;
  totalSpent: number;
  joinDate: string;
  lastOrder?: string;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
}

const CustomerManagement: React.FC<CustomerManagementProps> = ({ onNavigate, onLogout }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | Customer['status']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: 'CUS-001',
      name: 'Nguyễn Văn A',
      email: 'nguyenvana@email.com',
      phone: '0901234567',
      status: 'active',
      totalOrders: 15,
      totalSpent: 12500000,
      joinDate: '2024-06-15',
      lastOrder: '2025-02-03',
      level: 'gold'
    },
    {
      id: 'CUS-002',
      name: 'Trần Thị B',
      email: 'tranthib@email.com',
      phone: '0912345678',
      status: 'active',
      totalOrders: 28,
      totalSpent: 25000000,
      joinDate: '2024-03-20',
      lastOrder: '2025-02-05',
      level: 'platinum'
    },
    {
      id: 'CUS-003',
      name: 'Lê Văn C',
      email: 'levanc@email.com',
      phone: '0923456789',
      status: 'active',
      totalOrders: 8,
      totalSpent: 6500000,
      joinDate: '2024-09-10',
      lastOrder: '2025-01-28',
      level: 'silver'
    },
    {
      id: 'CUS-004',
      name: 'Phạm Thị D',
      email: 'phamthid@email.com',
      phone: '0934567890',
      status: 'inactive',
      totalOrders: 3,
      totalSpent: 1800000,
      joinDate: '2024-11-05',
      lastOrder: '2024-12-15',
      level: 'bronze'
    },
    {
      id: 'CUS-005',
      name: 'Hoàng Văn E',
      email: 'hoangvane@email.com',
      phone: '0945678901',
      status: 'blocked',
      totalOrders: 2,
      totalSpent: 500000,
      joinDate: '2024-12-01',
      lastOrder: '2024-12-20',
      level: 'bronze'
    },
  ]);

  const stats = [
    {
      label: 'Tổng khách hàng',
      value: customers.length.toString(),


    },
    {
      label: 'Đang hoạt động',
      value: customers.filter(c => c.status === 'active').length.toString(),

    },
    {
      label: 'Không hoạt động',
      value: customers.filter(c => c.status === 'inactive').length.toString(),

    },
    {
      label: 'Tổng doanh thu',
      value: (customers.reduce((sum, c) => sum + c.totalSpent, 0) / 1000000).toFixed(1) + 'M',

    },
  ];

  const getStatusBadge = (status: Customer['status']) => {
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      blocked: 'bg-red-100 text-red-800 border-red-200',
    };
    const labels = {
      active: 'Đang hoạt động',
      inactive: 'Không hoạt động',
      blocked: 'Đã chặn',
    };
    return { style: styles[status], label: labels[status] };
  };

  const getLevelBadge = (level: Customer['level']) => {
    const styles = {
      bronze: 'bg-orange-100 text-orange-800 border-orange-200',
      silver: 'bg-gray-100 text-gray-800 border-gray-300',
      gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      platinum: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    const labels = {
      bronze: '🥉 Đồng',
      silver: '🥈 Bạc',
      gold: '🥇 Vàng',
      platinum: '💎 Bạch Kim',
    };
    return { style: styles[level], label: labels[level] };
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesStatus = filterStatus === 'all' || customer.status === filterStatus;
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery) ||
      customer.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const currentCustomers = filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleBlockCustomer = (customerId: string) => {
    if (confirm('Bạn có chắc muốn chặn khách hàng này?')) {
      setCustomers(customers.map(c =>
        c.id === customerId ? { ...c, status: 'blocked' as Customer['status'] } : c
      ));
    }
  };

  const handleUnblockCustomer = (customerId: string) => {
    setCustomers(customers.map(c =>
      c.id === customerId ? { ...c, status: 'active' as Customer['status'] } : c
    ));
  };

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý khách hàng</h1>
          <p className="text-gray-600 mt-1">Theo dõi, phân loại và hỗ trợ khách hàng</p>
        </div>
        <div>
          <button className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold shadow-sm hover:bg-gray-800">
            Xuất báo cáo
          </button>
        </div>
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">

              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</h3>
              <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'all', label: 'Tất cả' },
                { id: 'active', label: 'Đang hoạt động' },
                { id: 'inactive', label: 'Không hoạt động' },
                { id: 'blocked', label: 'Đã chặn' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterStatus(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filterStatus === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm theo tên, email, SĐT, ID..."
                className="w-full px-4 py-2 rounded-full border border-slate-200 focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-bold text-black uppercase tracking-widest">Khách hàng</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-black uppercase tracking-widest">Liên hệ</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-black uppercase tracking-widest">Hạng</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-black uppercase tracking-widest">Đơn hàng</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-black uppercase tracking-widest">Tổng chi</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-black uppercase tracking-widest">Trạng thái</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-black uppercase tracking-widest">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {currentCustomers.map((customer) => {
                  const statusBadge = getStatusBadge(customer.status);
                  const levelBadge = getLevelBadge(customer.level);

                  return (
                    <tr
                      key={customer.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <td className="py-4 px-4">
                        <p className="font-semibold text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-500">{customer.id}</p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-gray-700">{customer.email}</p>
                          <p className="text-gray-500">{customer.phone}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${levelBadge.style}`}>
                          {levelBadge.label}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-900">{customer.totalOrders}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-900">
                          {customer.totalSpent.toLocaleString('vi-VN')}₫
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${statusBadge.style}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          {customer.status === 'blocked' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnblockCustomer(customer.id);
                              }}
                              className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold hover:bg-emerald-200 transition"
                            >
                              Mở chặn
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBlockCustomer(customer.id);
                              }}
                              className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold hover:bg-rose-200 transition"
                            >
                              Chặn
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/30">
              <p className="text-[10px] font-bold text-black uppercase tracking-widest">
                Hiển thị <span className="text-slate-900">{Math.min(filteredCustomers.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span>
                - <span className="text-slate-900">{Math.min(filteredCustomers.length, currentPage * ITEMS_PER_PAGE)}</span>
                trên <span className="text-slate-900">{filteredCustomers.length}</span> kết quả
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-black hover:bg-black hover:text-white transition-all shadow-sm disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest"
                >
                  Trước
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-xl font-bold text-[10px] transition-all ${currentPage === pageNum ? 'bg-black text-white shadow-lg' : 'bg-white text-black hover:bg-slate-50 border border-slate-200'}`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-black hover:bg-black hover:text-white transition-all shadow-sm disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>

        {filteredCustomers.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-5xl mb-3">👥</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Không tìm thấy khách hàng</h3>
            <p className="text-gray-600">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        )}
        {selectedCustomer && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setSelectedCustomer(null)}
          >
            <div
              className="bg-white rounded-2xl p-8 max-w-3xl w-full border border-slate-200 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedCustomer.name}</h2>
                  <p className="text-gray-600">{selectedCustomer.id}</p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-gray-500 hover:text-gray-900 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex gap-2">
                  {(() => {
                    const statusBadge = getStatusBadge(selectedCustomer.status);
                    const levelBadge = getLevelBadge(selectedCustomer.level);
                    return (
                      <>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${statusBadge.style}`}>
                          {statusBadge.label}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${levelBadge.style}`}>
                          {levelBadge.label}
                        </span>
                      </>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-gray-600 mb-1">Email</p>
                    <p className="font-semibold text-gray-900">{selectedCustomer.email}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-gray-600 mb-1">Số điện thoại</p>
                    <p className="font-semibold text-gray-900">{selectedCustomer.phone}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-gray-600 mb-1">Ngày tham gia</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(selectedCustomer.joinDate).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-gray-600 mb-1">Đơn hàng cuối</p>
                    <p className="font-semibold text-gray-900">
                      {selectedCustomer.lastOrder
                        ? new Date(selectedCustomer.lastOrder).toLocaleDateString('vi-VN')
                        : 'Chưa có'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-gray-600 mb-1">Tổng đơn hàng</p>
                    <p className="font-bold text-gray-900 text-lg">{selectedCustomer.totalOrders}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-gray-600 mb-1">Tổng chi tiêu</p>
                    <p className="font-bold text-gray-900 text-lg">
                      {selectedCustomer.totalSpent.toLocaleString('vi-VN')}₫
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition">
                  Gửi email
                </button>
                <button className="flex-1 py-3 border border-slate-900 text-slate-900 rounded-lg font-semibold hover:bg-slate-50 transition">
                  Gọi điện
                </button>
                <button className="flex-1 py-3 border border-slate-900 text-slate-900 rounded-lg font-semibold hover:bg-slate-50 transition">
                  Xem lịch sử
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerManagement;
