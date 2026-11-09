/**
 * Shared backend i18n for patient-facing and staff-facing messages.
 *
 * Language is determined by the clinic's `language` field (en/ar/tr).
 * All functions accept a `lang` string and return the appropriate strings.
 * Falls back to English for unknown languages.
 */

export type Lang = 'en' | 'ar' | 'tr';

export function normalizeLang(lang: string | undefined | null): Lang {
  if (lang === 'ar' || lang === 'tr') return lang;
  return 'en';
}

// ── Notification strings (generateNotifications) ────────────────────

export const NOTIFICATION_STRINGS = {
  en: {
    upcomingAppointment: 'Upcoming Appointment',
    labCaseOverdue: 'Lab Case Overdue',
    labCaseDueSoon: 'Lab Case Due Soon',
    outstandingBalances: 'Outstanding Balances',
    outstandingMsg: (count: number) =>
      `${count} patient(s) have outstanding balances. Review payments to follow up.`,
    apptMsg: (patientName: string, date: string, time: string, treatmentName?: string) =>
      `${patientName || 'Patient'} — ${date} at ${time}${treatmentName ? ' (' + treatmentName + ')' : ''}`,
    labMsg: (caseType: string, patientName: string, labName: string, dueDate?: string) =>
      `${caseType} — ${patientName || 'Patient'} at ${labName || 'lab'}${dueDate ? ' (due ' + dueDate + ')' : ''}`,
  },
  ar: {
    upcomingAppointment: 'موعد قادم',
    labCaseOverdue: 'حالة مختبر متأخرة',
    labCaseDueSoon: 'حالة مختبر مستحقة قريباً',
    outstandingBalances: 'أرصدة مستحقة',
    outstandingMsg: (count: number) =>
      `يوجد ${count} مريضاً لديهم أرصدة مستحقة. يرجى مراجعة المدفوعات للمتابعة.`,
    apptMsg: (patientName: string, date: string, time: string, treatmentName?: string) =>
      `${patientName || 'مريض'} — ${date} في الساعة ${time}${treatmentName ? ' (' + treatmentName + ')' : ''}`,
    labMsg: (caseType: string, patientName: string, labName: string, dueDate?: string) =>
      `${caseType} — ${patientName || 'مريض'} في ${labName || 'المختبر'}${dueDate ? ' (موعد التسليم ' + dueDate + ')' : ''}`,
  },
  tr: {
    upcomingAppointment: 'Yaklaşan Randevu',
    labCaseOverdue: 'Laboratuvar Vakası Gecikti',
    labCaseDueSoon: 'Laboratuvar Vakası Yakında Teslim',
    outstandingBalances: 'Ödenmemiş Bakiyeler',
    outstandingMsg: (count: number) =>
      `${count} hastanın ödenmemiş bakiyesi bulunmaktadır. Takip için ödemeleri inceleyin.`,
    apptMsg: (patientName: string, date: string, time: string, treatmentName?: string) =>
      `${patientName || 'Hasta'} — ${date} saat ${time}${treatmentName ? ' (' + treatmentName + ')' : ''}`,
    labMsg: (caseType: string, patientName: string, labName: string, dueDate?: string) =>
      `${caseType} — ${patientName || 'Hasta'}, ${labName || 'laboratuvar'}${dueDate ? ' (teslim ' + dueDate + ')' : ''}`,
  },
};

export function getNotificationStrings(lang: Lang) {
  return NOTIFICATION_STRINGS[lang] || NOTIFICATION_STRINGS.en;
}

// ── Scheduled report strings (sendScheduledReports) ─────────────────

export const REPORT_STRINGS = {
  en: {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    reportSuffix: 'Report',
    period: 'Period',
    to: 'to',
    phone: 'Phone',
    generatedBy: 'Generated automatically by AuraDental Cloud',
    reportTitles: {
      daily_summary: 'Daily Summary',
      weekly_summary: 'Weekly Summary',
      monthly_summary: 'Monthly Summary',
      revenue_summary: 'Revenue Summary',
      expense_summary: 'Expense Summary',
      payment_summary: 'Payment Summary',
      outstanding_balances: 'Outstanding Balances',
      appointment_statistics: 'Appointment Statistics',
      clinic_performance: 'Clinic Performance',
      default: 'Report',
    },
    sectionLabels: {
      revenue: 'Revenue',
      expenses: 'Expenses',
      purchases: 'Purchases',
      appointments: 'Appointments',
      outstandingBalances: 'Outstanding Balances',
      totalRevenue: 'Total Revenue',
      paymentsReceived: 'Payments Received',
      paymentCount: 'Payment Count',
      totalOutstanding: 'Total Outstanding',
      totalAppointments: 'Total Appointments',
      outstanding: 'Outstanding',
    },
  },
  ar: {
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    reportSuffix: 'تقرير',
    period: 'الفترة',
    to: 'إلى',
    phone: 'الهاتف',
    generatedBy: 'تم الإنشاء تلقائياً بواسطة AuraDental Cloud',
    reportTitles: {
      daily_summary: 'ملخص يومي',
      weekly_summary: 'ملخص أسبوعي',
      monthly_summary: 'ملخص شهري',
      revenue_summary: 'ملخص الإيرادات',
      expense_summary: 'ملخص المصروفات',
      payment_summary: 'ملخص المدفوعات',
      outstanding_balances: 'الأرصدة المستحقة',
      appointment_statistics: 'إحصائيات المواعيد',
      clinic_performance: 'أداء العيادة',
      default: 'تقرير',
    },
    sectionLabels: {
      revenue: 'الإيرادات',
      expenses: 'المصروفات',
      purchases: 'المشتريات',
      appointments: 'المواعيد',
      outstandingBalances: 'الأرصدة المستحقة',
      totalRevenue: 'إجمالي الإيرادات',
      paymentsReceived: 'المدفوعات المستلمة',
      paymentCount: 'عدد المدفوعات',
      totalOutstanding: 'إجمالي المستحق',
      totalAppointments: 'إجمالي المواعيد',
      outstanding: 'المستحق',
    },
  },
  tr: {
    daily: 'Günlük',
    weekly: 'Haftalık',
    monthly: 'Aylık',
    reportSuffix: 'Rapor',
    period: 'Dönem',
    to: '—',
    phone: 'Telefon',
    generatedBy: 'AuraDental Cloud tarafından otomatik olarak oluşturuldu',
    reportTitles: {
      daily_summary: 'Günlük Özet',
      weekly_summary: 'Haftalık Özet',
      monthly_summary: 'Aylık Özet',
      revenue_summary: 'Gelir Özeti',
      expense_summary: 'Gider Özeti',
      payment_summary: 'Ödeme Özeti',
      outstanding_balances: 'Ödenmemiş Bakiyeler',
      appointment_statistics: 'Randevu İstatistikleri',
      clinic_performance: 'Klinik Performansı',
      default: 'Rapor',
    },
    sectionLabels: {
      revenue: 'Gelir',
      expenses: 'Giderler',
      purchases: 'Satın Almalar',
      appointments: 'Randevular',
      outstandingBalances: 'Ödenmemiş Bakiyeler',
      totalRevenue: 'Toplam Gelir',
      paymentsReceived: 'Alınan Ödemeler',
      paymentCount: 'Ödeme Sayısı',
      totalOutstanding: 'Toplam Ödenmemiş',
      totalAppointments: 'Toplam Randevu',
      outstanding: 'Ödenmemiş',
    },
  },
};

export function getReportStrings(lang: Lang) {
  return REPORT_STRINGS[lang] || REPORT_STRINGS.en;
}