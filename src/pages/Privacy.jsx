import React from 'react';
import LegalLayout from '@/components/landing/LegalLayout';
import Seo from '@/components/Seo';

export default function Privacy() {
  return (
    <>
    <Seo
      title="Privacy Policy — AuraDental Cloud Dental Practice Management"
      description="Read the AuraDental Cloud privacy policy: how we collect, protect, and manage dental clinic and patient data in our cloud-based practice management platform with role-based access and encryption."
      path="/privacy"
    />
    <LegalLayout title="Privacy Policy" updated="September 10, 2026">
      <p>AuraDental Cloud ("we", "us", "our") respects your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you use our cloud-based dental clinic management platform (the "Service"). By using the Service, you agree to the practices described in this policy.</p>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Data we handle</h2>
        <p>We process the following categories of data to provide and operate the Service:</p>
        <ul className="list-disc pl-6 space-y-1.5 mt-2">
          <li><strong className="text-foreground">Account data:</strong> Your name, email address, phone number, and authentication credentials when you register or sign in.</li>
          <li><strong className="text-foreground">Clinic data:</strong> Information you enter about your clinic, including clinic name, contact details, settings, staff, doctors, and operational configuration.</li>
          <li><strong className="text-foreground">Patient and health-related data:</strong> Patient names, contact information, medical and dental history, treatment plans, clinical notes, appointments, and other records you enter to manage patient care.</li>
          <li><strong className="text-foreground">Uploaded files:</strong> X-rays, intraoral images, documents, and other files you upload and associate with patient records or treatments.</li>
          <li><strong className="text-foreground">Payment and billing data:</strong> Payment records, invoices, expenses, doctor commissions, and related financial information you enter into the Service.</li>
          <li><strong className="text-foreground">Usage data:</strong> Information about how you interact with the Service, such as login times and feature usage, used for service operation and improvement.</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Cookies and local storage</h2>
        <p>The Service uses essential cookies and browser local storage to maintain your authenticated session, remember your language and display preferences, and keep you signed in. We do not use cookies for cross-site advertising. You can clear cookies and local storage in your browser settings, which will sign you out and reset your preferences.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Analytics</h2>
        <p>We use privacy-conscious analytics to understand how the Service is used, monitor performance, detect issues, and improve features. Analytics data is aggregated and does not include patient health records or the content of your clinical notes. You may opt out of analytics where the platform provides that option.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Data storage and security</h2>
        <p>Your data is stored on secure cloud infrastructure. Each clinic's data is isolated in a multi-tenant architecture — one clinic cannot access another clinic's data. Data is encrypted in transit (TLS) and at rest. Access to data is governed by role-based permissions enforced server-side: clinic administrators, doctors, receptionists, and other roles each see only what their role permits. We perform regular automated backups, including optional off-platform copies, to ensure recoverability. Patient files you upload are stored in private storage and accessed only through short-lived signed URLs.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Data retention and deletion</h2>
        <p>We retain your data for as long as your clinic account is active. You may export or delete your clinic data at any time by contacting us. When a clinic account is deleted, we follow a structured process: the clinic is first soft-deleted (data preserved but inaccessible), and permanent deletion can be requested thereafter, which physically removes all clinic-scoped records. Some data may be retained in backups for a limited recovery period after deletion. We may retain certain data where required by law or for legitimate business records.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Your rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="list-disc pl-6 space-y-1.5 mt-2">
          <li>Access the personal and clinic data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data, subject to legal retention obligations.</li>
          <li>Export your clinic data in a portable format.</li>
          <li>Withdraw consent for optional data processing where applicable.</li>
        </ul>
        <p className="mt-2">To exercise these rights, contact us using the details below. Clinic administrators can also manage users and data directly within the Service.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Third-party services</h2>
        <p>The Service integrates with third-party providers for features such as cloud file storage, email delivery, authentication, and optional off-platform backups (for example, Google Drive). These providers process data only as needed to deliver the integrated feature and are subject to their own privacy and security practices. We do not sell your data to third parties. When you connect a third-party service, you consent to that provider's terms and privacy policy for the data shared with it.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Health data notice</h2>
        <p>The Service may process health-related information (such as dental records and treatment plans) that you enter on behalf of your patients. You are responsible for obtaining any necessary consents from your patients before entering their data into the Service, and for complying with applicable healthcare data protection obligations in your jurisdiction. We process this data as a service provider on your behalf and do not use it for any purpose other than providing and operating the Service.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Children's privacy</h2>
        <p>The Service is designed for professional dental clinic management and is not intended for use by children. We do not knowingly collect personal data from children.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Changes to this policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify active clinic administrators of material changes and update the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Contact</h2>
        <p>Questions about privacy or data protection? Reach us at:</p>
        <ul className="list-disc pl-6 space-y-1.5 mt-2">
          <li>Email: <a href="mailto:auradentalcloud@gmail.com" className="text-primary hover:underline">auradentalcloud@gmail.com</a></li>
          <li>WhatsApp: <a href="https://wa.me/963930478389" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">+963 930 478 389</a></li>
        </ul>
      </div>
    </LegalLayout>
    </>
  );
}