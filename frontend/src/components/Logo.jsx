import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Logo({ size = 'default', linkTo = 'Home', className = '' }) {
  const sizeClasses = {
    small: 'h-8 w-8',
    default: 'h-10 w-10',
    large: 'h-14 w-14',
    xlarge: 'h-20 w-20'
  };

  const logoImage = (
    <img
      src="/logo.jpg"
      alt="RidersOS"
      className={`${sizeClasses[size]} rounded-lg object-cover ${className}`}
    />
  );

  if (linkTo) {
    return (
      <Link to={createPageUrl(linkTo)} className="flex items-center gap-2">
        {logoImage}
        <span className="text-xl font-semibold text-[#1B4332] tracking-tight hidden sm:inline">
          RidersOS
        </span>
      </Link>
    );
  }

  return logoImage;
}
