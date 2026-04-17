import React from 'react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "Đang tải dữ liệu...",
  subMessage = "Vui lòng chờ trong giây lát"
}) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-zinc-950">
      <div className="flex flex-col items-center">
        <div className="relative mb-8 w-40 h-40">
          {/* Animated Background Rings */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-[ping_3s_linear_infinite]" />
          <div className="absolute inset-0 rounded-full border-4 border-primary/10 animate-[pulse_2s_ease-in-out_infinite]" />

          {/* Puppy Container */}
          <div className="absolute inset-2 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center overflow-hidden shadow-2xl border-4 border-white dark:border-zinc-800">
            {/* The Puppy Image */}
            <img
              src="/assets/loading-dog.png"
              alt="Loading..."
              className="w-[120%] h-[120%] object-contain animate-bounce"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://png.pngtree.com/png-clipart/20231018/original/pngtree-lotus-flower-element-in-3d-style-png-image_13342730.png'; // Fallback to a generic cute puppy icon
              }}
            />
          </div>

          {/* Rotating Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary/30 animate-spin" />
        </div>

        <div className="space-y-3 text-center">
          <h3 className="text-2xl font-display font-black text-slate-800 dark:text-zinc-100 italic tracking-tight animate-pulse">
            {message}
          </h3>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">
            {subMessage}
          </p>

          {/* Loading bar */}
          <div className="w-48 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full mt-6 overflow-hidden mx-auto">
            <div className="h-full bg-primary animate-[shimmer_2s_infinite] w-1/3 rounded-full" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
