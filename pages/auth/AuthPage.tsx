import React, { useEffect, useState } from 'react';
import { UserRole } from '../../types';
import { login, register, LoginRequest, RegisterRequest } from '../../services/auth';
import toast from '../../services/toast';
import logoImage from '../../assets/logo.png';

interface AuthPageProps {
  onNavigate: (path: string) => void;
  onLogin?: (role: UserRole, firstTimeLogin?: boolean) => void;
}

const PROFILE_SETUP_REQUIRED_KEY = 'modern-ritual-profile-setup-required';
const REMEMBER_LOGIN_KEY = 'modern-ritual-remember-login';

interface AuthFormData {
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  userType: UserRole;
  agreeTerms: boolean;
}

const createInitialFormData = (): AuthFormData => ({
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  userType: 'customer',
  agreeTerms: false,
});

const AuthPage: React.FC<AuthPageProps> = ({ onNavigate, onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AuthFormData>(createInitialFormData());
  const [rememberLogin, setRememberLogin] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  useEffect(() => {
    try {
      const rememberedRaw = localStorage.getItem(REMEMBER_LOGIN_KEY);
      if (!rememberedRaw) return;

      // We only remember the email. Never persist passwords to localStorage.
      // (Migrate older data that might include a password.)
      const remembered = JSON.parse(rememberedRaw) as { email?: string; password?: string };
      const email = String(remembered.email || '').trim();
      if (!email) return;

      if (remembered.password) {
        localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({ email }));
      }

      setRememberLogin(true);
      setFormData((prev) => ({
        ...prev,
        email,
        password: '',
      }));
    } catch (e) {
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
    }
  }, []);

  const switchToRegister = () => {
    setIsLogin(false);
    setError(null);
    setFormData(createInitialFormData());
    setShowRegisterPassword(false);
    setShowRegisterConfirmPassword(false);
  };

  const switchToLogin = () => {
    setIsLogin(true);
    setError(null);
    setShowLoginPassword(false);

    const next = createInitialFormData();
    if (rememberLogin) {
      try {
        const rememberedRaw = localStorage.getItem(REMEMBER_LOGIN_KEY);
        const remembered = rememberedRaw ? JSON.parse(rememberedRaw) as { email?: string } : null;
        if (remembered?.email) {
          next.email = String(remembered.email);
          next.password = '';
        }
      } catch {
        // Ignore parse errors and fall back to blank login form.
      }
    }

    setFormData(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    // Clear error when user starts typing
    if (error) setError(null);
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const demoAccounts = [
    {
      role: 'customer' as UserRole,
      email: 'khachhang@demo.com',
      password: '123456',
      name: 'Khách Hàng Demo',
      label: 'Khách Hàng',
      description: 'Mua sắm mâm cúng chất lượng'
    },
    {
      role: 'vendor' as UserRole,
      email: 'nhacungcap@demo.com',
      password: '123456',
      name: 'Nhà Cung Cấp Demo',
      label: 'Nhà Cung Cấp',
      description: 'Bán mâm cúng trên nền tảng'
    },
    {
      role: 'staff' as UserRole,
      email: 'nhanvien@demo.com',
      password: '123456',
      name: 'Nhân Viên Demo',
      label: 'Nhân Viên',
      description: 'Hỗ trợ và quản lý đơn hàng'
    },
    {
      role: 'admin' as UserRole,
      email: 'admin@demo.com',
      password: '123456',
      name: 'Admin Demo',
      label: 'Quản Trị Viên',
      description: 'Quản lý hệ thống nền tảng'
    }
  ];

  const handleDemoLogin = (account: typeof demoAccounts[0]) => {
    setFormData(prev => ({
      ...prev,
      email: account.email,
      password: account.password,
      userType: account.role
    }));
    if (onLogin) {
      onLogin(account.role);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      // Handle login
      try {
        setError(null);
        const credentials: LoginRequest = {
          usernameOrEmail: formData.email,
          password: formData.password,
        };

        console.log(' Logging in with:', credentials);
        const response = await login(credentials);
        console.log(' Login successful:', response);

        // Prepare user data to save
        const userData = {
          id: response.userId,
          name: response.name,
          email: response.email,
          role: response.role,
          roles: response.roles
        };

        // Lưu token và user info vào localStorage
        localStorage.setItem('smart-child-token', response.token);
        localStorage.setItem('smart-child-refresh-token', response.refreshToken);
        localStorage.setItem('smart-child-user', JSON.stringify(userData));

        console.log(' Saved to localStorage:', {
          token: response.token.substring(0, 20) + '...',
          refreshToken: response.refreshToken.substring(0, 20) + '...',
          user: userData
        });

        const normalizedRole = String(response.role || '').toLowerCase();

        if (rememberLogin) {
          localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({
            email: formData.email,
          }));
        } else {
          localStorage.removeItem(REMEMBER_LOGIN_KEY);
        }

        // First-time profile setup only applies to customers.
        if (normalizedRole === 'customer') {
          try {
            console.log(' Checking if customer profile is complete...');
            const { getProfile } = await import('../../services/auth');
            const profile = await getProfile();

            const hasFullName = !!profile.fullName?.trim();
            const hasPhoneNumber = !!profile.phoneNumber?.trim();
            const hasDateOfBirth = !!profile.dateOfBirth;

            let hasAddress = !!profile.addressText?.trim();

            // Address can be stored in /api/addresses instead of profile.addressText.
            if (!hasAddress) {
              try {
                const token = localStorage.getItem('smart-child-token');
                if (token) {
                  const addressResponse = await fetch('/api/addresses', {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      Accept: 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                  });

                  if (addressResponse.ok) {
                    const addressData = await addressResponse.json().catch(() => null);
                    const addressList = Array.isArray(addressData)
                      ? addressData
                      : (addressData?.isSuccess && Array.isArray(addressData.result) ? addressData.result : []);

                    hasAddress = addressList.some((addr: any) =>
                      !!(addr?.addressText || addr?.fullAddress || '').trim()
                    );
                  }
                }
              } catch (addressError) {
                console.warn(' Could not check address list:', addressError);
              }
            }

            const isProfileIncomplete = !(hasFullName && hasPhoneNumber && hasDateOfBirth && hasAddress);

            console.log(' Profile status:', {
              fullName: profile.fullName,
              phoneNumber: profile.phoneNumber,
              dateOfBirth: profile.dateOfBirth,
              addressText: profile.addressText,
              hasAddress,
              isIncomplete: isProfileIncomplete
            });

            if (isProfileIncomplete) {
              // First-time login - redirect to profile page
              console.log(' Customer profile incomplete - redirecting to profile setup');
              localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, 'true');
              toast.message({
                title: 'Chào mừng bạn đến với Modern Ritual Offering !',
                text: 'Để tiếp tục, vui lòng hoàn thành thông tin cá nhân của bạn.',
                icon: 'info',
                confirmButtonText: 'Hoàn thành hồ sơ'
              });

              if (onLogin) {
                onLogin(response.role as UserRole, true); // Pass true for first-time login
              }
              return;
            }

            localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, 'false');
          } catch (profileError) {
            console.error(' Could not check profile completeness:', profileError);
            // Continue with normal login flow if profile check fails
          }
        } else {
          localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, 'false');
        }

        // Thông báo thành công
        toast.success('Đăng nhập thành công!');

        if (onLogin) {
          onLogin(response.role as UserRole);
        }
      } catch (error) {
        console.error(' Login failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
        setError(errorMessage);
      }
    } else {
      // Handle registration
      if (formData.password !== formData.confirmPassword) {
        setError('Mật khẩu không khớp');
        return;
      }
      if (!formData.agreeTerms) {
        setError('Vui lòng đồng ý với điều khoản sử dụng');
        return;
      }

      try {
        setError(null);
        const derivedUsername = formData.email.split('@')[0]?.trim() || formData.email.trim();
        const registerData: RegisterRequest = {
          username: derivedUsername,
          email: formData.email,
          password: formData.password,
        };

        console.log(' Registering:', registerData);
        const response = await register(registerData);
        console.log(' Registration successful:', response);

        // Show success message with better instructions
        toast.message({
          title: ' Đăng ký thành công!',
          html: `
            <div style="text-align: left;">
              <p style="margin-bottom: 12px;"> Chúng tôi đã gửi email xác nhận đến:</p>
              <p style="font-weight: bold; margin-bottom: 12px;">${formData.email}</p>
              <p style="margin-bottom: 12px;">Vui lòng kiểm tra hộp thư (và cả thư mục Spam) để xác nhận tài khoản.</p>
              <p style="color: #64748b;">⏱ Link xác nhận sẽ hết hạn sau 24 giờ.</p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Đã hiểu'
        });

        // Chuyển về form đăng nhập
        switchToLogin();
      } catch (error) {
        console.error('Registration failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
        setError(errorMessage);
      }
    }
  };

  // Registration form
  if (!isLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 dark:from-[#09090b] dark:via-[#111113] dark:to-[#09090b] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-gradient-to-br from-gray-900/5 via-gray-700/5 to-gray-500/5 dark:from-white/5 dark:to-white/0 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-gradient-to-br from-black/5 via-gray-800/5 to-gray-600/5 dark:from-white/5 dark:to-white/0 rounded-full blur-3xl animate-float-delayed"></div>
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-gradient-to-br from-gray-400/5 to-gray-600/5 dark:from-white/5 dark:to-white/0 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-gradient-to-br from-slate-900/5 to-zinc-900/5 dark:from-white/5 dark:to-white/0 rounded-full blur-3xl animate-float-delayed" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-gradient-to-br from-gray-200/10 to-gray-400/10 dark:from-white/5 dark:to-white/0 rounded-full blur-3xl animate-pulse"></div>
        </div>

        <div className="max-w-xl w-full relative z-10 animate-fade-in">
          <div className="bg-white/80 dark:bg-[#18181b]/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] p-10 border border-gray-200/60 dark:border-white/10 hover:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.4)] transition-all duration-500">
            {/* Header */}
            <div className="text-center mb-8 animate-scale-in">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 via-gray-700/20 to-gray-500/20 dark:from-white/20 dark:to-transparent rounded-full blur-2xl animate-pulse"></div>
                <div className="relative w-[106px] h-[106px] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 dark:from-zinc-800 dark:to-zinc-900 rounded-full flex items-center justify-center mx-auto shadow-[0_10px_40px_-10px_rgba(0,0,0,0.4)] hover:shadow-[0_15px_50px_-10px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-110 group overflow-hidden">
                  <img
                    src={logoImage}
                    alt="Modern Ritual Logo"
                    className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 rounded-full border-2 border-white/20 group-hover:border-white/40 transition-colors duration-300"></div>
                </div>
              </div>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-playfair font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-zinc-200 dark:to-white bg-clip-text text-transparent mb-2">Modern Ritual Offering</h1>
                <p className="text-sm text-gray-600 dark:text-zinc-400 font-semibold tracking-wide">Nền tảng mâm cúng hiện đại</p>
              </div>
              <h2 className="text-3xl font-playfair font-bold text-gray-900 dark:text-white mb-2">
                Tạo tài khoản mới
              </h2>
              <p className="text-gray-600 dark:text-zinc-400 text-sm max-w-md mx-auto">
                Đăng ký để trải nghiệm nền tảng mâm cúng hiện đại
              </p>
            </div>


            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3 animate-shake">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800">Đăng ký thất bại</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  <span>Email</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="example@email.com"
                  required
                  autoComplete="email"
                  className="w-full px-5 py-4 border-2 border-gray-200 dark:border-white/10 rounded-xl focus:border-gray-900 dark:focus:border-white focus:ring-4 focus:ring-gray-100 dark:focus:ring-white/5 focus:outline-none bg-white dark:bg-[#27272a] dark:text-white transition-all shadow-sm hover:shadow-md"
                />
              </div>

              {/* <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <span>Số điện thoại</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="0901 234 567"
                  required
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:ring-4 focus:ring-gray-100 focus:outline-none bg-white transition-all shadow-sm hover:shadow-md"
                />
              </div> */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                    <span>Mật khẩu</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegisterPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="w-full px-5 py-4 pr-12 border-2 border-gray-200 dark:border-white/10 rounded-xl focus:border-gray-900 dark:focus:border-white focus:ring-4 focus:ring-gray-100 dark:focus:ring-white/5 focus:outline-none bg-white dark:bg-[#27272a] dark:text-white transition-all shadow-sm hover:shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-800"
                      aria-label={showRegisterPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showRegisterPassword ? (
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.73-1.73 1.79-3.23 3.08-4.4" />
                          <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                          <path d="M9.88 5.09A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a10.95 10.95 0 0 1-1.64 2.71" />
                          <path d="M1 1l22 22" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                    <span>Xác nhận</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegisterConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="w-full px-5 py-4 pr-12 border-2 border-gray-200 dark:border-white/10 rounded-xl focus:border-gray-900 dark:focus:border-white focus:ring-4 focus:ring-gray-100 dark:focus:ring-white/5 focus:outline-none bg-white dark:bg-[#27272a] dark:text-white transition-all shadow-sm hover:shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-800"
                      aria-label={showRegisterConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                    >
                      {showRegisterConfirmPassword ? (
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.73-1.73 1.79-3.23 3.08-4.4" />
                          <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                          <path d="M9.88 5.09A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a10.95 10.95 0 0 1-1.64 2.71" />
                          <path d="M1 1l22 22" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Yêu cầu mật khẩu:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    <span>Tối thiểu 6 ký tự</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    <span>Ít nhất 1 chữ cái viết HOA (A-Z)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    <span>Ít nhất 1 chữ cái viết thường (a-z)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    <span>Ít nhất 1 ký tự đặc biệt (!@#$%^&*)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    <span>Ít nhất 1 chữ số (0-9)</span>
                  </li>
                </ul>
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-600">Ví dụ:</span> <span className="font-mono bg-white px-2 py-1 rounded border border-gray-300">Modern@123</span>
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-300 border-2 border-transparent hover:border-gray-300 dark:hover:border-white/20 hover:shadow-sm group">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleInputChange}
                  required
                  className="w-5 h-5 text-gray-900 dark:text-white rounded-md mt-0.5 cursor-pointer accent-gray-900 dark:accent-white"
                />
                <span className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
                  Tôi đồng ý với <a href="#" className="text-gray-900 dark:text-white font-semibold hover:underline decoration-2">điều khoản sử dụng</a> và <a href="#" className="text-gray-900 dark:text-white font-semibold hover:underline decoration-2">chính sách bảo mật</a> của Modern Ritual Offering
                </span>
              </label>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 hover:from-black hover:via-gray-900 hover:to-black text-white font-bold py-5 rounded-xl transition-all duration-300 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)] hover:shadow-[0_15px_40px_-5px_rgba(0,0,0,0.4)] transform hover:-translate-y-1 hover:scale-[1.02] mt-6 text-lg relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <span>Tạo tài khoản</span>
                  <span className="group-hover:translate-x-2 transition-transform duration-300">→</span>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </button>
            </form>

            {/* Trust Indicators */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center gap-6 text-xs">
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="font-semibold">Bảo mật cao</span>
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="font-semibold">SSL 256-bit</span>
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="font-semibold">Riêng tư 100%</span>
                </div>
              </div>
            </div>

            {/* Back to login */}
            <div className="text-center mt-6">
              <button
                onClick={() => { setIsLogin(true); setError(null); }}
                className="text-gray-600 hover:text-gray-900 font-semibold transition-colors text-sm"
              >
                ← Đã có tài khoản? Đăng nhập
              </button>
            </div>
          </div>

          <p className="text-center text-gray-700 text-sm mt-8 font-medium">
            © 2026 Modern Ritual Offering. Thành tâm - Tín trực.
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
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
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
        `}</style>
      </div>
    );
  }

  // Login view
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 dark:from-[#09090b] dark:via-[#111113] dark:to-[#09090b] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
      {/* Animated background for login */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-gray-900/5 to-gray-700/5 dark:from-white/5 dark:to-transparent rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -right-40 w-[32rem] h-[32rem] bg-gradient-to-br from-black/5 to-gray-800/5 dark:from-white/5 dark:to-transparent rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-gradient-to-br from-gray-400/5 to-gray-600/5 dark:from-white/5 dark:to-transparent rounded-full blur-3xl animate-pulse"></div>
      </div>
      <div className="max-w-2xl w-full relative z-10 animate-fade-in">
        <div className="bg-white/80 dark:bg-[#18181b]/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] p-8 border border-gray-200/60 dark:border-white/10 hover:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.4)] transition-all duration-500">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 to-gray-700/20 dark:from-white/20 dark:to-transparent rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-[106px] h-[106px] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 dark:from-zinc-800 dark:to-zinc-900 rounded-full flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.4)] hover:shadow-[0_15px_50px_-10px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-110 group cursor-pointer overflow-hidden">
                <img
                  src={logoImage}
                  alt="Modern Ritual Logo"
                  className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 rounded-full border-2 border-white/20 group-hover:border-white/40 transition-colors duration-300"></div>
              </div>
            </div>
            <h1 className="text-3xl font-playfair font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-zinc-200 dark:to-white bg-clip-text text-transparent mb-2">Modern Ritual Offering</h1>
            <p className="text-sm text-gray-600 dark:text-zinc-400 font-semibold tracking-wide">Nền tảng mâm cúng hiện đại</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8 bg-gray-100/80 dark:bg-white/5 backdrop-blur-sm p-1.5 rounded-xl shadow-inner">
            <button
              onClick={switchToLogin}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${isLogin
                ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-lg scale-105'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                }`}
            >
              Đăng Nhập
            </button>
            <button
              onClick={switchToRegister}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${!isLogin
                ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-lg scale-105'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                }`}
            >
              Đăng Ký
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">Đăng nhập thất bại</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="example@email.com"
                required
                autoComplete="username"
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-white/10 rounded-lg focus:border-gray-900 dark:focus:border-white focus:ring-4 focus:ring-gray-900/10 dark:focus:ring-white/5 focus:outline-none bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-white/20 hover:bg-white dark:hover:bg-zinc-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-200 dark:border-white/10 rounded-lg focus:border-gray-900 dark:focus:border-white focus:ring-4 focus:ring-gray-900/10 dark:focus:ring-white/5 focus:outline-none bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-white/20 hover:bg-white dark:hover:bg-zinc-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-800"
                  aria-label={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showLoginPassword ? (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.73-1.73 1.79-3.23 3.08-4.4" />
                      <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a10.95 10.95 0 0 1-1.64 2.71" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRememberLogin(checked);
                    if (!checked) {
                      localStorage.removeItem(REMEMBER_LOGIN_KEY);
                    }
                  }}
                  className="w-4 h-4 text-gray-900 rounded"
                />
                <span className="text-gray-600">Ghi nhớ đăng nhập</span>
              </label>
              <button
                type="button"
                onClick={() => onNavigate('/forgot-password')}
                className="text-gray-900 font-semibold hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 hover:from-black hover:via-gray-900 hover:to-black text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)] hover:shadow-[0_15px_40px_-5px_rgba(0,0,0,0.4)] transform hover:-translate-y-1 hover:scale-[1.02] mt-6 relative overflow-hidden group"
            >
              <span className="relative z-10">Đăng Nhập</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="w-full mt-3 border-2 border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:border-gray-900 hover:text-gray-900 hover:bg-white transition-all duration-300"
            >
              ← Quay lại trang chủ
            </button>
          </form>

          {/* Social Login */}
          {/* <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">hoặc</span>
                </div>
              </div> */}

          {/* <button
                type="button"
                className="w-full flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-900 font-semibold py-3 rounded-xl hover:border-gray-900 hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md group"
              >
                <span className="group-hover:scale-110 transition-transform duration-300"></span>
                <span>Đăng nhập với Google</span>
              </button> */}

          {/* Trust Indicators */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <span>Bảo mật</span>
            </div>
            <div className="text-gray-300">•</div>
            <div className="flex items-center gap-1">
              <span>Mã hóa SSL</span>
            </div>
            <div className="text-gray-300">•</div>
            <div className="flex items-center gap-1">
              <span>Riêng tư</span>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-700 dark:text-zinc-500 text-sm mt-6">
          © 2026 Modern Ritual Offering . Thành tâm - Tín trực.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
