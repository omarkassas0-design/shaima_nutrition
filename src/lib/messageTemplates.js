/**
 * Multilingual manual message templates.
 * No automatic sending — these are ready-made messages the clinic staff
 * can edit, preview, copy, and manually send via WhatsApp (wa.me links).
 *
 * Templates are stored per-language in clinic.settings.message_templates:
 *   { en: { [key]: "text" }, ar: { [key]: "text" }, tr: { [key]: "text" } }
 *
 * If a language key is missing, the default for that language is used.
 * Backward compat: old flat { [key]: "text" } format is treated as English.
 */

export const TEMPLATE_KEYS = {
  APPOINTMENT_REMINDER: 'appointment_reminder',
  APPOINTMENT_CONFIRMATION: 'appointment_confirmation',
  APPOINTMENT_RESCHEDULING: 'appointment_rescheduling',
  APPOINTMENT_CANCELLATION: 'appointment_cancellation',
  PAYMENT_REMINDER: 'payment_reminder',
  OUTSTANDING_BALANCE: 'outstanding_balance',
  TREATMENT_FOLLOWUP: 'treatment_followup',
  LAB_CASE_REMINDER: 'lab_case_reminder',
  GENERAL_MESSAGE: 'general_message',
  THANK_YOU: 'thank_you',
};

export const TEMPLATE_VARIABLES = [
  '{patient_name}',
  '{doctor_name}',
  '{clinic_name}',
  '{appointment_date}',
  '{appointment_day}',
  '{appointment_time}',
  '{treatment_name}',
  '{room}',
  '{location}',
  '{outstanding_balance}',
  '{currency}',
  '{clinic_phone}',
  '{lab_name}',
  '{due_date}',
];

// ── English (default) ──────────────────────────────────────────────
export const DEFAULT_TEMPLATES = {
  [TEMPLATE_KEYS.APPOINTMENT_REMINDER]: `Hello {patient_name},

This is a friendly reminder from {clinic_name}.

You have an appointment with Dr. {doctor_name} on {appointment_day}, {appointment_date} at {appointment_time}.

Please contact us at {clinic_phone} if you need to reschedule.

Thank you!`,

  [TEMPLATE_KEYS.APPOINTMENT_CONFIRMATION]: `Hello {patient_name},

Your appointment with Dr. {doctor_name} at {clinic_name} has been confirmed for {appointment_day}, {appointment_date} at {appointment_time}.

We look forward to seeing you!

{clinic_phone}`,

  [TEMPLATE_KEYS.APPOINTMENT_RESCHEDULING]: `Hello {patient_name},

We would like to reschedule your appointment with Dr. {doctor_name} at {clinic_name}.

The appointment was originally scheduled for {appointment_day}, {appointment_date} at {appointment_time}.

Please contact us at {clinic_phone} to arrange a new time.

Thank you for your understanding.`,

  [TEMPLATE_KEYS.APPOINTMENT_CANCELLATION]: `Hello {patient_name},

We regret to inform you that your appointment with Dr. {doctor_name} on {appointment_day}, {appointment_date} at {appointment_time} at {clinic_name} has been cancelled.

Please contact us at {clinic_phone} to schedule a new appointment.

We apologize for the inconvenience.`,

  [TEMPLATE_KEYS.PAYMENT_REMINDER]: `Hello {patient_name},

This is a friendly reminder that you have an outstanding balance of {outstanding_balance} {currency} at {clinic_name}.

Please contact us if you need any assistance.

Thank you.`,

  [TEMPLATE_KEYS.OUTSTANDING_BALANCE]: `Dear {patient_name},

Our records show an outstanding balance of {outstanding_balance} {currency} for your treatments at {clinic_name}.

We would appreciate it if you could settle this balance at your earliest convenience.

If you have any questions, please contact us at {clinic_phone}.

Thank you for your trust.`,

  [TEMPLATE_KEYS.TREATMENT_FOLLOWUP]: `Hello {patient_name},

We hope you are feeling well after your recent treatment ({treatment_name}) with Dr. {doctor_name} at {clinic_name}.

If you are experiencing any discomfort or have any questions, please do not hesitate to contact us at {clinic_phone}.

We wish you a speedy recovery!`,

  [TEMPLATE_KEYS.LAB_CASE_REMINDER]: `Hello {patient_name},

This is an update regarding your laboratory case ({treatment_name}) at {clinic_name}.

The expected completion date is {due_date}.

We will contact you once it is ready. For any inquiries, please call {clinic_phone}.

Thank you.`,

  [TEMPLATE_KEYS.GENERAL_MESSAGE]: `Hello {patient_name},

{clinic_name} is sending you this message.

If you have any questions or need assistance, please contact us at {clinic_phone}.

Best regards.`,

  [TEMPLATE_KEYS.THANK_YOU]: `Dear {patient_name},

Thank you for visiting {clinic_name}.

We appreciate your trust in our team and Dr. {doctor_name}.

We look forward to seeing you again. For any questions, please contact us at {clinic_phone}.

Wishing you good health!`,
};

