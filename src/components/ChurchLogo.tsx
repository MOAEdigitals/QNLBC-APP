import React from 'react';

interface ChurchLogoProps {
  className?: string;
  size?: number | string;
}

export const ChurchLogo: React.FC<ChurchLogoProps> = ({ className = 'w-10 h-10', size }) => (
  <img
    src={`${import.meta.env.BASE_URL}church-logo.png`}
    className={className}
    style={size ? { width: size, height: size } : undefined}
    alt="Quezon New Life Baptist Church"
  />
);
