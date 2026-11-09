/**
 * Column mapping for Excel/CSV import.
 *
 * Ensures files exported by the app can be imported back without manually
 * renaming columns. Maps exported column headers (English, Arabic, Turkish)
 * to the correct database field names for each entity type.
 */

// System fields that must never be imported (server-managed)
export const SYSTEM_FIELDS = ['id', 'created_date', 'updated_date', 'created_by_id', 'clinic_id'];

// Entity import configurations — extends the old ENTITY_CONFIGS with columnAliases
export const ENTITY_IMPORT_CONFIGS = {
  patients: {
    label: 'Patients',
    entityName: 'Patient',
    requiredFields: ['full_name', 'phone'],
    fieldTypes: {
      full_name: 'string', phone: 'string', whatsapp_number: 'string',
      gender: ['male', 'female'], birth_date: 'date', address: 'string', notes: 'string',
    },
    dedupeKeys: ['phone'],
    columnAliases: {
      // field names + English
      'full_name': 'full_name', 'Full Name': 'full_name', 'Full name': 'full_name', 'Name': 'full_name', 'Patient Name': 'full_name',
      'phone': 'phone', 'Phone': 'phone', 'Phone Number': 'phone', 'Mobile': 'phone', 'Tel': 'phone',
      'whatsapp_number': 'whatsapp_number', 'WhatsApp': 'whatsapp_number', 'whatsapp': 'whatsapp_number', 'WhatsApp Number': 'whatsapp_number',
      'gender': 'gender', 'Gender': 'gender', 'Sex': 'gender',
      'birth_date': 'birth_date', 'Birth Date': 'birth_date', 'Date of Birth': 'birth_date', 'DOB': 'birth_date', 'Birthday': 'birth_date',
      'address': 'address', 'Address': 'address',
      'notes': 'notes', 'Notes': 'notes', 'Note': 'notes',
      // System fields (exported as columns — map so stripSystemFields removes them)
      'id': 'id', 'ID': 'id', 'Patient ID': 'id',
      'created_date': 'created_date', 'Registered': 'created_date', 'Registered Date': 'created_date',
      // Arabic
      'الاسم الكامل': 'full_name', 'الاسم': 'full_name', 'اسم المريض': 'full_name',
      'رقم الهاتف': 'phone', 'الهاتف': 'phone',
      'واتساب': 'whatsapp_number', 'رقم واتساب': 'whatsapp_number',
      'الجنس': 'gender',
      'تاريخ الميلاد': 'birth_date',
      'العنوان': 'address',
      'ملاحظات': 'notes',
      'معرف المريض': 'id',
      'تاريخ التسجيل': 'created_date',
      // Turkish
      'Ad Soyad': 'full_name', 'Ad': 'full_name',
      'Telefon': 'phone', 'Telefon Numarası': 'phone',
      'Cinsiyet': 'gender',
      'Doğum Tarihi': 'birth_date',
      'Adres': 'address',
      'Notlar': 'notes',
      'Hasta ID': 'id',
      'Kayıt Tarihi': 'created_date',
    },
  },
  treatments: {
    label: 'Treatments',
    entityName: 'Treatment',
    requiredFields: ['name'],
    fieldTypes: {
      name: 'string', category: 'string', description: 'string',
      default_price: 'number', currency: ['USD', 'SYP', 'TRY', 'EUR'], duration_minutes: 'number',
      status: ['active', 'inactive'],
    },
    dedupeKeys: ['name'],
    columnAliases: {
      'name': 'name', 'Name': 'name', 'Treatment Name': 'name',
      'category': 'category', 'Category': 'category',
      'description': 'description', 'Description': 'description', 'Notes': 'description',
      'default_price': 'default_price', 'Default Price': 'default_price', 'Price': 'default_price',
      'currency': 'currency', 'Currency': 'currency',
      'duration_minutes': 'duration_minutes', 'Duration (min)': 'duration_minutes', 'Duration': 'duration_minutes', 'Duration (minutes)': 'duration_minutes',
      'status': 'status', 'Status': 'status',
      // Arabic
      'الاسم': 'name', 'اسم العلاج': 'name',
      'الفئة': 'category',
      'الوصف': 'description',
      'السعر الافتراضي': 'default_price', 'السعر': 'default_price',
      'العملة': 'currency',
      'المدة (دقيقة)': 'duration_minutes', 'المدة': 'duration_minutes',
      'الحالة': 'status',
      // Turkish
      'Ad': 'name', 'Tedavi Adı': 'name',
      'Kategori': 'category',
      'Açıklama': 'description',
      'Varsayılan Fiyat': 'default_price', 'Fiyat': 'default_price',
      'Para Birimi': 'currency',
      'Süre (dk)': 'duration_minutes', 'Süre': 'duration_minutes',
      'Durum': 'status',
    },
  },
  expenses: {
    label: 'Expenses',
    entityName: 'Expense',
    requiredFields: ['name', 'amount', 'expense_date'],
    fieldTypes: {
      name: 'string', amount: 'number', currency: ['USD', 'SYP', 'TRY', 'EUR'],
      expense_date: 'date', category: 'string', notes: 'string',
    },
    dedupeKeys: [],
    columnAliases: {
      'name': 'name', 'Name': 'name', 'Expense Name': 'name', 'Description': 'name',
      'amount': 'amount', 'Amount': 'amount', 'Cost': 'amount', 'Value': 'amount',
      'currency': 'currency', 'Currency': 'currency',
      'expense_date': 'expense_date', 'Expense Date': 'expense_date', 'Date': 'expense_date',
      'category': 'category', 'Category': 'category', 'Type': 'category',
      'notes': 'notes', 'Notes': 'notes', 'Note': 'notes',
      // Arabic
      'الاسم': 'name', 'المبلغ': 'amount', 'العملة': 'currency',
      'التاريخ': 'expense_date', 'تاريخ المصروف': 'expense_date',
      'الفئة': 'category', 'ملاحظات': 'notes',
      // Turkish
      'Ad': 'name', 'Tutar': 'amount', 'Para Birimi': 'currency',
      'Tarih': 'expense_date', 'Kategori': 'category', 'Notlar': 'notes',
    },
  },
  purchases: {
    label: 'Purchases',
    entityName: 'Purchase',
    requiredFields: ['name', 'amount', 'purchase_date'],
    fieldTypes: {
      name: 'string', category: 'string', supplier: 'string',
      quantity: 'number', unit: 'string', amount: 'number',
      currency: ['USD', 'SYP', 'TRY', 'EUR'], purchase_date: 'date', notes: 'string',
    },
    dedupeKeys: [],
    columnAliases: {
      'name': 'name', 'Name': 'name', 'Purchase Name': 'name', 'Item': 'name',
      'category': 'category', 'Category': 'category',
      'supplier': 'supplier', 'Supplier': 'supplier', 'Vendor': 'supplier',
      'quantity': 'quantity', 'Quantity': 'quantity', 'Qty': 'quantity',
      'unit': 'unit', 'Unit': 'unit',
      'amount': 'amount', 'Amount': 'amount', 'Cost': 'amount', 'Price': 'amount',
      'currency': 'currency', 'Currency': 'currency',
      'purchase_date': 'purchase_date', 'Purchase Date': 'purchase_date', 'Date': 'purchase_date',
      'notes': 'notes', 'Notes': 'notes',
      // Arabic
      'الاسم': 'name', 'الفئة': 'category', 'المورد': 'supplier',
      'الكمية': 'quantity', 'الوحدة': 'unit', 'المبلغ': 'amount',
      'العملة': 'currency', 'التاريخ': 'purchase_date', 'ملاحظات': 'notes',
      // Turkish
      'Ad': 'name', 'Kategori': 'category', 'Tedarikçi': 'supplier',
      'Miktar': 'quantity', 'Birim': 'unit', 'Tutar': 'amount',
      'Para Birimi': 'currency', 'Tarih': 'purchase_date', 'Notlar': 'notes',
    },
  },
  doctors: {
    label: 'Doctors',
    entityName: 'Doctor',
    requiredFields: ['name'],
    fieldTypes: {
      name: 'string', specialty: 'string', phone: 'string',
      commission_percentage: 'number', monthly_salary: 'number',
      salary_currency: ['USD', 'SYP', 'TRY', 'EUR'],
    },
    dedupeKeys: [],
    columnAliases: {
      'name': 'name', 'Name': 'name', 'Doctor Name': 'name', 'Full Name': 'name',
      'specialty': 'specialty', 'Specialty': 'specialty', 'Specialization': 'specialty',
      'phone': 'phone', 'Phone': 'phone', 'Phone Number': 'phone',
      'commission_percentage': 'commission_percentage', 'Commission %': 'commission_percentage', 'Commission': 'commission_percentage', 'Commission Percentage': 'commission_percentage',
      'monthly_salary': 'monthly_salary', 'Monthly Salary': 'monthly_salary', 'Salary': 'monthly_salary',
      'salary_currency': 'salary_currency', 'Salary Currency': 'salary_currency',
      // Arabic
      'الاسم': 'name', 'اسم الطبيب': 'name',
      'التخصص': 'specialty',
      'رقم الهاتف': 'phone',
      'العمولة': 'commission_percentage', 'نسبة العمولة': 'commission_percentage',
      'الراتب الشهري': 'monthly_salary', 'الراتب': 'monthly_salary',
      'عملة الراتب': 'salary_currency',
      // Turkish
      'Ad': 'name', 'Doktor Adı': 'name',
      'Uzmanlık': 'specialty',
      'Telefon': 'phone',
      'Komisyon': 'commission_percentage', 'Komisyon %': 'commission_percentage',
      'Aylık Maaş': 'monthly_salary', 'Maaş': 'monthly_salary',
      'Maaş Para Birimi': 'salary_currency',
    },
  },
  staff: {
    label: 'Staff',
    entityName: 'Staff',
    requiredFields: ['full_name', 'position'],
    fieldTypes: {
      full_name: 'string', position: 'string', phone: 'string',
      email: 'string', address: 'string',
      status: ['active', 'on_leave', 'suspended', 'resigned'], hire_date: 'date',
    },
    dedupeKeys: [],
    columnAliases: {
      'full_name': 'full_name', 'Full Name': 'full_name', 'Name': 'full_name', 'Employee Name': 'full_name',
      'position': 'position', 'Position': 'position', 'Role': 'position', 'Job Title': 'position',
      'phone': 'phone', 'Phone': 'phone', 'Phone Number': 'phone',
      'email': 'email', 'Email': 'email', 'Email Address': 'email',
      'address': 'address', 'Address': 'address',
      'status': 'status', 'Status': 'status',
      'hire_date': 'hire_date', 'Hire Date': 'hire_date', 'Date': 'hire_date', 'Start Date': 'hire_date',
      // Arabic
      'الاسم الكامل': 'full_name', 'الاسم': 'full_name',
      'المنصب': 'position', 'المسمى الوظيفي': 'position',
      'رقم الهاتف': 'phone',
      'البريد الإلكتروني': 'email',
      'العنوان': 'address',
      'الحالة': 'status',
      'تاريخ التعيين': 'hire_date', 'تاريخ التوظيف': 'hire_date',
      // Turkish
      'Ad Soyad': 'full_name', 'Ad': 'full_name',
      'Pozisyon': 'position',
      'Telefon': 'phone',
      'E-posta': 'email',
      'Adres': 'address',
      'Durum': 'status',
      'İşe Başlama Tarihi': 'hire_date',
    },
  },
  laboratories: {
    label: 'Laboratories',
    entityName: 'Laboratory',
    requiredFields: ['name'],
    fieldTypes: {
      name: 'string', contact_person: 'string', phone: 'string',
      whatsapp: 'string', email: 'string', address: 'string',
      status: ['active', 'inactive'],
    },
    dedupeKeys: [],
    columnAliases: {
      'name': 'name', 'Name': 'name', 'Lab Name': 'name', 'Laboratory Name': 'name',
      'contact_person': 'contact_person', 'Contact Person': 'contact_person', 'Contact': 'contact_person',
      'phone': 'phone', 'Phone': 'phone', 'Phone Number': 'phone',
      'whatsapp': 'whatsapp', 'WhatsApp': 'whatsapp',
      'email': 'email', 'Email': 'email', 'Email Address': 'email',
      'address': 'address', 'Address': 'address',
      'status': 'status', 'Status': 'status',
      // Arabic
      'الاسم': 'name', 'اسم المختبر': 'name',
      'شخص الاتصال': 'contact_person', 'الشخص المسؤول': 'contact_person',
      'رقم الهاتف': 'phone',
      'واتساب': 'whatsapp',
      'البريد الإلكتروني': 'email',
      'العنوان': 'address',
      'الحالة': 'status',
      // Turkish
      'Ad': 'name', 'Laboratuvar Adı': 'name',
      'İletişim Kişisi': 'contact_person',
      'Telefon': 'phone',
      'E-posta': 'email',
      'Adres': 'address',
      'Durum': 'status',
    },
  },
};

