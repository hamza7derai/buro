import { Package } from 'lucide-react';

export default function Thumb({ src, className = 'w-9 h-9' }) {
  return (
    <div className={`${className} rounded-md flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 bg-[#f0f0f0]`}>
      {src ? (
        <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <Package size={14} className="text-gray-400" />
      )}
    </div>
  );
}
