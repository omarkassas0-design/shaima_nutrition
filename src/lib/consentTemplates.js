/**
 * Reusable digital consent form templates.
 *
 * Each template has a key, localized name, and localized body with placeholders:
 *   {patient_name}  {clinic_name}  {doctor_name}  {procedure_name}  {date}
 *
 * Templates are hardcoded (not a DB entity) to keep the system simple and
 * avoid extra entity/credit overhead. They are clinic-agnostic — the clinic
 * name and doctor are injected at signing time.
 */
export const CONSENT_TEMPLATES = [
  {
    key: 'extraction',
    name: { en: 'Tooth Extraction', ar: 'قلع الأسنان', tr: 'Diş Çekimi' },
    body: {
      en: `CONSENT FOR TOOTH EXTRACTION

Patient: {patient_name}
Date: {date}
Clinic: {clinic_name}
Doctor: Dr. {doctor_name}
Procedure: {procedure_name}

I, the undersigned, hereby consent to the extraction of the tooth/teeth described above. I understand that tooth extraction is a surgical procedure with potential risks including but not limited to: pain, swelling, infection, bleeding, damage to adjacent teeth or restorations, dry socket, jaw fracture, and the need for further treatment.

I confirm that I have disclosed my complete medical history, including any medications, allergies, or conditions. I have had the opportunity to ask questions and all my questions have been answered.

Patient Signature: _________________________`,
      ar: `موافقة على قلع الأسنان

المريض: {patient_name}
التاريخ: {date}
العيادة: {clinic_name}
الطبيب: د. {doctor_name}
الإجراء: {procedure_name}

أنا الموقع أدناه، أوافق على قلع السن/الأسنان المذكورة أعلاه. أتفهم أن قلع الأسنان هو إجراء جراحي مع مخاطر محتملة تشمل但不限于: الألم، التورم، العدوى، النزيف، ضرر الأسنان المجاورة، الجفاف السني، كسر الفك، والحاجة لمزيد من العلاج.

أؤكد أنني أفصحت عن تاريخي الطبي الكامل، بما في ذلك أي أدوية أو حساسية أو حالات. وقد أتيحت لي الفرصة لطرح الأسئلة وتمت الإجابة على جميع أسئلتي.

توقيع المريض: _________________________`,
      tr: `DİŞ ÇEKİMİ ONAM FORMU

Hasta: {patient_name}
Tarih: {date}
Klinik: {clinic_name}
Doktor: Dr. {doctor_name}
İşlem: {procedure_name}

Aşağıya imzasını atan hasta, yukarıda belirtilen diş/dişlerin çekilmesine onay veriyorum. Diş çekiminin cerrahi bir işlem olduğunu ve ağrı, şişlik, enfeksiyon, kanama, komşu dişlere zarar, kuru soket, çene kırığı ve ek tedavi gereksinimi gibi riskler taşıdığını anlıyorum.

Tüm tıbbi öykümü, kullandığım ilaçlar, alerjiler ve rahatsızlıklar dahil olmak üzere eksiksiz şekilde açıkladım. Soru sorma fırsatı verildi ve tüm sorularım yanıtlandı.

Hasta İmzası: _________________________`,
    },
  },
  {
    key: 'root_canal',
    name: { en: 'Root Canal Treatment', ar: 'علاج العصب', tr: 'Kanal Tedavisi' },
    body: {
      en: `CONSENT FOR ROOT CANAL TREATMENT

Patient: {patient_name}
Date: {date}
Clinic: {clinic_name}
Doctor: Dr. {doctor_name}
Procedure: {procedure_name}

I consent to root canal treatment (endodontic therapy) for the tooth described above. I understand this involves removing the infected or damaged pulp, cleaning and shaping the root canals, and sealing them. Risks include but are not limited to: pain, infection, file separation, canal calcification, tooth discoloration, root fracture, and the need for retreatment or extraction.

I understand the tooth will require a permanent restoration (crown or filling) after treatment. I have disclosed my complete medical history and all my questions have been answered.

Patient Signature: _________________________`,
      ar: `موافقة على علاج العصب

المريض: {patient_name}
التاريخ: {date}
العيادة: {clinic_name}
الطبيب: د. {doctor_name}
الإجراء: {procedure_name}

أوافق على علاج العصب (العلاج اللبي) للسن المذكورة أعلاه. أتفهم أن هذا يتضمن إزالة اللب المصاب أو التالف، وتنظيف وتشكيل قنوات الجذور، وختمها. تشمل المخاطر但不限于: الألم، العدوى، كسر الأداة، تكلبس القناة، تغير لون السن، كسر الجذر، والحاجة لإعادة العلاج أو القلع.

أتفهم أن السن ستحتاج إلى ترميم دائم (تاج أو حشوة) بعد العلاج. لقد أفصحت عن تاريخي الطبي الكامل وتمت الإجابة على جميع أسئلتي.

توقيع المريض: _________________________`,
      tr: `KANAL TEDAVİSİ ONAM FORMU

Hasta: {patient_name}
Tarih: {date}
Klinik: {clinic_name}
Doktor: Dr. {doctor_name}
İşlem: {procedure_name}

Yukarıda belirtilen diş için kanal tedavisi (endodontik tedavi) onayı veriyorum. Bu işlemin enfekte veya hasarlı pulpayı çıkarmayı, kök kanallarını temizleyip şekillendirmeyi ve kapatmayı içerdiğini anlıyorum. Ağrı, enfeksiyon, eğe kırılması, kanal kalsifikasyonu, diş renk değişikliği, kök kırığı ve yeniden tedavi veya çekim gereksinimi gibi riskler taşıdığını biliyorum.

Tedaviden sonra dişin kalıcı bir restorasyon (kuron veya dolgu) gerektireceğini anlıyorum. Tüm tıbbi öykümü açıkladım ve tüm sorularım yanıtlandı.

Hasta İmzası: _________________________`,
    },
  },
  {
    key: 'surgery',
    name: { en: 'Oral Surgery', ar: 'جراحة الفم', tr: 'Oral Cerrahi' },
    body: {
      en: `CONSENT FOR ORAL SURGERY

Patient: {patient_name}
Date: {date}
Clinic: {clinic_name}
Doctor: Dr. {doctor_name}
Procedure: {procedure_name}

I consent to the oral surgical procedure described above. I understand that oral surgery carries risks including but not limited to: pain, swelling, infection, bleeding, nerve damage, numbness or tingling of the lip, tongue or chin, damage to adjacent teeth or restorations, jaw fracture, sinus complications, and the need for additional surgery.

I confirm that I have disclosed my complete medical history, including any medications (especially blood thinners), allergies, or conditions. I have fasted as instructed and all my questions have been answered.

Patient Signature: _________________________`,
      ar: `موافقة على جراحة الفم

المريض: {patient_name}
التاريخ: {date}
العيادة: {clinic_name}
الطبيب: د. {doctor_name}
الإجراء: {procedure_name}

أوافق على الإجراء الجراحي في الفم المذكور أعلاه. أتفهم أن جراحة الفم تحمل مخاطر تشمل但不限于: الألم، التورم، العدوى، النزيف، ضرر الأعصاب، تنميل الشفة أو اللسان أو الذقن، ضرر الأسنان المجاورة، كسر الفك، مضاعفات الجيوب الأنفية، والحاجة لجراحة إضافية.

أؤكد أنني أفصحت عن تاريخي الطبي الكامل، بما في ذلك أي أدوية (خاصة مميعات الدم)، حساسية، أو حالات. لقد صمت حسب التعليمات وتمت الإجابة على جميع أسئلتي.

توقيع المريض: _________________________`,
      tr: `ORAL CERRAHİ ONAM FORMU

Hasta: {patient_name}
Tarih: {date}
Klinik: {clinic_name}
Doktor: Dr. {doctor_name}
İşlem: {procedure_name}

Yukarıda belirtilen oral cerrahi işleme onay veriyorum. Oral cerrahinin ağrı, şişlik, enfeksiyon, kanama, sinir hasarı, dudak/dil/çinede uyuşma veya karıncalanma, komşu dişlere zarar, çene kırığı, sinüs komplikasyonları ve ek cerrahi gereksinimi gibi riskler taşıdığını anlıyorum.

Tüm tıbbi öykümü, özellikle kan sulandırıcı ilaçlar, alerjiler ve rahatsızlıklar dahil olmak üzere eksiksiz şekilde açıkladım. Tarif edildiği gibi aç kalarak hazırlandım ve tüm sorularım yanıtlandı.

Hasta İmzası: _________________________`,
    },
  },
  {
    key: 'anesthesia',
    name: { en: 'Anesthesia', ar: 'التخدير', tr: 'Anestezi' },
    body: {
      en: `CONSENT FOR ANESTHESIA

Patient: {patient_name}
Date: {date}
Clinic: {clinic_name}
Doctor: Dr. {doctor_name}
Procedure: {procedure_name}

I consent to the administration of local anesthesia for the dental procedure described above. I understand that anesthesia carries risks including but not limited to: allergic reaction, toxicity, prolonged numbness, infection at injection site, hematoma, and nerve injury.

I confirm that I have disclosed my complete medical history, including any previous adverse reactions to anesthesia, current medications, and allergies. I understand I should not eat or drink until the numbness wears off to avoid injury to my lip, cheek, or tongue.

Patient Signature: _________________________`,
      ar: `موافقة على التخدير

المريض: {patient_name}
التاريخ: {date}
العيادة: {clinic_name}
الطبيب: د. {doctor_name}
الإجراء: {procedure_name}

أوافق على إعطاء التخدير الموضعي للإجراء الأسنان المذكور أعلاه. أتفهم أن التخدير يحمل مخاطر تشمل但不限于: الحساسية، السمية، التنميل المطول، العدوى في موقع الحقن، الورم الدموي، وإصابة الأعصاب.

أؤكد أنني أفصحت عن تاريخي الطبي الكامل، بما في ذلك أي ردود فعل سلبية سابقة للتخدير، الأدوية الحالية، والحساسية. أتفهم أنه يجب علي عدم الأكل أو الشرب حتى يزول التنميل لتجنب إصابة الشفة أو الخد أو اللسان.

توقيع المريض: _________________________`,
      tr: `ANESTEZİ ONAM FORMU

Hasta: {patient_name}
Tarih: {date}
Klinik: {clinic_name}
Doktor: Dr. {doctor_name}
İşlem: {procedure_name}

Yukarıda belirtilen diş işlemi için lokal anestezi uygulanmasına onay veriyorum. Anestezinin alerjik reaksiyon, toksisite, uzun süreli uyuşma, enjeksiyon yerinde enfeksiyon, hematom ve sinir hasarı gibi riskler taşıdığını anlıyorum.

Anesteziye karşı önceki olumsuz reaksiyonlar, mevcut ilaçlar ve alerjiler dahil olmak üzere tıbbi öykümü eksiksiz açıkladım. Uyuşukluk geçene kadar dudağım, yanağım veya dilimde yaralanmayı önlemek için yiyip içmemem gerektiğini anlıyorum.

Hasta İmzası: _________________________`,
    },
  },
  {
    key: 'filling',
    name: { en: 'Filling / Restoration', ar: 'حشوة الأسنان', tr: 'Dolgu / Restorasyon' },
    body: {
      en: `CONSENT FOR FILLING / RESTORATION

Patient: {patient_name}
Date: {date}
Clinic: {clinic_name}
Doctor: Dr. {doctor_name}
Procedure: {procedure_name}

I consent to the placement of a dental filling/restoration for the tooth described above. I understand that this involves removing decayed or damaged tooth structure and restoring it with appropriate material. Risks include but are not limited to: sensitivity, pain, pulp irritation requiring root canal treatment, fracture of the tooth or restoration, and the need for replacement.

I have disclosed my complete medical history and all my questions have been answered.

Patient Signature: _________________________`,
      ar: `موافقة على حشوة الأسنان

المريض: {patient_name}
التاريخ: {date}
العيادة: {clinic_name}
الطبيب: د. {doctor_name}
الإجراء: {procedure_name}

أوافق على وضع حشوة أسنان/ترميم للسن المذكورة أعلاه. أتفهم أن هذا يتضمن إزالة بنية السن المصابة أو التالفة وترميمها بمادة مناسبة. تشمل المخاطر但不限于: الحساسية، الألم، تهيج اللب مما يتطلب علاج العصب، كسر السن أو الترميم، والحاجة للاستبدال.

لقد أفصحت عن تاريخي الطبي الكامل وتمت الإجابة على جميع أسئلتي.

توقيع المريض: _________________________`,
      tr: `DOLGU / RESTORASYON ONAM FORMU

Hasta: {patient_name}
Tarih: {date}
Klinik: {clinic_name}
Doktor: Dr. {doctor_name}
İşlem: {procedure_name}

Yukarıda belirtilen diş için diş dolgusu/restorasyonu yapılmasına onay veriyorum. Bu işlemin çürük veya hasarlı diş yapısını çıkarıp uygun malzeme ile restore etmeyi içerdiğini anlıyorum. Hassasiyet, ağrı, kanal tedavisi gerektiren pulpa irritasyonu, diş veya restorasyon kırığı ve değiştirme gereksinimi gibi riskler taşıdığını biliyorum.

Tüm tıbbi öykümü açıkladım ve tüm sorularım yanıtlandı.

Hasta İmzası: _________________________`,
    },
  },
  {
    key: 'implant',
    name: { en: 'Dental Implant', ar: 'زراعة الأسنان', tr: 'Diş İmplantı' },
    body: {
      en: `CONSENT FOR DENTAL IMPLANT

Patient: {patient_name}
Date: {date}
Clinic: {clinic_name}
Doctor: Dr. {doctor_name}
Procedure: {procedure_name}

I consent to the placement of a dental implant as described above. I understand that implant surgery involves placing a titanium fixture into the jawbone. Risks include but are not limited to: pain, swelling, infection, bleeding, implant failure or rejection, nerve damage, sinus complications, damage to adjacent teeth, and the need for additional procedures such as bone grafting.

I understand that healing takes several months and that a crown will be placed after healing. I have disclosed my complete medical history, including any conditions affecting bone healing (e.g. diabetes, smoking), and all my questions have been answered.

Patient Signature: _________________________`,
      ar: `موافقة على زراعة الأسنان

المريض: {patient_name}
التاريخ: {date}
العيادة: {clinic_name}
الطبيب: د. {doctor_name}
الإجراء: {procedure_name}

أوافق على وضع زراعة أسنان كما هو موصوف أعلاه. أتفهم أن جراحة الزراعة تتضمن وضع برغي تيتانيوم في عظم الفك. تشمل المخاطر但不限于: الألم، التورم، العدوى، النزيف، فشل أو رفض الزراعة، ضرر الأعصاب، مضاعفات الجيوب الأنفية، ضرر الأسنان المجاورة، والحاجة لإجراءات إضافية مثل ترقيع العظم.

أتفهم أن الشفاء يستغرق عدة أشهر وأن التاج سيوضع بعد الشفاء. لقد أفصحت عن تاريخي الطبي الكامل، بما في ذلك أي حالات تؤثر على شفاء العظم (مثل السكري، التدخين)، وتمت الإجابة على جميع أسئلتي.

توقيع المريض: _________________________`,
      tr: `DİŞ İMPLANTI ONAM FORMU

Hasta: {patient_name}
Tarih: {date}
Klinik: {clinic_name}
Doktor: Dr. {doctor_name}
İşlem: {procedure_name}

Yukarıda açıklandığı gibi diş implantı yerleştirilmesine onay veriyorum. İmplant cerrahisinin çene kemiğine bir titanyum vida yerleştirmeyi içerdiğini anlıyorum. Ağrı, şişlik, enfeksiyon, kanama, implant başarısızlığı veya reddi, sinir hasarı, sinüs komplikasyonları, komşu dişlere zarar ve kemik grefti gibi ek işlemler gereksinimi gibi riskler taşıdığını biliyorum.

İyileşmenin birkaç ay sürdüğünü ve iyileşmeden sonra kuron yerleştirileceğini anlıyorum. Kemik iyileşmesini etkileyen durumlar (örn. diyabet, sigara) dahil olmak üzere tıbbi öykümü eksiksiz açıkladım ve tüm sorularım yanıtlandı.

Hasta İmzası: _________________________`,
    },
  },
  {
    key: 'general',
    name: { en: 'General Consent', ar: 'موافقة عامة', tr: 'Genel Onam' },
    body: {
      en: `GENERAL DENTAL CONSENT

Patient: {patient_name}
Date: {date}
Clinic: {clinic_name}
Doctor: Dr. {doctor_name}
Procedure: {procedure_name}

I consent to the dental procedure described above. I understand that dental treatment carries general risks including but not limited to: pain, sensitivity, infection, and the need for additional treatment. I understand that no guarantee can be made regarding the outcome of treatment.

I confirm that I have disclosed my complete medical history, including any medications, allergies, or conditions that may affect treatment. I have had the opportunity to ask questions and all my questions have been answered to my satisfaction.

Patient Signature: _________________________`,
      ar: `موافقة أسنان عامة

المريض: {patient_name}
التاريخ: {date}
العيادة: {clinic_name}
الطبيب: د. {doctor_name}
الإجراء: {procedure_name}

أوافق على الإجراء الأسنان المذكور أعلاه. أتفهم أن علاج الأسنان يحمل مخاطر عامة تشمل但不限于: الألم، الحساسية، العدوى، والحاجة لعلاج إضافي. أتفهم أنه لا يمكن تقديم أي ضمان بشأن نتيجة العلاج.

أؤكد أنني أفصحت عن تاريخي الطبي الكامل، بما في ذلك أي أدوية، حساسية، أو حالات قد تؤثر على العلاج. لقد أتيحت لي الفرصة لطرح الأسئلة وتمت الإجابة على جميع أسئلتي بما يرضيني.

توقيع المريض: _________________________`,
      tr: `GENEL DİŞ ONAM FORMU

Hasta: {patient_name}
Tarih: {date}
Klinik: {clinic_name}
Doktor: Dr. {doctor_name}
İşlem: {procedure_name}

Yukarıda belirtilen diş işlemine onay veriyorum. Diş tedavisinin ağrı, hassasiyet, enfeksiyon ve ek tedavi gereksinimi gibi genel riskler taşıdığını anlıyorum. Tedavi sonucuyla ilgili hiçbir garanti verilemeyeceğini anlıyorum.

Tedaviyi etkileyebilecek ilaçlar, alerjiler ve rahatsızlıklar dahil olmak üzere tıbbi öykümü eksiksiz açıkladım. Soru sorma fırsatı verildi ve tüm sorularım memnuniyetle yanıtlandı.

Hasta İmzası: _________________________`,
    },
  },
];

/** Get a template by key. */
export function getConsentTemplate(key) {
  return CONSENT_TEMPLATES.find(t => t.key === key);
}

/** Fill in the template body with patient/clinic/doctor data. */
export function fillConsentTemplate(template, { patient_name, clinic_name, doctor_name, procedure_name, date, lang }) {
  const body = template.body[lang] || template.body.en;
  return body
    .replace(/\{patient_name\}/g, patient_name || '—')
    .replace(/\{clinic_name\}/g, clinic_name || '—')
    .replace(/\{doctor_name\}/g, doctor_name || '—')
    .replace(/\{procedure_name\}/g, procedure_name || '—')
    .replace(/\{date\}/g, date || '—');
}