// ── Arabic ──────────────────────────────────────────────────────────
export const DEFAULT_TEMPLATES_AR = {
  [TEMPLATE_KEYS.APPOINTMENT_REMINDER]: `مرحباً {patient_name}،

هذا تذكير ودي من {clinic_name}.

لديك موعد مع الدكتور {doctor_name} يوم {appointment_day}، {appointment_date} في الساعة {appointment_time}.

يرجى الاتصال بنا على {clinic_phone} إذا كنت بحاجة إلى إعادة الجدولة.

شكراً لكم!`,

  [TEMPLATE_KEYS.APPOINTMENT_CONFIRMATION]: `مرحباً {patient_name}，

تم تأكيد موعدك مع الدكتور {doctor_name} في {clinic_name} ليوم {appointment_day}، {appointment_date} في الساعة {appointment_time}.

نتطلع إلى رؤيتكم!

{clinic_phone}`,

  [TEMPLATE_KEYS.APPOINTMENT_RESCHEDULING]: `مرحباً {patient_name}，

نود إعادة جدولة موعدك مع الدكتور {doctor_name} في {clinic_name}.

كان الموعد المحدد ليوم {appointment_day}، {appointment_date} في الساعة {appointment_time}.

يرجى الاتصال بنا على {clinic_phone} لترتيب وقت جديد.

شكراً لتفهمكم.`,

  [TEMPLATE_KEYS.APPOINTMENT_CANCELLATION]: `مرحباً {patient_name}，

نأسف لإعلامكم بأن موعدكم مع الدكتور {doctor_name} يوم {appointment_day}، {appointment_date} في الساعة {appointment_time} في {clinic_name} قد تم إلغاؤه.

يرجى الاتصال بنا على {clinic_phone} لجدولة موعد جديد.

نعتذر عن الإزعاج.`,

  [TEMPLATE_KEYS.PAYMENT_REMINDER]: `مرحباً {patient_name}，

هذا تذكير ودي بأن لديكم رصيداً مستحقاً بقيمة {outstanding_balance} {currency} في {clinic_name}.

يرجى الاتصال بنا إذا كنتم بحاجة إلى أي مساعدة.

شكراً لكم.`,

  [TEMPLATE_KEYS.OUTSTANDING_BALANCE]: `عزيزي {patient_name}，

تظهر سجلاتنا وجود رصيد مستحق بقيمة {outstanding_balance} {currency} مقابل علاجاتكم في {clinic_name}.

نقدر لو تتمكنون من تسوية هذا الرصيد في أقرب وقت ممكن.

إذا كان لديكم أي استفسار، يرجى الاتصال بنا على {clinic_phone}.

شكراً لثقتكم.`,

  [TEMPLATE_KEYS.TREATMENT_FOLLOWUP]: `مرحباً {patient_name}，

نأمل أن تكونوا بخير بعد علاجكم الأخير ({treatment_name}) مع الدكتور {doctor_name} في {clinic_name}.

إذا كنتم تعانون من أي إزعاج أو لديكم أي استفسار، لا تترددوا في الاتصال بنا على {clinic_phone}.

نتمنى لكم الشفاء العاجل!`,

  [TEMPLATE_KEYS.LAB_CASE_REMINDER]: `مرحباً {patient_name}，

هذا تحديث بخصوص حالة المختبر الخاصة بكم ({treatment_name}) في {clinic_name}.

تاريخ الانتهاء المتوقع هو {due_date}.

سنتواصل معكم بمجرد أن يصبح جاهزاً. لأي استفسار، يرجى الاتصال على {clinic_phone}.

شكراً لكم.`,

  [TEMPLATE_KEYS.GENERAL_MESSAGE]: `مرحباً {patient_name}，

{clinic_name} ترسل لكم هذه الرسالة.

إذا كان لديكم أي استفسار أو تحتاجون إلى مساعدة، يرجى الاتصال بنا على {clinic_phone}.

مع أطيب التحيات.`,

  [TEMPLATE_KEYS.THANK_YOU]: `عزيزي {patient_name}，

شكراً لزيارتكم {clinic_name}.

نقدر ثقتكم بفريقنا والدكتور {doctor_name}.

نتطلع إلى رؤيتكم مرة أخرى. لأي استفسار، يرجى الاتصال بنا على {clinic_phone}.

نتمنى لكم دوام الصحة!`,
};

