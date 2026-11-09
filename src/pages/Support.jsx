import React from 'react';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mail, Phone, MessageCircle, BookOpen, LifeBuoy, HelpCircle } from 'lucide-react';

const tr = (lang, ar, tr, en) => (lang === 'ar' ? ar : lang === 'tr' ? tr : en);

const FAQS = [
  {
    q_en: 'How do I add a new patient?',
    q_ar: 'كيف أضيف مريضاً جديداً؟',
    q_tr: 'Yeni hasta nasıl eklerim?',
    a_en: 'Go to the Patients page and click "Add Patient". Fill in the required fields (name, phone) and save. You can add medical and dental information later from the patient profile.',
    a_ar: 'انتقل إلى صفحة المرضى واضغط "إضافة مريض". املأ الحقول المطلوبة (الاسم، الهاتف) واحفظ. يمكنك إضافة المعلومات الطبية والسنية لاحقاً من ملف المريض.',
    a_tr: 'Hastalar sayfasına gidin ve "Hasta Ekle"ye tıklayın. Zorunlu alanları (ad, telefon) doldurun ve kaydedin. Tıbbi ve diş bilgilerini daha sonra hasta profilinden ekleyebilirsiniz.',
  },
  {
    q_en: 'How do I schedule an appointment?',
    q_ar: 'كيف أجدول موعداً؟',
    q_tr: 'Randevu nasıl planlarım?',
    a_en: 'Navigate to the Appointments page, select a date and time slot, choose the patient and doctor, and save. You can also create appointments from a patient profile.',
    a_ar: 'انتقل إلى صفحة المواعيد، اختر التاريخ والوقت، ثم اختر المريض والطبيب واحفظ. يمكنك أيضاً إنشاء مواعيد من ملف المريض.',
    a_tr: 'Randevular sayfasına gidin, tarih ve saat seçin, hastayı ve doktoru seçin ve kaydedin. Hasta profilinden de randevu oluşturabilirsiniz.',
  },
  {
    q_en: 'How are doctor commissions calculated?',
    q_ar: 'كيف يتم حساب عمولات الأطباء؟',
    q_tr: 'Doktor komisyonları nasıl hesaplanır?',
    a_en: 'Each doctor has a commission percentage set by the clinic admin. When a payment is recorded, the commission is calculated automatically as: payment amount × commission percentage. The percentage is captured at payment time for historical accuracy.',
    a_ar: 'لكل طبيب نسبة عمولة يحددها مدير العيادة. عند تسجيل دفعة، تُحسب العمولة تلقائياً: مبلغ الدفعة × نسبة العمولة. يتم تسجيل النسبة وقت الدفع للدقة التاريخية.',
    a_tr: 'Her doktorun klinik yöneticisi tarafından belirlenen bir komisyon yüzdesi vardır. Ödeme kaydedildiğinde komisyon otomatik olarak hesaplanır: ödeme tutarı × komisyon yüzdesi. Yüzde, geçmiş doğruluk için ödeme anında kaydedilir.',
  },
  {
    q_en: 'Can I use multiple currencies?',
    q_ar: 'هل يمكنني استخدام عملات متعددة؟',
    q_tr: 'Birden fazla para birimi kullanabilir miyim?',
    a_en: 'Yes. The system supports USD, SYP, and TRY. All financial data is strictly separated by currency — amounts are never combined or converted across currencies.',
    a_ar: 'نعم. يدعم النظام الدولار والليرة السورية والليرة التركية. جميع البيانات المالية مفصولة بدقة حسب العملة — لا يتم دمج المبالغ أو تحويلها بين العملات.',
    a_tr: 'Evet. Sistem USD, SYP ve TRY destekler. Tüm finansal veriler para birimine göre kesinlikle ayrılır — tutarlar para birimleri arasında asla birleştirilmez veya dönüştürülmez.',
  },
  {
    q_en: 'How do I send a WhatsApp message to a patient?',
    q_ar: 'كيف أرسل رسالة واتساب لمريض؟',
    q_tr: 'Hastaya WhatsApp mesajı nasıl gönderirim?',
    a_en: 'Open a patient profile and click "WhatsApp Message". Choose a template, review the pre-filled message, then copy it or open WhatsApp directly with the patient number and message ready to send.',
    a_ar: 'افتح ملف المريض واضغط "رسالة واتساب". اختر قالباً، راجع الرسالة المعبأة، ثم انسخها أو افتح واتساب مباشرة مع رقم المريض والرسالة جاهزة للإرسال.',
    a_tr: 'Hasta profilini açın ve "WhatsApp Mesaj"a tıklayın. Bir şablon seçin, önceden doldurulmuş mesajı inceleyin, ardından kopyalayın veya doğrudan hasta numarası ve mesajla WhatsApp uygulamasını açın.',
  },
  {
    q_en: 'How do I back up my clinic data?',
    q_ar: 'كيف أنسخ احتياطياً بيانات عيادتي؟',
    q_tr: 'Klinik verilerimi nasıl yedeklerim?',
    a_en: 'Go to Settings → Backup & Restore. You can create a manual backup at any time. Automatic daily backups run in the background if enabled.',
    a_ar: 'انتقل إلى الإعدادات → النسخ الاحتياطي والاستعادة. يمكنك إنشاء نسخة احتياطية يدوية في أي وقت. تعمل النسخ الاحتياطية اليومية التلقائية في الخلفية إذا كانت مفعلة.',
    a_tr: 'Ayarlar → Yedekleme ve Geri Yükleme sayfasına gidin. İstediğiniz zaman manuel yedek oluşturabilirsiniz. Etkinleştirilirse otomatik günlük yedekler arka planda çalışır.',
  },
];

