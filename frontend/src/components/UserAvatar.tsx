import { useState, useEffect } from 'react';

interface UserAvatarProps {
  avatarUrl?: string | null;
  username?: string;
  className?: string; // Permet de passer la taille (ex: "w-7 h-7" ou "w-10 h-10")
  onClick?: () => void;
}

export default function UserAvatar({
  avatarUrl,
  username = 'Utilisateur',
  className = 'w-10 h-10', // Taille par défaut si non précisée
  onClick
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Si l'URL de l'avatar change, on réinitialise l'erreur
  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  const initial = username.charAt(0).toUpperCase();
  
  // Classes de base (arrondi, comportement au clic, fusion avec la taille passée)
  const baseClasses = `rounded-full shrink-0 ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''} ${className}`;

  // S'il n'y a pas d'image ou si elle est cassée -> Affichage de la lettre
  if (!avatarUrl || hasError) {
    return (
      <div
        onClick={onClick}
        className={`${baseClasses} bg-border border border-border-subtle flex items-center justify-center text-text-main font-bold`}
      >
        {initial}
      </div>
    );
  }

  // Sinon -> Affichage de l'image
  return (
    <img
      src={avatarUrl}
      alt={`Avatar de ${username}`}
      onError={() => setHasError(true)}
      onClick={onClick}
      className={`${baseClasses} object-cover`}
    />
  );
}