// ── Turkish ─────────────────────────────────────────────────────────
export const DEFAULT_TEMPLATES_TR = {
  [TEMPLATE_KEYS.APPOINTMENT_REMINDER]: `Merhaba {patient_name},

{clinic_name}'dan dostane bir hatırlatmadır.

Dr. {doctor_name} ile {appointment_day}, {appointment_date} tarihinde saat {appointment_time}'da randevunuz bulunmaktadır.

Yeniden planlamanız gerekirse lütfen {clinic_phone} numarasından bize ulaşın.

Teşekkürler!`,

  [TEMPLATE_KEYS.APPOINTMENT_CONFIRMATION]: `Merhaba {patient_name},

{clinic_name}'da Dr. {doctor_name} ile randevunuz {appointment_day}, {appointment_date} tarihinde saat {appointment_time} için onaylanmıştır.

Sizi görmek için sabırsızlanıyoruz!

{clinic_phone}`,

  [TEMPLATE_KEYS.APPOINTMENT_RESCHEDULING]: `Merhaba {patient_name},

{clinic_name}'da Dr. {doctor_name} ile randevunuzu yeniden planlamak istiyoruz.

Orijinal randevu {appointment_day}, {appointment_date} tarihinde saat {appointment_time}'ydı.

Yeni bir saat ayarlamak için lütfen {clinic_phone} numarasından bize ulaşın.

Anlayışınız için teşekkürler.`,

  [TEMPLATE_KEYS.APPOINTMENT_CANCELLATION]: `Merhaba {patient_name},

{clinic_name}'da Dr. {doctor_name} ile {appointment_day}, {appointment_date} tarihinde saat {appointment_time}'daki randevunuzun iptal edildiğini bildirmekten üzüntü duyuyoruz.

Yeni bir randevu planlamak için lütfen {clinic_phone} numarasından bize ulaşın.

Verdiğimiz rahatsızlık için özür dileriz.`,

  [TEMPLATE_KEYS.PAYMENT_REMINDER]: `Merhaba {patient_name},

{clinic_name}'da {outstanding_balance} {currency} tutarında ödenmemiş bakiyeniz olduğunu dostane bir şekilde hatırlatırız.

Herhangi bir yardıma ihtiyacınız olursa lütfen bizimle iletişime geçin.

Teşekkürler.`,

  [TEMPLATE_KEYS.OUTSTANDING_BALANCE]: `Sayın {patient_name},

Kayıtlarımıza göre {clinic_name}'daki tedavileriniz için {outstanding_balance} {currency} tutarında ödenmemiş bakiyeniz bulunmaktadır.

Bu bakiyeyi en kısa sürede ödemenizi takdir ederiz.

Herhangi bir sorunuz varsa, lütfen {clinic_phone} numarasından bizimle iletişime geçin.

Güveniniz için teşekkürler.`,

  [TEMPLATE_KEYS.TREATMENT_FOLLOWUP]: `Merhaba {patient_name},

{clinic_name}'da Dr. {doctor_name} ile yapılan son tedavinizden ({treatment_name}) sonra iyi olduğunuzu umuyoruz.

Herhangi bir rahatslık veya sorunuz varsa, {clinic_phone} numarasından bizimle iletişime geçmekten çekinmeyin.

Geçmiş olsun!`,

  [TEMPLATE_KEYS.LAB_CASE_REMINDER]: `Merhaba {patient_name},

{clinic_name}'daki laboratuvar vak'anız ({treatment_name}) ile ilgili bir güncellemedir.

Beklenen tamamlanma tarihi: {due_date}.

Hazır olduğunda sizinle iletişime geçeceğiz. Herhangi bir sorunuz için lütfen {clinic_phone} numarasını arayın.

Teşekkürler.`,

  [TEMPLATE_KEYS.GENERAL_MESSAGE]: `Merhaba {patient_name},

{clinic_name} size bu mesajı gönderiyor.

Herhangi bir sorunuz veya yardıma ihtiyacınız olursa, lütfen {clinic_phone} numarasından bizimle iletişime geçin.

Saygılarımla.`,

  [TEMPLATE_KEYS.THANK_YOU]: `Sayın {patient_name},

{clinic_name}'i ziyaret ettiğiniz için teşekkür ederiz.

Ekibimize ve Dr. {doctor_name}'e gösterdiğiniz güveni takdir ediyoruz.

Sizi tekrar görmek için sabırsızlanıyoruz. Herhangi bir sorunuz için lütfen {clinic_phone} numarasından bizimle iletişime geçin.

Sağlıklı günler dileriz!`,
};