/**
 * Normalize a record by mapping column aliases to the correct field names.
 * Handles English, Arabic, and Turkish column headers from exports.
 */
export function normalizeRecord(entityType, record) {
  const config = ENTITY_IMPORT_CONFIGS[entityType];
  if (!config || !config.columnAliases) return record;

  // Build a case-insensitive lookup
  const lookup = {};
  for (const [alias, field] of Object.entries(config.columnAliases)) {
    lookup[alias.toLowerCase().trim()] = field;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined || value === '') continue;

    const lookupKey = String(key).toLowerCase().trim();
    const fieldName = lookup[lookupKey] || key;

    // Don't overwrite if the field already has a value (first non-empty wins)
    if (normalized[fieldName] === undefined || normalized[fieldName] === '') {
      normalized[fieldName] = value;
    }
  }
  return normalized;
}

/**
 * Build a JSON schema for the extraction LLM, with description hints that
 * list the possible column names for each field. This helps the LLM map
 * exported column headers to the correct field names.
 */
export function buildSchemaWithHints(entityType) {
  const config = ENTITY_IMPORT_CONFIGS[entityType];
  if (!config) return {};

  // Group aliases by field name
  const hintsByField = {};
  for (const [alias, field] of Object.entries(config.columnAliases || {})) {
    if (alias === field) continue; // skip the field name itself
    if (!hintsByField[field]) hintsByField[field] = [];
    hintsByField[field].push(alias);
  }

  const schema = {};
  for (const [field, type] of Object.entries(config.fieldTypes)) {
    const hints = hintsByField[field] || [];
    const desc = hints.length > 0 ? ` (column may be named: ${hints.join(', ')})` : '';
    if (Array.isArray(type)) {
      schema[field] = { type: 'string', enum: type, description: `One of: ${type.join(', ')}${desc}` };
    } else {
      schema[field] = { type, description: `${field}${desc}` };
    }
  }
  return schema;
}

