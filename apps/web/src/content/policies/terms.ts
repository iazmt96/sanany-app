import type { PolicyDocument } from "./types";

export const termsPolicy: PolicyDocument = {
  slug: "terms",
  ar: {
    title: "شروط الاستخدام",
    metaTitle: "شروط الاستخدام | SANANY",
    metaDescription: "شروط استخدام منصة SANANY التي تديرها مؤسسة سنعني للتسويق الالكتروني: الأهلية والحساب، التزامات المستخدم، المعاملات، الملكية الفكرية، والمسؤولية وفق أنظمة المملكة العربية السعودية.",
    sections: [
      {
        id: "definitions",
        title: "1. التعريفات والقبول",
        blocks: [
          { type: "p", text: "تشير كلمات «سنعني» و«SANANY» و«المنصة» و«نحن» إلى مؤسسة سنعني للتسويق الالكتروني والخدمات الرقمية التي تديرها. ويقصد بـ«المستخدم» كل شخص أو منشأة تستخدم المنصة، وبـ«المعلن» كل مستخدم ينشر إعلانًا أو يعرض سلعة أو خدمة." },
          { type: "p", text: "باستخدام المنصة أو إنشاء حساب أو نشر إعلان أو استخدام أي خدمة مدفوعة، يقر المستخدم بأنه قرأ هذه الشروط وفهمها ووافق عليها، إضافة إلى السياسات الأخرى المنشورة في SANANY." }
        ]
      },
      {
        id: "platform-role",
        title: "2. دور المنصة",
        blocks: [
          { type: "p", text: "SANANY منصة تقنية للإعلانات والتواصل بين المستخدمين، ما لم يذكر صراحة أن خدمة معينة تقدمها المؤسسة مباشرة. لا تصبح المؤسسة بائعًا أو مشتريًا لمجرد استضافة إعلان أو تمكين التواصل أو الدفع مقابل خدمة للمنصة." },
          { type: "p", text: "يتحمل البائع والمشتري مسؤولية التحقق من السلعة أو الخدمة والطرف الآخر والسعر والمستندات والتسليم وأي متطلبات نظامية تخص الصفقة بينهما." }
        ]
      },
      {
        id: "eligibility",
        title: "3. الأهلية والحساب",
        blocks: [
          { type: "p", text: "يجب أن يكون المستخدم قادرًا نظامًا على استخدام الخدمة وإبرام المعاملات ذات الصلة. وإذا كان المستخدم غير مكتمل الأهلية، فيلزم استخدام المنصة بموافقة الولي أو الوصي وفق الأنظمة." },
          { type: "p", text: "قد تتضمن الحسابات نوع «فرد» أو «شركة/منشأة»، ويجب إدخال بيانات صحيحة وحديثة. وقد تستخدم SANANY رقم الهاتف ورمز التحقق أو وسائل تحقق إضافية مثل خدمات التحقق من الهوية عند تفعيلها." },
          {
            type: "ul",
            items: [
              "عدم مشاركة رمز التحقق أو بيانات الدخول مع الآخرين.",
              "عدم إنشاء حساب باسم شخص أو منشأة دون تفويض.",
              "إبلاغ SANANY عند الاشتباه في استخدام غير مصرح به للحساب.",
              "المحافظة على تحديث بيانات الحساب الأساسية."
            ]
          }
        ]
      },
      {
        id: "user-obligations",
        title: "4. التزامات المستخدم",
        blocks: [
          {
            type: "ul",
            items: [
              "استخدام المنصة بطريقة مشروعة وحسنة النية.",
              "عدم نشر معلومات كاذبة أو مضللة أو انتحال صفة شخص آخر.",
              "عدم محاولة اختراق المنصة أو تجاوز القيود التقنية أو إساءة استخدام واجهات البرمجة أو جمع البيانات آليًا دون إذن.",
              "عدم إرسال رسائل مزعجة أو روابط ضارة أو استخدام المحادثات للتهديد أو التحرش أو الاحتيال.",
              "احترام حقوق الملكية الفكرية والخصوصية وحقوق المستخدمين الآخرين."
            ]
          }
        ]
      },
      {
        id: "user-transactions",
        title: "5. المعاملات بين المستخدمين",
        blocks: [
          { type: "p", text: "أي تفاوض أو اتفاق أو تسليم أو استلام أو ضمان يتعلق بالسلع أو الخدمات المعروضة يتم بين الأطراف أنفسهم، ما لم تنص SANANY صراحة على خدمة مختلفة." },
          { type: "p", text: "ينصح المستخدم بالتحقق من هوية الطرف الآخر، وفحص السلعة أو المستندات ذات الصلة، وعدم تحويل مبالغ خارج الوسائل الموثوقة قبل التحقق الكافي." }
        ]
      },
      {
        id: "messaging",
        title: "6. المحادثات والتواصل",
        blocks: [
          { type: "p", text: "توفر SANANY أدوات للتواصل بين المستخدمين. يمنع استخدام هذه الأدوات لنشر محتوى غير مشروع أو مسيء أو لطلب بيانات حساسة دون حاجة مشروعة أو لإرسال رسائل جماعية مزعجة." },
          { type: "p", text: "يجوز للمنصة استخدام أنظمة آلية أو مراجعة محدودة عند الحاجة للأمن ومكافحة الاحتيال والتحقيق في البلاغات، وذلك وفق الأنظمة وسياسة الخصوصية." }
        ]
      },
      {
        id: "ratings-reports",
        title: "7. التقييمات والبلاغات",
        blocks: [
          { type: "p", text: "يجب أن تكون التقييمات مبنية على تجربة حقيقية وألا تتضمن ابتزازًا أو إساءة أو معلومات مضللة. يجوز لـSANANY حذف أو تقييد التقييمات المخالفة." },
          { type: "p", text: "يمكن للمستخدم الإبلاغ عن إعلان أو حساب أو رسالة يشتبه في مخالفتها. وتراجع SANANY البلاغات وتتخذ الإجراء المناسب بحسب المعلومات المتاحة وطبيعة المخالفة." }
        ]
      },
      {
        id: "suspension",
        title: "8. التعليق والحظر وإنهاء الحساب",
        blocks: [
          { type: "p", text: "يجوز لـSANANY إزالة محتوى أو تقييد ميزة أو تعليق حساب أو حظره عند الاشتباه المعقول بوجود احتيال أو إساءة استخدام أو مخالفة لهذه السياسات أو للأنظمة، مع مراعاة طبيعة الحالة وما يلزم نظامًا." },
          { type: "p", text: "يجوز للمستخدم طلب حذف حسابه، مع احتفاظ المؤسسة بالبيانات التي يلزم أو يسمح بالاحتفاظ بها نظامًا، مثل السجلات اللازمة للمدفوعات أو مكافحة الاحتيال أو تسوية النزاعات." }
        ]
      },
      {
        id: "intellectual-property",
        title: "9. الملكية الفكرية",
        blocks: [
          { type: "p", text: "تعود حقوق اسم وشعار SANANY وتصميماتها وبرمجياتها ومحتواها المملوك لها إلى المؤسسة أو أصحاب الحقوق المرخصين لها. لا يجوز نسخها أو إعادة استخدامها تجاريًا دون إذن." },
          { type: "p", text: "يحتفظ المستخدم بحقوقه في المحتوى الذي يرفعه، ويمنح SANANY ترخيصًا غير حصري بالقدر اللازم لاستضافة المحتوى وعرضه ومعالجته تقنيًا لتقديم الخدمة وتشغيلها والترويج للإعلان داخل المنصة خلال فترة نشره." }
        ]
      },
      {
        id: "availability",
        title: "10. توفر الخدمة والتحديثات",
        blocks: [
          { type: "p", text: "قد تتوقف بعض الخدمات مؤقتًا بسبب الصيانة أو التحديثات أو الأعطال أو عوامل خارجة عن السيطرة. ويجوز لـSANANY تعديل أو إضافة أو إيقاف ميزات متى كان ذلك مناسبًا، مع نشر ما يلزم من إشعارات عند وجود تغيير جوهري يؤثر على المستخدمين." }
        ]
      },
      {
        id: "liability",
        title: "11. المسؤولية",
        blocks: [
          { type: "p", text: "تسعى SANANY إلى توفير بيئة آمنة وموثوقة، إلا أنها لا تضمن صحة جميع الإعلانات أو جودة أو سلامة كل سلعة أو خدمة يعرضها المستخدمون. وتكون مسؤولية المؤسسة في جميع الأحوال ضمن الحدود التي تسمح بها الأنظمة، ولا ينتقص أي بند من حق لا يجوز إسقاطه نظامًا." }
        ]
      },
      {
        id: "governing-law",
        title: "12. النظام الواجب التطبيق",
        blocks: [
          { type: "p", text: "تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص الجهات والمحاكم السعودية المختصة بالنزاعات التي لا تتم تسويتها وديًا، وفق قواعد الاختصاص المعمول بها." }
        ]
      },
      {
        id: "contact",
        title: "13. التواصل",
        blocks: [
          { type: "p", text: "للاستفسارات أو البلاغات أو الطلبات المتعلقة بهذه الشروط: info@sanany.com" }
        ]
      }
    ]
  },
  en: {
    title: "Terms of Use",
    metaTitle: "Terms of Use | SANANY",
    metaDescription: "Terms of Use for the SANANY platform operated by Sanany Establishment Digital Marketing: eligibility and accounts, user obligations, transactions, intellectual property and liability under the laws of Saudi Arabia.",
    sections: [
      {
        id: "definitions",
        title: "1. Definitions and Acceptance",
        blocks: [
          { type: "p", text: "\u201CSANANY\u201D, \u201Cthe Platform\u201D, \u201Cwe\u201D, \u201Cus\u201D and \u201Cour\u201D refer to Sanany Establishment Digital Marketing and the digital services it operates. \u201CUser\u201D means any individual or entity using the Platform, and \u201CSeller\u201D or \u201CAdvertiser\u201D means a user who posts a listing or offers goods or services." },
          { type: "p", text: "By using the Platform, creating an account, posting a listing or purchasing a paid SANANY service, the user confirms that they have read, understood and agreed to these Terms together with the other policies published on SANANY." }
        ]
      },
      {
        id: "platform-role",
        title: "2. Role of the Platform",
        blocks: [
          { type: "p", text: "SANANY is a technology marketplace and communications platform unless a specific service is expressly stated to be provided directly by the Establishment. The Establishment does not become the seller or buyer merely because it hosts a listing, enables communication, or receives payment for a SANANY service." },
          { type: "p", text: "The seller and buyer remain responsible for checking the item or service, the counterparty, price, documents, delivery, and any regulatory requirements applicable to their transaction." }
        ]
      },
      {
        id: "eligibility",
        title: "3. Eligibility and Accounts",
        blocks: [
          { type: "p", text: "Users must have the legal capacity required to use the relevant service and enter into related transactions. If a user lacks full legal capacity, use of the Platform must be with the approval of a parent or legal guardian where required by applicable law." },
          { type: "p", text: "Accounts may be offered as individual or business/company accounts. Users must provide accurate and current information. SANANY may use phone verification, one-time codes, and additional identity-verification services where enabled." },
          {
            type: "ul",
            items: [
              "Do not share verification codes or login credentials.",
              "Do not create an account in another person's or entity's name without authorization.",
              "Notify SANANY if unauthorized account use is suspected.",
              "Keep core account information reasonably up to date."
            ]
          }
        ]
      },
      {
        id: "user-obligations",
        title: "4. User Obligations",
        blocks: [
          {
            type: "ul",
            items: [
              "Use the Platform lawfully and in good faith.",
              "Do not publish false or misleading information or impersonate another person or entity.",
              "Do not attempt to breach the Platform, bypass technical restrictions, misuse APIs, or scrape data without authorization.",
              "Do not send spam, harmful links, threats, harassment or fraudulent messages.",
              "Respect intellectual property, privacy and the rights of other users."
            ]
          }
        ]
      },
      {
        id: "user-transactions",
        title: "5. User-to-User Transactions",
        blocks: [
          { type: "p", text: "Any negotiation, agreement, delivery, receipt or warranty relating to goods or services listed by users is between those users unless SANANY expressly states otherwise for a particular service." },
          { type: "p", text: "Users should verify the counterparty, inspect the item and relevant documents, and avoid sending funds through untrusted channels before sufficient verification." }
        ]
      },
      {
        id: "messaging",
        title: "6. Messaging and Communications",
        blocks: [
          { type: "p", text: "SANANY may provide messaging tools between users. These tools must not be used for unlawful or abusive content, unnecessary collection of sensitive information, spam, threats, harassment or fraud." },
          { type: "p", text: "The Platform may use automated systems or limited review where needed for security, fraud prevention and investigation of reports, subject to applicable law and the Privacy Policy." }
        ]
      },
      {
        id: "ratings-reports",
        title: "7. Ratings and Reports",
        blocks: [
          { type: "p", text: "Ratings must reflect a genuine experience and must not be used for extortion, abuse or deception. SANANY may remove or restrict ratings that violate these rules." },
          { type: "p", text: "Users may report listings, accounts or messages suspected of violating these policies. SANANY will review reports and may take action based on the information available and the nature of the issue." }
        ]
      },
      {
        id: "suspension",
        title: "8. Suspension, Restriction and Termination",
        blocks: [
          { type: "p", text: "SANANY may remove content, restrict a feature, suspend an account or block it where there is a reasonable concern of fraud, abuse, a policy violation or unlawful activity, subject to the nature of the matter and applicable legal requirements." },
          { type: "p", text: "Users may request account deletion. The Establishment may retain information that it is required or permitted to retain by law, including records necessary for payments, fraud prevention or dispute handling." }
        ]
      },
      {
        id: "intellectual-property",
        title: "9. Intellectual Property",
        blocks: [
          { type: "p", text: "The SANANY name, logo, designs, software and SANANY-owned content belong to the Establishment or its licensors and may not be copied or commercially reused without permission." },
          { type: "p", text: "Users retain their rights in content they upload and grant SANANY a non-exclusive license to host, display and technically process that content as reasonably necessary to provide the service and promote the listing within the Platform while it is active." }
        ]
      },
      {
        id: "availability",
        title: "10. Service Availability and Changes",
        blocks: [
          { type: "p", text: "Some services may be temporarily unavailable due to maintenance, updates, failures or circumstances outside reasonable control. SANANY may modify, add or discontinue features and will provide appropriate notice where a material change affects users." }
        ]
      },
      {
        id: "liability",
        title: "11. Liability",
        blocks: [
          { type: "p", text: "SANANY works to provide a safe and trustworthy environment but cannot guarantee the accuracy of every user listing or the quality or safety of every item or service offered by users. The Establishment's liability is subject to the limits permitted by applicable law, and nothing in these Terms excludes a right or liability that cannot legally be excluded." }
        ]
      },
      {
        id: "governing-law",
        title: "12. Governing Law",
        blocks: [
          { type: "p", text: "These Terms are governed by the laws of the Kingdom of Saudi Arabia. Disputes that are not resolved amicably are subject to the competent Saudi authorities and courts in accordance with applicable jurisdiction rules." }
        ]
      },
      {
        id: "contact",
        title: "13. Contact",
        blocks: [
          { type: "p", text: "For questions, reports or requests relating to these Terms: info@sanany.com" }
        ]
      }
    ]
  }
};
