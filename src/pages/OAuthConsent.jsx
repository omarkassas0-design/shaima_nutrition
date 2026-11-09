import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import Seo from '@/components/Seo';

// The supplied checkout contains consent UI but no MCP authorization server,
// handle store, or token-grant implementation. Fail closed until configured.
export default function OAuthConsent() {
  return (
    <>
      <Seo title="Authorize access — AuraDental Cloud" description="External client authorization is not configured." path="/oauth-consent" noindex />
      <AuthLayout icon={ShieldCheck} title="Authorization unavailable" subtitle="External AI client access is not configured for this deployment.">
        <p className="text-sm text-muted-foreground text-center">
          No access was granted. Contact your administrator to configure the authorization service, then reconnect from your client.
        </p>
        <div className="mt-5 text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">Return to sign in</Link>
        </div>
      </AuthLayout>
    </>
  );
}