/**
 * Value mappings for enum fields — maps translated values (Arabic, Turkish)
 * to the canonical English enum values stored in the database.
 */
const VALUE_MAPPINGS = {
  gender: {
    'male': 'male', 'm': 'male', 'boy': 'male', 'man': 'male',
    'female': 'female', 'f': 'female', 'girl': 'female', 'woman': 'female',
    'ذكر': 'male', 'أنثى': 'female',
    'erkek': 'male', 'kadın': 'female',
  },
  status: {
    'active': 'active', 'inactive': 'inactive',
    'نشط': 'active', 'غير نشط': 'inactive',
    'aktif': 'active', 'pasif': 'inactive',
    // Staff status
    'on_leave': 'on_leave', 'on leave': 'on_leave',
    'suspended': 'suspended', 'resigned': 'resigned',
    'إجازة': 'on_leave', 'موقوف': 'suspended', 'مستقيل': 'resigned',
    'izinli': 'on_leave', 'askıya alındı': 'suspended', 'istifa etti': 'resigned',
  },
  currency: {
    'usd': 'USD', 'syp': 'SYP', 'try': 'TRY', 'eur': 'EUR',
    '$': 'USD', '€': 'EUR', '₺': 'TRY',
  },
  method: {
    'cash': 'cash', 'card': 'card', 'transfer': 'transfer', 'other': 'other',
    'نقدي': 'cash', 'بطاقة': 'card', 'تحويل': 'transfer', 'أخرى': 'other',
    'nakit': 'cash', 'kart': 'card', 'havale': 'transfer', 'diğer': 'other',
  },
};

/**
 * Normalize an enum value to its canonical form.
 * Maps translated values (Arabic, Turkish) and case variations to the
 * canonical English enum value.
 */
export function normalizeValue(fieldName, value) {
  if (value === null || value === undefined || value === '') return value;
  const mappings = VALUE_MAPPINGS[fieldName];
  if (!mappings) return value;
  const valueStr = String(value).toLowerCase().trim();
  return mappings[valueStr] || value;
}

/**
 * Remove system fields from a record before import.
 * These fields are managed server-side and must not be imported.
 */
export function stripSystemFields(record) {
  const cleaned = {};
  for (const [key, value] of Object.entries(record)) {
    if (!SYSTEM_FIELDS.includes(key)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}