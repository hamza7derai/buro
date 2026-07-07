import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Box, ChevronRight, MessageCircle, School } from 'lucide-react';
import { usePacks } from '../../hooks/usePacks';
import { useSchools } from '../../hooks/useSchools';
import { SkeletonRow, FadeIn } from '../../components/SkeletonCard';
import PageTransition from '../../components/PageTransition';
import { formatPrice } from '../../lib/pricing';
import { buildWhatsAppLink } from '../../lib/contact';
import { schoolInitials, schoolAvatarColor } from '../../lib/schoolAvatar';
import CachedImage from '../../components/CachedImage';

function LevelCard({ pack }) {
  return (
    <Link
      to={`/packs/${pack.slug || pack.id}`}
      className="shrink-0 w-[160px] lg:w-auto bg-white rounded-xl shadow-sm p-4 flex flex-col gap-1.5 hover:shadow-md transition-shadow"
    >
      {pack.level && (
        <span className="self-start text-[10px] font-semibold text-blue bg-blue-light rounded-full px-2 py-0.5">{pack.level}</span>
      )}
      <span className="text-[14px] font-bold text-txt-1">{pack.grade || pack.level}</span>
      <span className="flex items-center gap-1 text-[11px] text-txt-3">
        <Box size={12} className="shrink-0" /> {pack.itemsCount || 0} article{pack.itemsCount !== 1 ? 's' : ''}
      </span>
      <span className="font-mono font-bold text-navy text-[15px] mt-1">{formatPrice(pack.packPrice)}</span>
    </Link>
  );
}

export default function SchoolPacks() {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const { schools, loading: schoolsLoading } = useSchools();
  const { packs, loading: packsLoading } = usePacks();

  const loading = schoolsLoading || packsLoading;
  const school = schools.find(s => s.id === schoolId);
  const schoolPacks = packs.filter(p => p.schoolId === schoolId && p.status !== 'draft');
  const whatsappHref = buildWhatsAppLink(`Bonjour, je ne trouve pas de liste pour l'école ${school?.name || ''}, pouvez-vous m'aider?`);

  if (loading) {
    return (
      <PageTransition className="flex flex-col gap-5 px-4 lg:px-0 py-4">
        <SkeletonRow />
      </PageTransition>
    );
  }

  if (!school) {
    return (
      <PageTransition className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <School size={40} className="text-txt-3" />
        <h1 className="text-lg font-bold text-txt-1">École introuvable</h1>
        <Link to="/packs" className="mt-2 bg-blue text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
          Retour aux écoles
        </Link>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="flex flex-col gap-6 px-4 lg:px-0 py-4">
      <button
        type="button"
        onClick={() => navigate('/packs')}
        className="flex items-center gap-1.5 text-[12px] font-medium text-txt-2 hover:text-txt-1 self-start"
      >
        <ArrowLeft size={14} /> Retour aux écoles
      </button>

      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl shrink-0 overflow-hidden flex items-center justify-center text-white font-bold text-[16px]"
          style={{ backgroundColor: schoolAvatarColor(school.name) }}
        >
          {school.image || school.logo ? (
            <CachedImage src={school.image || school.logo} alt={school.name} className="w-full h-full object-cover" />
          ) : (
            schoolInitials(school.name)
          )}
        </div>
        <div>
          <h1 className="text-lg font-bold text-txt-1">{school.name}</h1>
          {school.district && <p className="text-[12px] text-txt-3 mt-0.5">{school.district}</p>}
        </div>
      </div>

      {schoolPacks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 bg-surface-1 border border-bord rounded-2xl px-4 py-10 text-center">
          <p className="text-[13px] text-txt-2">Aucune liste disponible pour cette école pour le moment.</p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#25D366] rounded-full px-4 py-2"
          >
            <MessageCircle size={14} /> Contactez-nous sur WhatsApp
          </a>
        </div>
      ) : (
        <div>
          <h2 className="text-[14px] font-bold text-txt-1 mb-3 flex items-center gap-1">
            Choisissez le niveau <ChevronRight size={15} className="text-txt-3" />
          </h2>
          <FadeIn className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible">
            {schoolPacks.map(pack => <LevelCard key={pack.id} pack={pack} />)}
          </FadeIn>
        </div>
      )}
    </PageTransition>
  );
}
