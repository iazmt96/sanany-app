import type { PolicyDocument } from "./types";

export const privacyPolicy: PolicyDocument = {
  slug: "privacy",
  ar: {
    title: "سياسة الخصوصية",
    metaTitle: "سياسة الخصوصية | SANANY",
    metaDescription: "سياسة خصوصية منصة SANANY: البيانات التي نجمعها، أغراض المعالجة ومسوغاتها النظامية، مشاركة البيانات، حقوق صاحب البيانات، وأمن المعلومات وفق نظام حماية البيانات الشخصية السعودي.",
    sections: [
      {
        id: "controller-scope",
        title: "1. مسؤول البيانات ونطاق السياسة",
        blocks: [
          { type: "p", text: "مؤسسة سنعني للتسويق الالكتروني هي الجهة المسؤولة عن معالجة البيانات الشخصية في حدود الخدمات التي تديرها. تنطبق هذه السياسة على تطبيق وموقع وخدمات SANANY المرتبطة بالحسابات والإعلانات والمحادثات والمدفوعات والخدمات المساندة." }
        ]
      },
      {
        id: "data-we-collect",
        title: "2. البيانات التي قد نجمعها",
        blocks: [
          {
            type: "ul",
            items: [
              "بيانات الحساب: الاسم، اسم المستخدم، رقم الهاتف، البريد الإلكتروني إن قدمه المستخدم، صورة الحساب، النبذة، ونوع الحساب.",
              "بيانات التحقق: رموز التحقق ونتيجة التحقق والبيانات اللازمة لإتمام التحقق من الهوية عند استخدام مزود معتمد، دون الاحتفاظ بما لا يلزم للخدمة.",
              "بيانات الإعلانات: الصور، الوصف، السعر، التصنيف، خصائص المنتج أو الخدمة، الموقع العام إذا اختاره المستخدم، وحالة الإعلان.",
              "بيانات المحادثات والدعم: الرسائل والمرفقات والبلاغات والمراسلات مع الدعم بالقدر اللازم لتقديم الخدمة والأمن وحل الشكاوى.",
              "بيانات المعاملات: قيمة الخدمة أو العمولة، حالة الدفع، الرقم المرجعي وبيانات الفاتورة أو التحويل اللازمة، دون تخزين بيانات البطاقة الكاملة عندما تتم المعالجة لدى مزود دفع مستقل.",
              "بيانات تقنية واستخدام: عنوان IP، نوع الجهاز، نظام التشغيل، اللغة، سجلات الدخول، معرفات التطبيق، بيانات الأعطال والأداء، والأحداث الأمنية.",
              "بيانات الموقع: موقع تقريبي أو موقع يختاره المستخدم عند استخدام ميزات تعتمد على الموقع؛ ولا يتم استخدام الموقع الدقيق إلا عند تفعيل ميزة تحتاجه وبما يظهر للمستخدم."
            ]
          }
        ]
      },
      {
        id: "data-sources",
        title: "3. مصادر البيانات",
        blocks: [
          { type: "p", text: "نجمع البيانات مباشرة من المستخدم عند التسجيل أو النشر أو التواصل، ومن استخدامه للمنصة، وقد نتلقى بيانات محدودة من مزودي الدفع أو التحقق أو الرسائل أو الخدمات التقنية عند الحاجة لإتمام الخدمة أو منع الاحتيال." }
        ]
      },
      {
        id: "processing-purposes",
        title: "4. أغراض المعالجة",
        blocks: [
          {
            type: "ul",
            items: [
              "إنشاء الحساب وتسجيل الدخول والتحقق منه.",
              "نشر الإعلانات وعرضها والبحث فيها وتخصيص التجربة.",
              "تمكين المحادثات والإشعارات والمفضلة والمتابعة والقصص والميزات الاجتماعية عند تفعيلها.",
              "حساب العمولة ومعالجة المدفوعات وإصدار السجلات والفواتير عند اللزوم.",
              "مكافحة الاحتيال وإساءة الاستخدام وحماية الحسابات والمنصة.",
              "معالجة البلاغات والشكاوى وتقديم الدعم الفني.",
              "تحليل الأداء وتحسين المنتج وإصلاح الأعطال.",
              "الامتثال للمتطلبات النظامية والطلبات الرسمية الملزمة.",
              "إرسال رسائل خدمة ضرورية، وإرسال مواد تسويقية فقط وفق الأساس النظامي المناسب وخيارات المستخدم المتاحة."
            ]
          }
        ]
      },
      {
        id: "legal-basis",
        title: "5. المسوغ النظامي للمعالجة",
        blocks: [
          { type: "p", text: "تتم معالجة البيانات وفق المسوغ النظامي المناسب لكل غرض، مثل تنفيذ الخدمة التي يطلبها المستخدم، والوفاء بالتزام نظامي، وحماية المصالح المشروعة المسموح بها نظامًا، والحصول على الموافقة عندما تكون مطلوبة. ولا تستخدم البيانات لغرض غير متوافق مع الغرض الذي جمعت من أجله إلا وفق ما تسمح به الأنظمة." }
        ]
      },
      {
        id: "data-sharing",
        title: "6. مشاركة البيانات",
        blocks: [
          { type: "p", text: "لا تبيع SANANY البيانات الشخصية للمعلنين أو للغير. وقد تشارك الحد الأدنى اللازم من البيانات مع مزودي الخدمات الذين يساعدون في تشغيل المنصة، مثل الاستضافة والرسائل والتحقق والدفع والتحليلات والأمن، أو مع الجهات الحكومية والقضائية عند وجود أساس أو طلب نظامي." },
          { type: "p", text: "يلتزم مزودو الخدمة، بحسب علاقتهم بالمؤسسة، بضوابط السرية والأمن ومعالجة البيانات في الحدود اللازمة للخدمة." }
        ]
      },
      {
        id: "international-transfers",
        title: "7. نقل البيانات خارج المملكة",
        blocks: [
          { type: "p", text: "قد يستخدم SANANY أو مزودوه بنية تقنية أو خدمات سحابية تتطلب معالجة أو نقل بيانات خارج المملكة. وفي هذه الحالات تطبق المتطلبات النظامية الخاصة بنقل البيانات الشخصية خارج المملكة والضمانات اللازمة بحسب الحالة." }
        ]
      },
      {
        id: "retention",
        title: "8. الاحتفاظ والإتلاف",
        blocks: [
          { type: "p", text: "تحتفظ SANANY بالبيانات للمدة اللازمة لتحقيق أغراض المعالجة أو للمدة التي تتطلبها الأنظمة. وبعد انتهاء الحاجة، يتم حذف البيانات أو إتلافها أو تحويلها إلى بيانات لا تحدد هوية الشخص، ما لم يوجد سبب نظامي للاحتفاظ بها مدة أطول." }
        ]
      },
      {
        id: "security",
        title: "9. أمن المعلومات",
        blocks: [
          { type: "p", text: "تستخدم SANANY تدابير تقنية وتنظيمية مناسبة لحماية البيانات من الوصول أو الاستخدام أو التعديل أو الإفصاح غير المصرح به. ومع ذلك لا يمكن ضمان الأمان المطلق لأي نظام إلكتروني، لذلك ينصح المستخدم بحماية جهازه وبيانات دخوله وعدم مشاركة رموز التحقق." }
        ]
      },
      {
        id: "data-subject-rights",
        title: "10. حقوق صاحب البيانات",
        blocks: [
          { type: "p", text: "وفق نظام حماية البيانات الشخصية ولوائحه، قد يكون للمستخدم -بحسب الحالة- حقوق تشمل العلم بطريقة المعالجة والغرض منها، والوصول إلى بياناته، وطلب الحصول عليها بصيغة واضحة ومقروءة، وطلب تصحيحها أو استكمالها أو تحديثها، وطلب إتلافها عندما تنطبق الشروط النظامية، وسحب الموافقة عندما تكون هي المسوغ للمعالجة وبالقدر الذي يسمح به النظام." },
          { type: "p", text: "لممارسة حق متعلق بالبيانات الشخصية، يرسل المستخدم طلبه إلى info@sanany.com مع المعلومات الكافية للتحقق من الهوية والطلب دون إرسال بيانات حساسة غير لازمة." }
        ]
      },
      {
        id: "cookies",
        title: "11. ملفات الارتباط والتقنيات المشابهة",
        blocks: [
          { type: "p", text: "قد يستخدم الموقع والتطبيق ملفات ارتباط أو معرفات وتقنيات مشابهة لتسجيل الدخول، وحفظ التفضيلات، وتحسين الأداء، والقياس والتحليلات، والأمن. ويمكن أن تتوفر للمستخدم أدوات لإدارة بعض الخيارات بحسب نوع التقنية والخدمة." }
        ]
      },
      {
        id: "notifications-marketing",
        title: "12. الإشعارات والتسويق",
        blocks: [
          { type: "p", text: "ترسل SANANY إشعارات ضرورية مثل رموز التحقق وتنبيهات الأمان وحالة الإعلان والمحادثات والدفع. أما الرسائل التسويقية فتخضع للمتطلبات النظامية وخيارات المستخدم المتاحة لإيقافها عندما يكون ذلك منطبقًا." }
        ]
      },
      {
        id: "minors",
        title: "13. القاصرون",
        blocks: [
          { type: "p", text: "لا تستهدف SANANY جمع بيانات القاصرين دون أساس نظامي مناسب. إذا تبين أن حسابًا يستخدم من شخص غير مكتمل الأهلية دون الموافقة المطلوبة، فقد يتم تقييد الحساب إلى حين استكمال المتطلبات اللازمة." }
        ]
      },
      {
        id: "policy-updates",
        title: "14. تحديث السياسة",
        blocks: [
          { type: "p", text: "يجوز تحديث سياسة الخصوصية عند تغير الخدمات أو الأنظمة أو ممارسات المعالجة. ينشر تاريخ آخر تحديث، وقد تستخدم SANANY إشعارًا إضافيًا عند وجود تغيير جوهري." }
        ]
      },
      {
        id: "contact",
        title: "15. التواصل",
        blocks: [
          { type: "p", text: "للاستفسارات وطلبات الخصوصية وحقوق البيانات: info@sanany.com" }
        ]
      }
    ]
  },
  en: {
    title: "Privacy Policy",
    metaTitle: "Privacy Policy | SANANY",
    metaDescription: "SANANY Privacy Policy: the personal data we collect, purposes and legal bases of processing, data sharing, data subject rights and information security under the Saudi Personal Data Protection Law.",
    sections: [
      {
        id: "controller-scope",
        title: "1. Controller and Scope",
        blocks: [
          { type: "p", text: "Sanany Establishment Digital Marketing is the entity responsible for personal data processing within the services it operates. This Privacy Policy applies to the SANANY app, website and related account, listing, messaging, payment and support services." }
        ]
      },
      {
        id: "data-we-collect",
        title: "2. Personal Data We May Collect",
        blocks: [
          {
            type: "ul",
            items: [
              "Account data: name, username, phone number, email address if provided, profile photo, bio and account type.",
              "Verification data: verification codes, verification results and data necessary to complete identity verification through an approved provider where enabled, without retaining data that is not needed for the service.",
              "Listing data: photos, descriptions, prices, category, item or service attributes, general location where selected by the user, and listing status.",
              "Messaging and support data: messages, attachments, reports and support communications to the extent needed to provide the service, maintain security and handle complaints.",
              "Transaction data: service or commission amount, payment status, transaction reference and necessary invoice or transfer information. Full payment-card details are not stored by SANANY when they are entered and processed directly by an independent payment provider.",
              "Technical and usage data: IP address, device type, operating system, language, login logs, app identifiers, crash and performance data, and security events.",
              "Location data: an approximate location or a location selected by the user for location-based features. Precise location is used only where a feature requires it and the user is appropriately informed."
            ]
          }
        ]
      },
      {
        id: "data-sources",
        title: "3. Sources of Data",
        blocks: [
          { type: "p", text: "We collect information directly from users when they register, post or communicate, and from their use of the Platform. We may also receive limited information from payment, verification, messaging or technical service providers where needed to complete a service or prevent fraud." }
        ]
      },
      {
        id: "processing-purposes",
        title: "4. Purposes of Processing",
        blocks: [
          {
            type: "ul",
            items: [
              "Create, verify and manage accounts and login.",
              "Publish, display, search and manage listings and personalize the experience.",
              "Enable messaging, notifications, favorites, following, stories and social features where available.",
              "Calculate commissions, process payments and maintain required transaction and invoice records.",
              "Prevent fraud and abuse and protect users, accounts and the Platform.",
              "Handle reports, complaints and support requests.",
              "Analyze performance, improve the product and fix errors.",
              "Comply with legal obligations and binding official requests.",
              "Send necessary service messages and, where legally appropriate, marketing communications subject to available user choices."
            ]
          }
        ]
      },
      {
        id: "legal-basis",
        title: "5. Legal Basis for Processing",
        blocks: [
          { type: "p", text: "Personal data is processed under the legal basis appropriate to each purpose, which may include providing a service requested by the user, complying with a legal obligation, pursuing legally permitted legitimate interests, and obtaining consent where consent is required. Data will not be used for an incompatible purpose except as permitted by applicable law." }
        ]
      },
      {
        id: "data-sharing",
        title: "6. Sharing Personal Data",
        blocks: [
          { type: "p", text: "SANANY does not sell users' personal data to advertisers or third parties. We may share the minimum information necessary with service providers that support hosting, messaging, verification, payments, analytics and security, or with government and judicial authorities where there is a valid legal basis or binding request." },
          { type: "p", text: "Service providers are expected, according to their role and relationship with the Establishment, to follow appropriate confidentiality, security and processing requirements." }
        ]
      },
      {
        id: "international-transfers",
        title: "7. International Data Transfers",
        blocks: [
          { type: "p", text: "SANANY or its service providers may use technical infrastructure or cloud services that involve processing or transferring data outside the Kingdom. Where this occurs, applicable Saudi requirements for international transfers of personal data and appropriate safeguards will be followed." }
        ]
      },
      {
        id: "retention",
        title: "8. Retention and Destruction",
        blocks: [
          { type: "p", text: "SANANY retains personal data only for as long as needed for the purposes for which it is processed or for the period required by law. When data is no longer needed, it will be deleted, destroyed or anonymized unless a lawful reason requires or permits longer retention." }
        ]
      },
      {
        id: "security",
        title: "9. Information Security",
        blocks: [
          { type: "p", text: "SANANY uses reasonable technical and organizational measures designed to protect personal data from unauthorized access, use, alteration or disclosure. No electronic system can be guaranteed to be completely secure; users should protect their devices and credentials and never share verification codes." }
        ]
      },
      {
        id: "data-subject-rights",
        title: "10. Data Subject Rights",
        blocks: [
          { type: "p", text: "Under the Saudi Personal Data Protection Law and its regulations, users may have rights depending on the circumstances, including the right to be informed, access personal data, request a readable copy, request correction, completion or updating, request destruction where the legal conditions are met, and withdraw consent where consent is the basis for processing and withdrawal is legally available." },
          { type: "p", text: "To exercise a personal-data right, contact info@sanany.com and provide enough information to verify identity and the request without sending unnecessary sensitive data." }
        ]
      },
      {
        id: "cookies",
        title: "11. Cookies and Similar Technologies",
        blocks: [
          { type: "p", text: "The website and app may use cookies, identifiers and similar technologies for login, preferences, performance, analytics and security. Controls for some technologies may be available depending on the device, service or feature." }
        ]
      },
      {
        id: "notifications-marketing",
        title: "12. Notifications and Marketing",
        blocks: [
          { type: "p", text: "SANANY sends necessary service communications such as verification codes, security alerts, listing status, messages and payment updates. Marketing communications are subject to applicable legal requirements and available user opt-out choices." }
        ]
      },
      {
        id: "minors",
        title: "13. Minors",
        blocks: [
          { type: "p", text: "SANANY does not seek to collect minors' personal data without an appropriate legal basis. If an account is found to be used by a person lacking the required legal capacity without the necessary approval, the account may be restricted until relevant requirements are satisfied." }
        ]
      },
      {
        id: "policy-updates",
        title: "14. Policy Updates",
        blocks: [
          { type: "p", text: "This Privacy Policy may be updated when services, laws or processing practices change. The latest revision date will be published, and SANANY may provide additional notice where a material change occurs." }
        ]
      },
      {
        id: "contact",
        title: "15. Contact",
        blocks: [
          { type: "p", text: "For privacy questions and personal-data rights requests: info@sanany.com" }
        ]
      }
    ]
  }
};
