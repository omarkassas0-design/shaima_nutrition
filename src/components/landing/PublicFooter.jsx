import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';

export default function PublicFooter({ compact = false }) {
  const year = new Date().getFullYear();
  return (
    <footer className={`w-full border-t border-border/50 ${compact ? 'py-3' : 'py-6'} mt-auto`}>
      <div className="max-w-3xl mx-auto px-4 flex flex-col items-center gap-2.5 text-center">
        {!compact && (
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <a href="mailto:auradentalcloud@gmail.com" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Mail className="w-3.5 h-3.5" aria-hidden="true" /> auradentalcloud@gmail.com
            </a>
            <a href="https://wa.me/963930478389" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> +963 930 478 389
            </a>
          </div>
        )}
        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Legal and help links">
          <Link to="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className="hover:text-foreground hover:underline">Terms of Service</Link>
          <span aria-hidden="true">·</span>
          <Link to="/contact" className="hover:text-foreground hover:underline">Contact</Link>
        </nav>
        <p className="text-xs text-muted-foreground">© {year} AuraDental Cloud. All rights reserved.</p>
      </div>
    </footer>
  );
}