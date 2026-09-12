import type { PolicyDocument } from "./types";

export const paymentPolicy: PolicyDocument = {
  slug: "payment-policy",
  ar: {
    title: "سياسة الدفع والعمولة",
    metaTitle: "سياسة الدفع والعمولة | SANANY",
    metaDescription: "سياسة الدفع والعمولة في منصة SANANY: عمولة 1% من سعر البيع النهائي الفعلي، طريقة حساب العمولة، مزودو الدفع، التحويل البنكي، الخدمات الترويجية المدفوعة، والضرائب والاعتراضات.",
    sections: [
      {
        id: "commission",
        title: "1. عمولة SANANY",
        blocks: [
          { type: "p", text: "تستحق SANANY عمولة بنسبة 1% من سعر البيع النهائي الفعلي عندما تتم الصفقة التي ينطبق عليها نظام العمولة في المنصة. ويقصد بسعر البيع النهائي المبلغ الذي اتفق عليه البائع والمشتري وأتمت به الصفقة، وليس بالضرورة السعر الأصلي المكتوب في الإعلان." }
        ]
      },
      {
        id: "commission-calculation",
        title: "2. حساب العمولة",
        blocks: [
          { type: "p", text: "تحسب العمولة وفق المعادلة التالية: سعر البيع النهائي × 1%. مثال: إذا تم البيع بمبلغ 50,000 ريال، تكون العمولة 500 ريال." },
          { type: "p", text: "يلتزم البائع بإدخال سعر البيع النهائي بصورة صحيحة عند إتمام البيع، ويحظر إدخال مبلغ صوري أو مخفض بقصد تقليل العمولة." }
        ]
      },
      {
        id: "sale-completion",
        title: "3. إتمام البيع وحالة الإعلان",
        blocks: [
          { type: "p", text: "عند استخدام مسار «تحويل العمولة وإتمام البيع» أو ما يماثله، لا تنتقل حالة الإعلان إلى «تم البيع» من خلال هذا المسار إلا بعد تأكيد سداد العمولة بالطريقة المعتمدة، سواء عبر الدفع الإلكتروني أو بعد اعتماد التحويل البنكي من الفريق عند توفر هذه الوسيلة." }
        ]
      },
      {
        id: "payment-providers",
        title: "4. مزودو الدفع",
        blocks: [
          { type: "p", text: "قد تتم عمليات الدفع عبر مزود دفع إلكتروني مستقل. تخضع معالجة بيانات الدفع الفنية لشروط وسياسات المزود المعني إلى جانب هذه السياسة. لا تخزن SANANY بيانات البطاقة البنكية الكاملة إذا كانت تدخل وتعالج مباشرة لدى مزود الدفع." }
        ]
      },
      {
        id: "bank-transfers",
        title: "5. التحويل البنكي",
        blocks: [
          { type: "p", text: "إذا أتاحت SANANY سداد العمولة أو الخدمة بتحويل بنكي، فقد تتطلب العملية رفع إثبات التحويل ومراجعته قبل اعتبارها مدفوعة. ويجب أن يطابق مبلغ التحويل المبلغ المستحق الظاهر في المنصة." }
        ]
      },
      {
        id: "failed-delayed-payments",
        title: "6. فشل أو تأخر الدفع",
        blocks: [
          { type: "p", text: "قد تتأخر حالة الدفع بسبب البنك أو مزود الدفع أو الاتصال أو التحقق الأمني. لا تعتبر العملية ناجحة إلا بعد استلام SANANY تأكيدًا موثوقًا من قناة الدفع. عند وجود خصم دون تحديث الحالة، يجب التواصل عبر info@sanany.com مع الرقم المرجعي للعملية." }
        ]
      },
      {
        id: "promotional-services",
        title: "7. الخدمات الترويجية المدفوعة",
        blocks: [
          { type: "p", text: "قد توفر SANANY خدمات مثل تمييز الإعلان أو رفعه أو تثبيته أو باقات للشركات. يوضح السعر والمدة والمزايا قبل الشراء. شراء خدمة ترويجية لا يضمن بيع المعروض ولا عددًا محددًا من المشاهدات أو الرسائل إلا إذا نص وصف الخدمة صراحة على مقياس محدد." }
        ]
      },
      {
        id: "taxes-charges",
        title: "8. الضرائب والرسوم النظامية",
        blocks: [
          { type: "p", text: "قد تضاف أي ضريبة أو رسم نظامي واجب التطبيق على الخدمات المدفوعة بحسب حالة المؤسسة والخدمة وما يظهر للمستخدم وقت الدفع. وتصدر الفواتير أو السجلات المطلوبة نظامًا عند انطباق المتطلبات ذات الصلة." }
        ]
      },
      {
        id: "commission-evasion",
        title: "9. التحايل على العمولة",
        blocks: [
          { type: "p", text: "يمنع تقديم معلومات غير صحيحة أو استخدام وسائل مصطنعة لإخفاء سعر البيع الحقيقي أو تفادي العمولة المستحقة. وقد يؤدي ذلك إلى طلب إثباتات أو تقييد الخدمات أو تعليق الحساب بحسب جسامة الحالة." }
        ]
      },
      {
        id: "disputes-unauthorized",
        title: "10. الاعتراضات والعمليات غير المصرح بها",
        blocks: [
          { type: "p", text: "إذا اشتبه المستخدم في عملية دفع غير مصرح بها أو مكررة، فعليه التواصل فورًا عبر info@sanany.com وإبلاغ مزود الدفع أو البنك عند الحاجة. وتراجع SANANY السجلات المتاحة وتتعاون ضمن ما تسمح به الأنظمة." }
        ]
      }
    ]
  },
  en: {
    title: "Payments and Commission Policy",
    metaTitle: "Payments and Commission Policy | SANANY",
    metaDescription: "SANANY Payments and Commission Policy: 1% commission on the actual final sale price, commission calculation, payment providers, bank transfers, paid promotional services, taxes and dispute handling.",
    sections: [
      {
        id: "commission",
        title: "1. SANANY Commission",
        blocks: [
          { type: "p", text: "SANANY charges a 1% commission on the actual final sale price when a transaction is subject to the Platform's commission flow. The final sale price means the amount agreed and actually used to complete the sale, which may differ from the original advertised price." }
        ]
      },
      {
        id: "commission-calculation",
        title: "2. Commission Calculation",
        blocks: [
          { type: "p", text: "Commission is calculated as: final sale price × 1%. Example: if an item is sold for SAR 50,000, the SANANY commission is SAR 500." },
          { type: "p", text: "The seller must enter the actual final sale price when completing the sale and must not enter an artificial or reduced amount to avoid commission." }
        ]
      },
      {
        id: "sale-completion",
        title: "3. Completing a Sale and Listing Status",
        blocks: [
          { type: "p", text: "When using the \u201CPay Commission and Complete Sale\u201D flow or an equivalent feature, the listing will not be moved to \u201CSold\u201D through that flow until the commission payment is confirmed using an approved method, whether by electronic payment or by SANANY approval of a bank transfer where that option is available." }
        ]
      },
      {
        id: "payment-providers",
        title: "4. Payment Providers",
        blocks: [
          { type: "p", text: "Payments may be processed by an independent electronic payment provider. Technical payment-data processing is also subject to the provider's terms and policies. SANANY does not store full card details when those details are entered and processed directly by the payment provider." }
        ]
      },
      {
        id: "bank-transfers",
        title: "5. Bank Transfers",
        blocks: [
          { type: "p", text: "If SANANY allows commission or service payments by bank transfer, the user may be required to upload proof of transfer for review before the payment is marked as completed. The transferred amount must match the amount due in the Platform." }
        ]
      },
      {
        id: "failed-delayed-payments",
        title: "6. Failed or Delayed Payments",
        blocks: [
          { type: "p", text: "Payment status may be delayed because of a bank, payment provider, connectivity issue or security verification. A payment is not treated as successful until SANANY receives reliable confirmation from the relevant payment channel. If an amount is charged but the Platform status does not update, contact info@sanany.com with the transaction reference." }
        ]
      },
      {
        id: "promotional-services",
        title: "7. Paid Promotional Services",
        blocks: [
          { type: "p", text: "SANANY may offer paid services such as featured listings, bumps, pinning or business packages. The price, duration and features will be shown before purchase. Purchasing a promotional service does not guarantee a sale or a specific number of views or messages unless the service description expressly provides a specific metric." }
        ]
      },
      {
        id: "taxes-charges",
        title: "8. Taxes and Regulatory Charges",
        blocks: [
          { type: "p", text: "Any applicable tax or regulatory charge may be added to paid services depending on the Establishment's status, the service and the information shown at checkout. Required invoices or transaction records will be issued where applicable." }
        ]
      },
      {
        id: "commission-evasion",
        title: "9. Commission Evasion",
        blocks: [
          { type: "p", text: "Providing false information or using artificial methods to conceal the true final sale price or evade a due commission is prohibited. SANANY may request supporting evidence, restrict features or suspend an account depending on the seriousness of the matter." }
        ]
      },
      {
        id: "disputes-unauthorized",
        title: "10. Disputes and Unauthorized Charges",
        blocks: [
          { type: "p", text: "If a user suspects an unauthorized or duplicate payment, they should contact info@sanany.com promptly and notify the payment provider or bank where appropriate. SANANY will review available records and cooperate to the extent permitted by law." }
        ]
      }
    ]
  }
};
