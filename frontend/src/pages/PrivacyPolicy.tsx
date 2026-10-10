import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import TopNavBar from '../components/TopNavBar';
import SocialSidebar from '../components/SocialSidebar';
import AuthModals from '../components/AuthModals';

export default function PrivacyPolicy() {
  const user = useAuthStore((state: any) => state.user);
  const { isDesktopSidebarOpen } = useSocialStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex h-dvh bg-bg text-text-main overflow-hidden relative w-full max-w-full">
      <AuthModals isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <TopNavBar onLoginClick={() => setShowAuthModal(true)} />
      
      <div className="flex w-full max-w-full pt-16 h-full overflow-hidden">
        {user && <SocialSidebar />}
        <main className={`flex-1 min-w-0 overflow-y-auto p-3 sm:p-6 scroll-smooth custom-scrollbar w-full max-w-full transition-all ${user && !isDesktopSidebarOpen ? 'lg:pl-20' : ''}`}>
          <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-20 w-full min-w-0">
            <button onClick={() => navigate(-1)} className="self-start text-sm text-text-muted hover:text-primary transition-colors flex items-center gap-1">
               ← Retour
            </button>
            <div className="bg-surface rounded-2xl p-5 sm:p-8 border border-border shadow-lg mt-2">
              <h1 className="text-2xl font-bold font-rounded text-primary mb-6">Politique de confidentialité</h1>
              
              <div className="space-y-4 text-sm leading-relaxed text-text-main">
                <p>Votre vie privée est importante pour nous. Cette politique de confidentialité explique comment nous recueillons, utilisons et protégeons vos informations personnelles.</p>
                
                <h2 className="text-lg font-semibold mt-4 text-primary">1. Collecte des données</h2>
                <p>Nous collectons les informations que vous nous fournissez directement, telles que votre nom d'utilisateur, votre adresse email et les messages que vous échangez sur la plateforme.</p>
                
                <h2 className="text-lg font-semibold mt-4 text-primary">2. Utilisation des données</h2>
                <p>Vos données sont utilisées pour vous fournir nos services, personnaliser votre expérience, assurer la sécurité de votre compte et communiquer avec vous.</p>
                
                <h2 className="text-lg font-semibold mt-4 text-primary">3. Protection et sécurité</h2>
                <p>Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos informations contre l'accès, l'altération, la divulgation ou la destruction non autorisée.</p>
                
                <h2 className="text-lg font-semibold mt-4 text-primary">4. Partage des données</h2>
                <p>Nous ne vendons ni ne louons vos données personnelles à des tiers. Vos informations peuvent être partagées uniquement si la loi l'exige ou pour protéger nos droits.</p>

                <h2 className="text-lg font-semibold mt-4 text-primary">5. Vos droits</h2>
                <p>Vous avez le droit d'accéder, de rectifier ou de supprimer vos données personnelles. Vous pouvez gérer ces informations directement depuis les paramètres de votre profil.</p>

                <h2 className="text-lg font-semibold mt-4 text-primary">6. Contact</h2>
                <p>Pour toute question concernant cette politique de confidentialité, veuillez nous contacter via le support à l'adresse suivante : <a href="mailto:ft_transcendence@42perpignan.project.fr" className="text-primary hover:underline">ft_transcendence@42perpignan.project.fr</a>.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
