import React from 'react';
import LegalLayout from '@/components/landing/LegalLayout';
import Seo from '@/components/Seo';

export default function Terms() {
  return (
    <>
    <Seo
      title="Terms of Service — AuraDental Cloud Dental Clinic Software"
      description="Review the terms of service for AuraDental Cloud, the cloud-based dental clinic management software covering account access, acceptable use, liability, and clinic administrator responsibilities."
      path="/terms"
    />
    <LegalLayout title="Terms of Service" updated="September 10, 2026">
      <p>These Terms of Service ("Terms") govern your access to and use of AuraDental Cloud (the "Service"). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.</p>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Accounts and responsibilities</h2>
        <p>You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must provide accurate information when registering and keep your account details up to date. You are responsible for the accuracy of the data you enter into the Service.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Clinic and user roles</h2>
        <p>The Service organizes access around clinics and roles. Clinic administrators manage their clinic's users, settings, and data. Doctors, receptionists, and other roles each have permissions appropriate to their function. You are responsible for inviting only authorized users to your clinic and for assigning appropriate roles. Users may only access data within their assigned clinic and according to their role.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Acceptable use</h2>
        <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You will not:</p>
        <ul className="list-disc pl-6 space-y-1.5 mt-2">
          <li>Enter or store data that violates applicable law or the rights of others.</li>
          <li>Attempt to access another clinic's data or circumvent access controls.</li>
          <li>Interfere with or disrupt the Service's infrastructure or security.</li>
          <li>Use the Service to store data unrelated to dental clinic management.</li>
          <li>Reverse engineer, decompile, or attempt to extract the Service's source code.</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Subscriptions and payments</h2>
        <p>Some features or plans may require a paid subscription. If you subscribe to a paid plan, you agree to the fees and billing terms presented at the time of subscription. Fees are billed in advance and are non-refundable except where required by law. We may change our fees or pricing with reasonable notice. Unpaid fees may result in suspension of access. Contact us for details about available plans and pricing.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Service availability</h2>
        <p>We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or factors beyond our control. We are not liable for downtime or data loss beyond the commitments described in these Terms and our backup practices.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Backups and data recovery</h2>
        <p>We perform regular automated backups of clinic data and offer optional off-platform backup copies. While we take reasonable measures to protect and recover data, you are responsible for maintaining your own records and for verifying the accuracy of data you enter. We recommend regular review of your backup settings. No backup system is foolproof, and we do not guarantee zero data loss in all scenarios.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Data ownership</h2>
        <p>You retain ownership of the data you enter into the Service, including clinic, patient, and financial records. We process your data on your behalf to provide the Service and do not claim ownership of your data. You may export your data at any time. We may use aggregated, de-identified data for service improvement and analytics.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Termination and cancellation</h2>
        <p>You may cancel your clinic account at any time by contacting us. Upon cancellation, your clinic is soft-deleted and your data is preserved for a limited period before permanent deletion. You may request permanent deletion to remove all clinic-scoped data. We may suspend or terminate access for violation of these Terms, unpaid fees, or inactivity. Upon termination, your right to use the Service ends, and your data will be handled according to our deletion and retention practices.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Prohibited use</h2>
        <p>Misuse of the Service, including unauthorized access, data scraping, spam, or any activity that harms the Service or its users, may result in immediate suspension. We reserve the right to investigate and take action against any user who violates these Terms.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Intellectual property</h2>
        <p>The Service, including its software, design, branding, and documentation, is owned by AuraDental Cloud and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works from the Service without our permission. Your data remains your property as described above.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Limitation of liability</h2>
        <p>The Service is provided "as is" and "as available." To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages, or for data loss beyond what is covered by our backup and recovery commitments. Our total liability for any claim related to the Service is limited to the fees you paid in the preceding twelve months, or, if no fees were paid, to a nominal amount. You are responsible for maintaining your own records and for the consequences of decisions made using the Service.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Changes to these Terms</h2>
        <p>We may update these Terms from time to time. We will notify active clinic administrators of material changes and update the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Contact</h2>
        <p>Questions about these Terms? Reach us at:</p>
        <ul className="list-disc pl-6 space-y-1.5 mt-2">
          <li>Email: <a href="mailto:auradentalcloud@gmail.com" className="text-primary hover:underline">auradentalcloud@gmail.com</a></li>
          <li>WhatsApp: <a href="https://wa.me/963930478389" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">+963 930 478 389</a></li>
        </ul>
      </div>
    </LegalLayout>
    </>
  );
}