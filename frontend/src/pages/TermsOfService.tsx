import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/socialStore';
import TopNavBar from '../components/TopNavBar';
import SocialSidebar from '../components/SocialSidebar';
import AuthModals from '../components/AuthModals';

export default function TermsOfService() {
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
              <h1 className="text-2xl font-bold font-rounded text-primary mb-6">Conditions d'utilisation</h1>
              
              <div className="space-y-4 text-sm leading-relaxed text-text-main">
                <p>Bienvenue sur notre plateforme. En utilisant nos services, vous acceptez les présentes conditions d'utilisation.</p>
                
                <h2 className="text-lg font-semibold mt-4 text-primary">1. Acceptation des conditions</h2>
                <p>L'accès et l'utilisation de la plateforme sont soumis à l'acceptation de ces conditions. Si vous ne les acceptez pas, veuillez ne pas utiliser nos services.</p>
                
                <h2 className="text-lg font-semibold mt-4 text-primary">2. Utilisation du service</h2>
                <p>Vous vous engagez à utiliser le service conformément aux lois en vigueur, à ne pas publier de contenu offensant, illégal ou portant atteinte aux droits d'autrui.</p>
                
                <h2 className="text-lg font-semibold mt-4 text-primary">3. Compte utilisateur</h2>
                <p>Vous êtes responsable de la confidentialité de vos identifiants et de toutes les activités effectuées sous votre compte. Vous vous engagez à nous informer immédiatement de toute utilisation non autorisée de votre compte.</p>
                
                <h2 className="text-lg font-semibold mt-4 text-primary">4. Modification des conditions</h2>
                <p>Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications prendront effet dès leur publication sur cette page. Il est de votre responsabilité de les consulter régulièrement.</p>

                <h2 className="text-lg font-semibold mt-4 text-primary">5. Contact</h2>
                <p>Pour toute question concernant ces conditions, veuillez nous contacter via le support à l'adresse suivante : <a href="mailto:ft_transcendence@42perpignan.project.fr" className="text-primary hover:underline">ft_transcendence@42perpignan.project.fr</a>.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
