import React from 'react';

// Custom tooth icon — lucide-react doesn't have a dental tooth icon.
// Simple, clean line-art tooth shape matching the UI design reference.
export function ToothIcon({ className = 'w-5 h-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M13 4.2c-1-0.8-2.5-1.2-4-1.2C7 3 5 4 4.5 6.5c-.3 1.5.2 3.5.7 5.5.3 1.2.5 3 1.5 3s1-1.8 1.5-3.5c.3-1 .5-1.5 1.5-1.5h2c1 0 1.2.5 1.5 1.5.5 1.7 1 3.5 1.5 3.5s1.2-1.8 1.5-3c.4-1.8.8-3.8.8-6 0-2.5-1.5-3.5-3-3z" />
      <path d="M12 4.5v3" opacity="0.4" />
    </svg>
  );
}

export default ToothIcon;