export default function Support() {
  const { lang } = useLanguage();
  const { clinic } = useClinic();

  return (
    <div className="space-y-5 pb-10 max-w-3xl">
      <PageHeader title={tr(lang, 'الدعم والمساعدة', 'Destek ve Yardım', 'Support & Help')} />

      {/* Quick contact cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a href="mailto:auradentalcloud@gmail.com" className="block group">
          <Card className="glass border-0 shadow-sm transition-shadow group-hover:shadow-md group-hover:ring-1 group-hover:ring-primary/40 cursor-pointer h-full">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-2">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{tr(lang, 'البريد الإلكتروني', 'E-posta', 'Email')}</p>
              <p className="text-sm font-medium text-primary break-all">auradentalcloud@gmail.com</p>
            </CardContent>
          </Card>
        </a>
        <a href="tel:+963930478389" className="block group">
          <Card className="glass border-0 shadow-sm transition-shadow group-hover:shadow-md group-hover:ring-1 group-hover:ring-primary/40 cursor-pointer h-full">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center mx-auto mb-2">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{tr(lang, 'الهاتف', 'Telefon', 'Phone')}</p>
              <p className="text-sm font-medium" dir="ltr">+963 930 478 389</p>
            </CardContent>
          </Card>
        </a>
        <a href="https://wa.me/963930478389" target="_blank" rel="noopener noreferrer" className="block group">
          <Card className="glass border-0 shadow-sm transition-shadow group-hover:shadow-md group-hover:ring-1 group-hover:ring-green-500/40 cursor-pointer h-full">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center mx-auto mb-2">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">WhatsApp</p>
              <p className="text-sm font-medium text-green-600" dir="ltr">+963 930 478 389</p>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* Getting started */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-5 h-5 text-primary" />
            {tr(lang, 'البدء السريع', 'Hızlı Başlangıç', 'Getting Started')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{tr(lang,
            '١. أضف الأطباء والعلاجات من صفحاتهم الخاصة.',
            '1. Doktorları ve tedavileri kendi sayfalarından ekleyin.',
            '1. Add doctors and treatments from their respective pages.'
          )}</p>
          <p>{tr(lang,
            '٢. سجل المرضى ثم جدول مواعيدهم.',
            '2. Hastaları kaydedin ve randevularını planlayın.',
            '2. Register patients, then schedule their appointments.'
          )}</p>
          <p>{tr(lang,
            '٣. سجل المدفوعات لاحتساب العمولات تلقائياً.',
            '3. Ödemeleri kaydedin, komisyonlar otomatik hesaplanır.',
            '3. Record payments to automatically calculate commissions.'
          )}</p>
          <p>{tr(lang,
            '٤. راجع التقارير لتحليل الأداء المالي.',
            '4. Performansı analiz etmek için raporları inceleyin.',
            '4. Review reports to analyze financial performance.'
          )}</p>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="w-5 h-5 text-primary" />
            {tr(lang, 'الأسئلة الشائعة', 'Sıkça Sorulan Sorular', 'Frequently Asked Questions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-sm text-left">
                  {tr(lang, faq.q_ar, faq.q_tr, faq.q_en)}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {tr(lang, faq.a_ar, faq.a_tr, faq.a_en)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Footer note */}
      <Card className="glass border-0 shadow-sm">
        <CardContent className="p-4 flex items-start gap-3">
          <LifeBuoy className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-1">{tr(lang, 'هل تحتاج مزيد من المساعدة؟', 'Daha fazla yardıma mı ihtiyacınız var?', 'Need more help?')}</p>
            <p className="text-xs text-muted-foreground">
              {tr(lang,
                'تواصل مع فريق الدعم عبر البريد الإلكتروني أو الهاتف. نسعى للرد خلال 24 ساعة.',
                'Destek ekibiyle e-posta veya telefon ile iletişime geçin. 24 saat içinde yanıt vermeye çalışıyoruz.',
                'Contact our support team via email or phone. We aim to respond within 24 hours.'
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}