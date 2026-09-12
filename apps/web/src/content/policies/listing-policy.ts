import type { PolicyDocument } from "./types";

export const listingPolicy: PolicyDocument = {
  slug: "listing-policy",
  ar: {
    title: "سياسة الإعلانات والمحتوى",
    metaTitle: "سياسة الإعلانات والمحتوى | SANANY",
    metaDescription: "سياسة الإعلانات والمحتوى في منصة SANANY: متطلبات الإعلان، المحتوى الممنوع، الأسعار والمعلومات التجارية، الفئات المنظمة، حقوق الصور والنصوص، والمراجعة والبلاغات.",
    sections: [
      {
        id: "general-rule",
        title: "1. المبدأ العام",
        blocks: [
          { type: "p", text: "يجب أن يكون كل إعلان حقيقيًا وواضحًا ومشروعًا، وأن يملك المعلن الحق في عرض السلعة أو الخدمة. يتحمل المعلن مسؤولية دقة العنوان والوصف والصور والسعر والمواصفات والموقع وأي مستندات أو تراخيص لازمة." }
        ]
      },
      {
        id: "listing-requirements",
        title: "2. متطلبات الإعلان",
        blocks: [
          {
            type: "ul",
            items: [
              "اختيار التصنيف المناسب وإدخال البيانات المطلوبة بصورة صحيحة.",
              "استخدام صور واضحة تخص المعروض قدر الإمكان، وعدم استخدام صور تخدع المستخدم بشأن الحالة الفعلية.",
              "توضيح العيوب الجوهرية أو القيود المعروفة التي قد تؤثر في قرار المشتري.",
              "عدم وضع بيانات اتصال أو روابط بقصد تجاوز ميزات الحماية أو التحايل على الأنظمة أو الرسوم متى حظرت المنصة ذلك.",
              "عدم تكرار الإعلان بصورة مزعجة أو نشر إعلانات متعددة لنفس المعروض بغرض السيطرة على نتائج البحث."
            ]
          }
        ]
      },
      {
        id: "prohibited-content",
        title: "3. المحتوى والإعلانات الممنوعة",
        blocks: [
          {
            type: "ul",
            items: [
              "أي سلعة أو خدمة يحظر بيعها أو الإعلان عنها في المملكة العربية السعودية.",
              "المواد المخدرة أو المؤثرات العقلية أو المنتجات غير النظامية ذات الصلة.",
              "الأسلحة أو الذخائر أو المتفجرات أو المواد الخطرة عندما يكون عرضها أو تداولها غير مرخص أو محظورًا.",
              "السلع المسروقة أو مجهولة المصدر على نحو يثير شبهة مشروعة، والمنتجات المقلدة أو المنتهكة للملكية الفكرية.",
              "الهويات والوثائق الرسمية والحسابات البنكية أو الحكومية أو بيانات الدخول أو البيانات الشخصية المعروضة للبيع أو التبادل بصورة غير مشروعة.",
              "الخدمات الاحتيالية أو أدوات الاختراق أو البرمجيات الضارة أو وسائل تجاوز الأنظمة الأمنية.",
              "المحتوى الإباحي أو الخدمات الجنسية غير المشروعة أو المحتوى الذي ينتهك الآداب العامة أو الأنظمة.",
              "القمار أو الرهانات غير النظامية أو أي خدمة مالية أو استثمارية أو ائتمانية تتطلب ترخيصًا دون وجود الترخيص اللازم.",
              "إعلانات انتحال الصفة أو التسويق الهرمي أو الوعود المضللة أو الربح غير الواقعي.",
              "أي محتوى يحرض على العنف أو الكراهية أو التمييز أو يهدد سلامة الآخرين أو ينتهك خصوصيتهم."
            ]
          }
        ]
      },
      {
        id: "prices-commercial-info",
        title: "4. الأسعار والمعلومات التجارية",
        blocks: [
          { type: "p", text: "يجب أن يكون السعر المعلن -عند طلبه- واقعيًا وواضحًا وألا يستخدم سعرًا وهميًا لجذب الزيارات. ويجب على البائع التجاري أو مقدم الخدمة الالتزام بالمتطلبات النظامية الخاصة بالإفصاح والسعر والفواتير والضمانات متى كانت منطبقة عليه." }
        ]
      },
      {
        id: "regulated-categories",
        title: "5. السيارات والعقارات والفئات المنظمة",
        blocks: [
          { type: "p", text: "في الفئات التي تتطلب بيانات خاصة مثل السيارات أو العقارات أو الأنشطة المهنية، يجب إدخال المعلومات النظامية والمواصفات بدقة والامتناع عن نشر ادعاء ملكية أو ترخيص أو تفويض غير صحيح. وقد تطلب SANANY مستندات أو تحققًا إضافيًا لبعض الفئات." }
        ]
      },
      {
        id: "photo-text-rights",
        title: "6. حقوق الصور والنصوص",
        blocks: [
          { type: "p", text: "لا يجوز رفع صور أو نصوص أو شعارات لا يملك المستخدم حق استخدامها. ويجب إزالة البيانات الشخصية غير اللازمة من الصور والمستندات قبل نشرها قدر الإمكان." }
        ]
      },
      {
        id: "review-removal",
        title: "7. المراجعة والإزالة",
        blocks: [
          { type: "p", text: "يجوز لـSANANY استخدام أدوات آلية أو مراجعة بشرية لرصد الإعلانات، ويجوز رفض أو تعديل تصنيف أو إخفاء أو إزالة إعلان مخالف أو مشتبه فيه، وطلب معلومات إضافية من المعلن عند الحاجة." }
        ]
      },
      {
        id: "reporting",
        title: "8. البلاغات",
        blocks: [
          { type: "p", text: "يمكن الإبلاغ عن إعلان مخالف من خلال أدوات البلاغ داخل المنصة أو عبر info@sanany.com. وقد تطلب SANANY معلومات أو مستندات تدعم البلاغ قبل اتخاذ إجراء نهائي." }
        ]
      }
    ]
  },
  en: {
    title: "Listings and Content Policy",
    metaTitle: "Listings and Content Policy | SANANY",
    metaDescription: "SANANY Listings and Content Policy: listing requirements, prohibited listings and content, pricing and commercial information, regulated categories, rights in photos and text, review and reporting.",
    sections: [
      {
        id: "general-rule",
        title: "1. General Rule",
        blocks: [
          { type: "p", text: "Every listing must be genuine, clear and lawful, and the advertiser must have the right to offer the item or service. The advertiser is responsible for the accuracy of the title, description, images, price, specifications, location and any required documents or licenses." }
        ]
      },
      {
        id: "listing-requirements",
        title: "2. Listing Requirements",
        blocks: [
          {
            type: "ul",
            items: [
              "Select the correct category and provide required information accurately.",
              "Use clear images that relate to the actual item or service where possible, and do not use imagery that materially misrepresents its condition.",
              "Disclose known material defects or restrictions that could reasonably affect a buyer's decision.",
              "Do not insert contact details or external links to bypass safety features, fees or platform rules where SANANY prohibits that behavior.",
              "Do not spam duplicate listings or post multiple copies of the same item to dominate search results."
            ]
          }
        ]
      },
      {
        id: "prohibited-content",
        title: "3. Prohibited Listings and Content",
        blocks: [
          {
            type: "ul",
            items: [
              "Any item or service whose sale, supply or advertising is prohibited in Saudi Arabia.",
              "Illegal narcotics, psychotropic substances or related unlawful products.",
              "Weapons, ammunition, explosives or hazardous materials where offering or trading them is prohibited or not duly licensed.",
              "Stolen goods, goods of suspicious unlawful origin, counterfeit products or items infringing intellectual property rights.",
              "Official IDs or documents, bank or government accounts, login credentials, or personal data offered for unlawful sale or exchange.",
              "Fraudulent services, hacking tools, malware or tools designed to bypass security systems.",
              "Pornographic content, unlawful sexual services, or content that violates public morals or applicable law.",
              "Unlawful gambling or betting, or financial, investment or credit services requiring a license where the required license is not held.",
              "Impersonation listings, pyramid schemes, deceptive promises or unrealistic earnings claims.",
              "Content that incites violence, hatred or unlawful discrimination, threatens safety, or violates another person's privacy."
            ]
          }
        ]
      },
      {
        id: "prices-commercial-info",
        title: "4. Prices and Commercial Information",
        blocks: [
          { type: "p", text: "Where a price is required, it must be genuine and clear and must not be a fake amount designed only to attract traffic. Commercial sellers and service providers must comply with any applicable legal requirements concerning disclosure, pricing, invoices, warranties and consumer rights." }
        ]
      },
      {
        id: "regulated-categories",
        title: "5. Vehicles, Real Estate and Regulated Categories",
        blocks: [
          { type: "p", text: "For categories that require specific information, such as vehicles, real estate or professional services, users must provide accurate specifications and legally required information and must not make false ownership, license or authorization claims. SANANY may request additional documentation or verification for certain categories." }
        ]
      },
      {
        id: "photo-text-rights",
        title: "6. Rights in Photos and Text",
        blocks: [
          { type: "p", text: "Users may not upload images, text or logos they do not have the right to use. Unnecessary personal data should be removed from photos and documents before publication whenever reasonably possible." }
        ]
      },
      {
        id: "review-removal",
        title: "7. Review and Removal",
        blocks: [
          { type: "p", text: "SANANY may use automated tools or human review to monitor listings and may reject, re-categorize, hide or remove a violating or suspicious listing, or request additional information from the advertiser where needed." }
        ]
      },
      {
        id: "reporting",
        title: "8. Reporting",
        blocks: [
          { type: "p", text: "A listing may be reported through in-app reporting tools or by contacting info@sanany.com. SANANY may request information or documents supporting the report before taking final action." }
        ]
      }
    ]
  }
};
