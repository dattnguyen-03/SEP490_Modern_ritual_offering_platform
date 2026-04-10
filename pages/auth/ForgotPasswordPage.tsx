import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../../services/auth';
import logoImage from '../../assets/logo.png';

interface ForgotPasswordPageProps {
  onNavigate: (path: string) => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if URL has email and token parameters
  useEffect(() => {
    const emailParam = searchParams.get('email');
    let tokenParam = searchParams.get('token');
    
    // Fix: Replace spaces with + (URL encoding issue)
    // When + is in URL query params, it gets decoded as space
    if (tokenParam) {
      tokenParam = tokenParam.replace(/ /g, '+');
    }
    
    console.log('🔍 URL Parameters:', { emailParam, tokenParam });
    
    if (emailParam && tokenParam) {
      console.log('✅ Auto-filling email and token from URL');
      setEmail(emailParam);
      setToken(tokenParam);
      setStep('reset');
    }
  }, [searchParams]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await forgotPassword(email);
      setSuccess(response.message);
      setTimeout(() => {
        setStep('reset');
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);

    try {
      const response = await resetPassword({
        email,
        token,
        newPassword,
      });
      setSuccess(response.message);
      setTimeout(() => {
        onNavigate('/auth');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="relative max-w-md w-full">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 to-gray-700/20 rounded-full blur-2xl animate-pulse"></div>
            <div className="relative w-[106px] h-[106px] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 rounded-full flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.4)] transition-all duration-500 group overflow-hidden mx-auto">
              <img
                src={logoImage}
                alt="Modern Ritual Logo"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 rounded-full border-2 border-white/20"></div>
            </div>
          </div>
          <h1 className="text-3xl font-playfair font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent mb-2">Modern Ritual Offering</h1>
          <p className="text-gray-600">
            {step === 'request' ? 'Khôi phục mật khẩu' : 'Đặt lại mật khẩu'}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              <p className="font-medium">⚠️ {error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg">
              <p className="font-medium">✅ {success}</p>
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequestReset} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Quên mật khẩu?</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Nhập email của bạn và chúng tôi sẽ gửi mã xác thực để đặt lại mật khẩu.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 focus:outline-none bg-white transition-all shadow-sm hover:shadow-md hover:border-gray-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 hover:from-black hover:via-gray-900 hover:to-black text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? 'Đang gửi...' : 'Gửi mã xác thực'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('reset')}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Đã có mã xác thực? <span className="underline">Nhập mã ngay</span>
                </button>
              </div>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Đặt lại mật khẩu</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Nhập mã xác thực từ email và mật khẩu mới của bạn.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 focus:outline-none bg-white transition-all shadow-sm hover:shadow-md hover:border-gray-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Mã xác thực</label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Nhập mã từ email"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 focus:outline-none bg-white transition-all shadow-sm hover:shadow-md hover:border-gray-400 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 focus:outline-none bg-white transition-all shadow-sm hover:shadow-md hover:border-gray-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 focus:outline-none bg-white transition-all shadow-sm hover:shadow-md hover:border-gray-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 hover:from-black hover:via-gray-900 hover:to-black text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  <span className="underline">Gửi lại mã xác thực</span>
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <button
              onClick={() => onNavigate('/auth')}
              className="text-gray-600 hover:text-gray-900 font-medium text-sm"
            >
              ← Quay lại đăng nhập
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© 2025 Modern Ritual. Thành tâm – Tin trực</p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="#" className="hover:text-gray-700">Bảo mật</a>
            <span>•</span>
            <a href="#" className="hover:text-gray-700">Mã hóa SSL</a>
            <span>•</span>
            <a href="#" className="hover:text-gray-700">Riêng tư</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