export const TEMPLATE_META = [
  { key: TEMPLATE_KEYS.APPOINTMENT_REMINDER, label_en: 'Appointment Reminder', label_ar: 'تذكير موعد', label_tr: 'Randevu Hatırlatması', icon: 'CalendarClock' },
  { key: TEMPLATE_KEYS.APPOINTMENT_CONFIRMATION, label_en: 'Appointment Confirmation', label_ar: 'تأكيد موعد', label_tr: 'Randevu Onayı', icon: 'CalendarCheck' },
  { key: TEMPLATE_KEYS.APPOINTMENT_RESCHEDULING, label_en: 'Appointment Rescheduling', label_ar: 'إعادة جدولة موعد', label_tr: 'Randevu Yeniden Planlama', icon: 'CalendarX' },
  { key: TEMPLATE_KEYS.APPOINTMENT_CANCELLATION, label_en: 'Appointment Cancellation', label_ar: 'إلغاء موعد', label_tr: 'Randevu İptali', icon: 'CalendarMinus' },
  { key: TEMPLATE_KEYS.PAYMENT_REMINDER, label_en: 'Payment Reminder', label_ar: 'تذكير بالدفع', label_tr: 'Ödeme Hatırlatması', icon: 'CreditCard' },
  { key: TEMPLATE_KEYS.OUTSTANDING_BALANCE, label_en: 'Outstanding Balance', label_ar: 'رصيد مستحق', label_tr: 'Ödenmemiş Bakiye', icon: 'Wallet' },
  { key: TEMPLATE_KEYS.TREATMENT_FOLLOWUP, label_en: 'Treatment Follow-up', label_ar: 'متابعة علاج', label_tr: 'Tedavi Takibi', icon: 'Stethoscope' },
  { key: TEMPLATE_KEYS.LAB_CASE_REMINDER, label_en: 'Lab Case Reminder', label_ar: 'تذكير حالة مختبر', label_tr: 'Laboratuvar Vaka Hatırlatması', icon: 'FlaskConical' },
  { key: TEMPLATE_KEYS.GENERAL_MESSAGE, label_en: 'General Message', label_ar: 'رسالة عامة', label_tr: 'Genel Mesaj', icon: 'MessageSquare' },
  { key: TEMPLATE_KEYS.THANK_YOU, label_en: 'Thank You / Follow-up', label_ar: 'شكر / متابعة', label_tr: 'Teşekkür / Takip', icon: 'Heart' },
];

