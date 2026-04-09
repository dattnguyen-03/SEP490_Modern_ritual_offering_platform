import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmEmail } from '../../services/auth';
import logoImage from '../../assets/logo.png';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const [manualEmail, setManualEmail] = useState<string>('');
  const [manualToken, setManualToken] = useState<string>('');
  const hasVerified = React.useRef(false); // Prevent double verification in React Strict Mode

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail || !manualToken) {
      setStatus('error');
      setMessage('Vui lòng nhập đầy đủ email và mã xác nhận');
      return;
    }

    console.log('🔄 Manual verify - Email:', manualEmail);
    console.log('🔄 Manual verify - Token:', manualToken.substring(0, 30) + '...');
    console.log('📏 Manual token length:', manualToken.length);

    try {
      setStatus('loading');
      setShowManualForm(false); // Ẩn form khi đang verify
      const response = await confirmEmail({ email: manualEmail, token: manualToken });
      console.log('✅ Email verified manually:', response);
      
      setStatus('success');
      setMessage(response.message || 'Xác nhận email thành công! Bạn có thể đăng nhập ngay bây giờ.');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 3000);
    } catch (error) {
      console.error('❌ Manual email verification failed:', error);
      setStatus('error');
      setShowManualForm(true); // Hiển thị lại form để user có thể sửa
      setMessage(
        error instanceof Error 
          ? error.message 
          : 'Không thể xác nhận email. Vui lòng kiểm tra lại thông tin.'
      );
    }
  };

  useEffect(() => {
    const verifyEmail = async () => {
      // Prevent double verification in React Strict Mode (development)
      if (hasVerified.current) {
        console.log('⏭️ Skipping verification - already verified');
        return;
      }

      const email = searchParams.get('email');
      const tokenRaw = searchParams.get('token');

      console.log('Email from URL:', email);
      console.log('Token from URL (raw):', tokenRaw?.substring(0, 50) + '...');

      if (!email || !tokenRaw) {
        // No URL params, show manual form
        setShowManualForm(true);
        setStatus('error');
        setMessage('Không tìm thấy thông tin xác thực trong link. Vui lòng nhập thủ công bên dưới.');
        return;
      }

      // Mark as verified to prevent double API call
      hasVerified.current = true;

      // Fix: URL decode tự động convert '+' thành space, phải convert lại
      // Token gốc có dấu '+' nhưng bị convert thành space ' '
      const token = tokenRaw.replace(/ /g, '+');
      
      console.log('🔓 Token (fixed +):', token.substring(0, 50) + '...');
      console.log('📏 Token length:', token.length);
      console.log('🔍 Has + sign:', token.includes('+'));
      console.log('🔍 Has space:', token.includes(' '));
      
      // Tự động điền email và token đã fix vào form
      setManualEmail(email);
      setManualToken(token);

      try {
        setStatus('loading');
        const response = await confirmEmail({ email, token });
        console.log('✅ Email verified:', response);
        
        setStatus('success');
        setMessage(response.message || 'Xác nhận email thành công! Bạn có thể đăng nhập ngay bây giờ.');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/auth');
        }, 3000);
      } catch (error) {
        console.error('❌ Email verification failed:', error);
        setStatus('error');
        // Hiển thị form với email và token đã điền sẵn để user có thể thử lại hoặc sửa
        setShowManualForm(true);
        setMessage(
          error instanceof Error 
            ? error.message 
            : 'Không thể xác nhận email. Link có thể đã hết hạn hoặc không hợp lệ.'
        );
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-gradient-to-br from-gray-900/5 via-gray-700/5 to-gray-500/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-gradient-to-br from-black/5 via-gray-800/5 to-gray-600/5 rounded-full blur-3xl animate-float-delayed"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="bg-white/80 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] p-10 border border-gray-200/60">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 via-gray-700/20 to-gray-500/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-[106px] h-[106px] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 rounded-full flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.4)] transition-all duration-500 group overflow-hidden mx-auto">
                <img
                  src={logoImage}
                  alt="Modern Ritual Logo"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 rounded-full border-2 border-white/20"></div>
              </div>
            </div>
            <h1 className="text-3xl font-playfair font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent mb-2">
              Modern Ritual Offering
            </h1>
            <p className="text-sm text-gray-600 font-semibold tracking-wide">
              Nền tảng mâm cúng hiện đại
            </p>
          </div>

          {/* Status Content */}
          <div className="text-center">
            {status === 'loading' && (
              <div className="space-y-4 animate-fade-in">
                <div className="w-16 h-16 mx-auto border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
                <h2 className="text-2xl font-bold text-gray-900">Đang xác nhận email...</h2>
                <p className="text-gray-600">Vui lòng đợi trong giây lát</p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4 animate-scale-in">
                <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Xác nhận thành công!</h2>
                <p className="text-gray-600">{message}</p>
                <div className="pt-4">
                  <button
                    onClick={() => navigate('/auth')}
                    className="px-6 py-3 bg-gradient-to-r from-gray-900 to-gray-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
                  >
                    Đăng nhập ngay
                  </button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4 animate-shake">
                <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Xác nhận thất bại</h2>
                <p className="text-gray-600">{message}</p>
                
                {/* Manual Verification Form */}
                {showManualForm && (
                  <form onSubmit={handleManualVerify} className="mt-6 space-y-4 text-left">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-sm text-blue-800 font-semibold mb-2">💡 Xác nhận thủ công</p>
                      <p className="text-xs text-blue-600">
                        Nhập email và mã xác nhận từ email bạn nhận được để xác thực tài khoản.
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        placeholder="example@email.com"
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:ring-4 focus:ring-gray-900/10 focus:outline-none transition-all duration-300"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Mã xác nhận (Token)
                      </label>
                      <textarea
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="Dán mã xác nhận từ email vào đây..."
                        required
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:ring-4 focus:ring-gray-900/10 focus:outline-none transition-all duration-300 font-mono text-xs"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Mã xác nhận là chuỗi ký tự dài trong email xác thực
                      </p>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full px-6 py-3 bg-gradient-to-r from-gray-900 to-gray-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
                    >
                      Xác nhận
                    </button>
                  </form>
                )}
                
                <div className="pt-4 space-y-2">
                  {!showManualForm && (
                    <button
                      onClick={() => setShowManualForm(true)}
                      className="w-full px-6 py-3 bg-blue-100 text-blue-900 rounded-xl font-semibold hover:bg-blue-200 transition-all duration-300"
                    >
                      Xác nhận thủ công
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/auth')}
                    className="w-full px-6 py-3 bg-gradient-to-r from-gray-900 to-gray-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
                  >
                    Về trang đăng nhập
                  </button>
                  {!showManualForm && (
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full px-6 py-3 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-300"
                    >
                      Thử lại
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-gray-700 text-sm mt-8 font-medium">
          © 2025 Modern Ritual. Thành tâm - Tín trực.
        </p>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(20px, -20px) rotate(3deg); }
          50% { transform: translate(-10px, 10px) rotate(-3deg); }
          75% { transform: translate(-20px, -10px) rotate(2deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-25px, 15px) rotate(-4deg); }
          50% { transform: translate(15px, -15px) rotate(4deg); }
          75% { transform: translate(10px, 20px) rotate(-2deg); }
        }
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-float {
          animation: float 25s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 30s ease-in-out infinite;
        }
        .animate-scale-in {
          animation: scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .animate-fade-in {
          animation: fade-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default VerifyEmailPage;
