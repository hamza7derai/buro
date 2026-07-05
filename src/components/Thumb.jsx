import { Package } from 'lucide-react';
import CachedImage from './CachedImage';

export default function Thumb({ src, className = 'w-9 h-9' }) {
  return (
    <div className={`${className} rounded-md flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 bg-[#f0f0f0]`}>
      {src ? (
        <CachedImage src={src} className="w-full h-full object-cover" />
      ) : (
        <Package size={14} className="text-gray-400" />
      )}
    </div>
  );
}