/** Returns the default templates for the given language. */
export function getDefaultTemplates(lang = 'en') {
  if (lang === 'ar') return DEFAULT_TEMPLATES_AR;
  if (lang === 'tr') return DEFAULT_TEMPLATES_TR;
  return DEFAULT_TEMPLATES;
}

/**
 * Normalize saved templates into a per-language structure.
 * Backward compat: old flat { [key]: "text" } format → treated as { en: {...} }.
 */
function normalizeSavedTemplates(saved = {}) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  if (saved.en || saved.ar || saved.tr) return saved;
  // Old flat format — treat as English customs
  return { en: saved };
}

/** Merge saved custom templates over defaults for the given language. Returns { [key]: text }. */
export function getEffectiveTemplates(saved = {}, lang = 'en') {
  const byLang = normalizeSavedTemplates(saved);
  const customs = byLang[lang] || {};
  const defaults = getDefaultTemplates(lang);
  const result = {};
  for (const key of Object.keys(defaults)) {
    result[key] = customs[key] || defaults[key];
  }
  return result;
}

/** Replace {variable} placeholders with values from data. */
export function renderTemplate(text, data = {}) {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    return data[name] !== undefined && data[name] !== null ? String(data[name]) : match;
  });
}

/** Build a wa.me link for a phone number and pre-filled message. */
export function buildWhatsAppLink(phone, message) {
  const clean = (phone || '').replace(/[^\d]/g, '');
  const text = encodeURIComponent(message || '');
  return `https://wa.me/${clean}?text=${text}`;
}

/** Sample data for previewing templates in the management page. */
export const SAMPLE_DATA = {
  patient_name: 'Ahmed Hassan',
  doctor_name: 'Dr. Sara Khalil',
  clinic_name: 'AuraDental Clinic',
  appointment_date: 'Monday, September 15, 2026',
  appointment_day: 'Monday',
  appointment_time: '10:30 AM',
  treatment_name: 'Root Canal Treatment',
  room: '1',
  location: '1',
  outstanding_balance: '1,250',
  currency: 'USD',
  clinic_phone: '+963 11 123 4567',
  lab_name: 'BrightSmile Lab',
  due_date: '2026-09-20',
};

export const SAMPLE_DATA_AR = {
  patient_name: 'أحمد حسن',
  doctor_name: 'د. سارة خليل',
  clinic_name: 'عيادة أورا دنتال',
  appointment_date: 'الإثنين، 15 سبتمبر 2026',
  appointment_day: 'الإثنين',
  appointment_time: '10:30 صباحاً',
  treatment_name: 'علاج قناة الجذر',
  room: '1',
  location: '1',
  outstanding_balance: '1,250',
  currency: 'USD',
  clinic_phone: '+963 11 123 4567',
  lab_name: 'مختبر برايت سمايل',
  due_date: '2026-09-20',
};

export const SAMPLE_DATA_TR = {
  patient_name: 'Ahmet Yılmaz',
  doctor_name: 'Dr. Ayşe Kaya',
  clinic_name: 'AuraDental Klinik',
  appointment_date: 'Pazartesi, 15 Eylül 2026',
  appointment_day: 'Pazartesi',
  appointment_time: '10:30',
  treatment_name: 'Kanal Tedavisi',
  room: '1',
  location: '1',
  outstanding_balance: '1.250',
  currency: 'USD',
  clinic_phone: '+90 212 123 4567',
  lab_name: 'BrightSmile Lab',
  due_date: '2026-09-20',
};

/** Returns sample data for the given language (for preview rendering). */
export function getSampleData(lang = 'en') {
  if (lang === 'ar') return SAMPLE_DATA_AR;
  if (lang === 'tr') return SAMPLE_DATA_TR;
  return SAMPLE_DATA;
}