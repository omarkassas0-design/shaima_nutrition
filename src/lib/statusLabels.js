/**
 * Centralized translations for dynamic enum values.
 *
 * Database records store internal/system values (e.g. "completed", "scheduled",
 * "cash", "receptionist"). Only the DISPLAYED text is translated here — the
 * stored values are never changed.
 *
 * Usage:
 *   import { getStatusLabel } from '@/lib/statusLabels';
 *   getStatusLabel('completed', lang);          // auto-detects category
 *   getStatusLabel('completed', 'ar');           // -> "مكتمل"
 *
 *   import { useLanguage } from '@/lib/useLanguage';
 *   const { lang } = useLanguage();
 *   getStatusLabel(treatment.status, lang);
 *
 * Every status/enum that appears anywhere in the UI must be added here so the
 * displayed label always follows the selected language with zero mixing.
 */

const STATUS_LABELS = {
  treatment_status: {
    planned:      { en: 'Planned',       ar: 'مخطط',        tr: 'Planlandı' },
    in_progress:  { en: 'In Progress',   ar: 'قيد التنفيذ', tr: 'Devam Ediyor' },
    completed:    { en: 'Completed',     ar: 'مكتمل',       tr: 'Tamamlandı' },
    cancelled:    { en: 'Cancelled',     ar: 'ملغي',        tr: 'İptal Edildi' },
  },
  appointment_status: {
    scheduled:  { en: 'Scheduled',  ar: 'مجدول',      tr: 'Planlandı' },
    confirmed:  { en: 'Confirmed',  ar: 'مؤكد',       tr: 'Onaylandı' },
    waiting:    { en: 'Waiting',    ar: 'بالانتظار',  tr: 'Beklemede' },
    completed:  { en: 'Completed',   ar: 'مكتمل',      tr: 'Tamamlandı' },
    no_show:    { en: 'No-show',    ar: 'لم يحضر',    tr: 'Gelmedi' },
    cancelled:  { en: 'Cancelled',   ar: 'ملغي',       tr: 'İptal Edildi' },
  },
  lab_status: {
    sent:        { en: 'Sent',        ar: 'مُرسل',       tr: 'Gönderildi' },
    in_progress: { en: 'In Progress', ar: 'قيد التنفيذ', tr: 'Devam Ediyor' },
    ready:       { en: 'Ready',       ar: 'جاهز',        tr: 'Hazır' },
    delivered:   { en: 'Delivered',   ar: 'مُسلَّم',     tr: 'Teslim Edildi' },
    cancelled:   { en: 'Cancelled',   ar: 'ملغي',        tr: 'İptal Edildi' },
  },
  payment_method: {
    cash:     { en: 'Cash',     ar: 'نقدي',  tr: 'Nakit' },
    card:     { en: 'Card',     ar: 'بطاقة', tr: 'Kart' },
    transfer: { en: 'Transfer', ar: 'تحويل', tr: 'Havale' },
    other:    { en: 'Other',    ar: 'أخرى',  tr: 'Diğer' },
  },
  message_status: {
    pending:     { en: 'Pending',    ar: 'قيد الانتظار', tr: 'Beklemede' },
    sent:        { en: 'Sent',       ar: 'مُرسل',        tr: 'Gönderildi' },
    failed:      { en: 'Failed',     ar: 'فشل',          tr: 'Başarısız' },
    delivered:   { en: 'Delivered', ar: 'تم التسليم',   tr: 'Teslim Edildi' },
    undelivered: { en: 'Undelivered', ar: 'لم يُسلَّم',  tr: 'Teslim Edilmedi' },
  },
  reminder_status: {
    pending: { en: 'Pending', ar: 'قيد الانتظار', tr: 'Beklemede' },
    sent:    { en: 'Sent',    ar: 'مُرسل',        tr: 'Gönderildi' },
    failed:  { en: 'Failed',  ar: 'فشل',          tr: 'Başarısız' },
  },
  staff_status: {
    active:    { en: 'Active',   ar: 'نشط',       tr: 'Aktif' },
    on_leave:  { en: 'On Leave', ar: 'في إجازة',  tr: 'İzinli' },
    suspended: { en: 'Suspended', ar: 'موقوف',    tr: 'Askıya Alındı' },
    resigned:  { en: 'Resigned', ar: 'استقال',    tr: 'İstifa Etti' },
  },
  staff_position: {
    nurse:        { en: 'Nurse',        ar: 'ممرض',          tr: 'Hemşire' },
    receptionist: { en: 'Receptionist', ar: 'موظف استقبال',  tr: 'Resepsiyonist' },
    accountant:   { en: 'Accountant',   ar: 'محاسب',         tr: 'Muhasebeci' },
    cleaner:      { en: 'Cleaner',      ar: 'عامل نظافة',    tr: 'Temizlikçi' },
    assistant:    { en: 'Assistant',    ar: 'مساعد',         tr: 'Asistan' },
    technician:   { en: 'Technician',   ar: 'فني',           tr: 'Teknisyen' },
    call_center:  { en: 'Call Center',  ar: 'مركز اتصال',    tr: 'Çağrı Merkezi' },
    other:        { en: 'Other',        ar: 'أخرى',          tr: 'Diğer' },
  },
  shift_type: {
    morning: { en: 'Morning', ar: 'صباحي', tr: 'Sabah' },
    evening: { en: 'Evening', ar: 'مسائي', tr: 'Akşam' },
    split:   { en: 'Split',   ar: 'مقسم', tr: 'Bölünmüş' },
    custom:  { en: 'Custom',  ar: 'مخصص', tr: 'Özel' },
  },
  gender: {
    male:   { en: 'Male',   ar: 'ذكر',  tr: 'Erkek' },
    female: { en: 'Female', ar: 'أنثى', tr: 'Kadın' },
  },
  discount_type: {
    percentage: { en: 'Percentage', ar: 'نسبة مئوية', tr: 'Yüzde' },
    fixed:      { en: 'Fixed',      ar: 'مبلغ ثابت',  tr: 'Sabit' },
    none:       { en: 'None',       ar: 'بدون',        tr: 'Yok' },
  },
  file_type: {
    image:    { en: 'Image',    ar: 'صورة',  tr: 'Resim' },
    pdf:      { en: 'PDF',      ar: 'PDF',   tr: 'PDF' },
    xray:     { en: 'X-Ray',    ar: 'أشعة',  tr: 'Röntgen' },
    document: { en: 'Document', ar: 'مستند', tr: 'Belge' },
  },
  backup_status: {
    pending:   { en: 'Pending',   ar: 'قيد الانتظار', tr: 'Beklemede' },
    completed: { en: 'Completed', ar: 'مكتمل',        tr: 'Tamamlandı' },
    failed:    { en: 'Failed',    ar: 'فشل',          tr: 'Başarısız' },
  },
  notification_type: {
    lab_ready:            { en: 'Lab Ready',           ar: 'المختبر جاهز',      tr: 'Laboratuvar Hazır' },
    appointment_reminder: { en: 'Appointment Reminder', ar: 'تذكير موعد',        tr: 'Randevu Hatırlatması' },
    payment_received:     { en: 'Payment Received',    ar: 'تم استلام الدفع',  tr: 'Ödeme Alındı' },
    xray_uploaded:       { en: 'X-Ray Uploaded',      ar: 'تم رفع الأشعة',     tr: 'Röntgen Yüklendi' },
    schedule_changed:    { en: 'Schedule Changed',    ar: 'تغيير الجدول',      tr: 'Çizelge Değişti' },
  },
  otp_status: {
    pending:  { en: 'Pending',  ar: 'قيد الانتظار', tr: 'Beklemede' },
    verified: { en: 'Verified', ar: 'مُتحقق',       tr: 'Doğrulandı' },
    expired:  { en: 'Expired',  ar: 'منتهي',        tr: 'Süresi Doldu' },
    blocked:  { en: 'Blocked',  ar: 'محظور',        tr: 'Engellendi' },
  },
  report_type: {
    daily_summary:           { en: 'Daily Summary',           ar: 'ملخص يومي',           tr: 'Günlük Özet' },
    weekly_summary:          { en: 'Weekly Summary',          ar: 'ملخص أسبوعي',          tr: 'Haftalık Özet' },
    monthly_summary:         { en: 'Monthly Summary',         ar: 'ملخص شهري',            tr: 'Aylık Özet' },
    revenue_summary:         { en: 'Revenue Summary',         ar: 'ملخص الإيرادات',       tr: 'Gelir Özeti' },
    expense_summary:         { en: 'Expense Summary',         ar: 'ملخص المصروفات',       tr: 'Gider Özeti' },
    payment_summary:         { en: 'Payment Summary',         ar: 'ملخص المدفوعات',       tr: 'Ödeme Özeti' },
    outstanding_balances:    { en: 'Outstanding Balances',    ar: 'الأرصدة المستحقة',     tr: 'Ödenmemiş Bakiyeler' },
    appointment_statistics:  { en: 'Appointment Statistics',  ar: 'إحصائيات المواعيد',   tr: 'Randevu İstatistikleri' },
    clinic_performance:      { en: 'Clinic Performance',       ar: 'أداء العيادة',         tr: 'Klinik Performansı' },
  },
  frequency: {
    daily:   { en: 'Daily',   ar: 'يومي',    tr: 'Günlük' },
    weekly:  { en: 'Weekly',  ar: 'أسبوعي',  tr: 'Haftalık' },
    monthly: { en: 'Monthly', ar: 'شهري',    tr: 'Aylık' },
  },
  currency: {
    USD: { en: 'USD', ar: 'دولار',         tr: 'USD' },
    SYP: { en: 'SYP', ar: 'ليرة سورية',     tr: 'SYP' },
    TRY: { en: 'TRY', ar: 'ليرة تركية',     tr: 'TRY' },
    EUR: { en: 'EUR', ar: 'يورو',           tr: 'EUR' },
  },
  user_role: {
    super_admin:   { en: 'Super Admin',   ar: 'مدير عام',        tr: 'Süper Yönetici' },
    admin:         { en: 'Admin',         ar: 'مدير',             tr: 'Yönetici' },
    clinic_admin:  { en: 'Clinic Admin',  ar: 'مدير العيادة',     tr: 'Klinik Yöneticisi' },
    receptionist:  { en: 'Receptionist',  ar: 'موظف استقبال',     tr: 'Resepsiyonist' },
    assistant:     { en: 'Assistant',     ar: 'مساعد',           tr: 'Asistan' },
    doctor:        { en: 'Doctor',        ar: 'طبيب',            tr: 'Doktor' },
  },
  signup_status: {
    pending:  { en: 'Pending',  ar: 'قيد الانتظار', tr: 'Beklemede' },
    approved: { en: 'Approved', ar: 'موافق عليه',   tr: 'Onaylandı' },
    rejected: { en: 'Rejected', ar: 'مرفوض',        tr: 'Reddedildi' },
  },
  treatment_active: {
    active:   { en: 'Active',   ar: 'نشط',   tr: 'Aktif' },
    inactive: { en: 'Inactive', ar: 'غير نشط', tr: 'Pasif' },
  },
  lab_active: {
    active:   { en: 'Active',   ar: 'نشط',   tr: 'Aktif' },
    inactive: { en: 'Inactive', ar: 'غير نشط', tr: 'Pasif' },
  },
};

// Flatten every value into a single lookup so callers don't need to know the category.
const VALUE_MAP = {};
for (const cat of Object.keys(STATUS_LABELS)) {
  for (const val of Object.keys(STATUS_LABELS[cat])) {
    VALUE_MAP[val] = STATUS_LABELS[cat][val];
  }
}

/**
 * Returns the translated display label for any known enum value.
 * Falls back to the raw value only if the value is not in the map (e.g. a
 * free-text category) — never to English for a known value.
 */
export function getStatusLabel(value, lang = 'en') {
  if (value == null || value === '') return '';
  const entry = VALUE_MAP[value];
  if (!entry) return String(value);
  return entry[lang] || entry.en || String(value);
}

export { STATUS_LABELS };
export default STATUS_LABELS;