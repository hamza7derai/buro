import { Link } from 'react-router-dom';

export default function ComingSoon({ icon: Icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      {Icon && <Icon size={40} className="text-txt-3" />}
      <h1 className="text-lg font-bold text-txt-1">{title}</h1>
      <p className="text-[13px] text-txt-2 max-w-xs">{message}</p>
      <Link to="/store" className="mt-2 bg-blue text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
        Retour à l'accueil
      </Link>
    </div>
  );
}
