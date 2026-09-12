import type { PolicyDocument } from "./types";

export const refundPolicy: PolicyDocument = {
  slug: "refund-policy",
  ar: {
    title: "سياسة الاسترجاع والاسترداد",
    metaTitle: "سياسة الاسترجاع والاسترداد | SANANY",
    metaDescription: "سياسة الاسترجاع والاسترداد في منصة SANANY: نطاق السياسة، السلع والخدمات بين المستخدمين، خدمات SANANY المدفوعة، عمولة البيع، الخصم المكرر، وكيفية طلب الاسترداد.",
    sections: [
      {
        id: "scope",
        title: "1. نطاق السياسة",
        blocks: [
          { type: "p", text: "تنظم هذه السياسة المبالغ التي تدفع إلى SANANY مقابل خدمات المنصة أو العمولة. أما ثمن السلعة أو الخدمة التي يبيعها مستخدم لمستخدم آخر خارج كون SANANY بائعًا مباشرًا، فتخضع علاقة الاسترجاع والاستبدال بين أطراف الصفقة والأنظمة التي تنطبق عليهم." }
        ]
      },
      {
        id: "user-to-user",
        title: "2. السلع والخدمات بين المستخدمين",
        blocks: [
          { type: "p", text: "SANANY ليست مسؤولة تلقائيًا عن قبول إرجاع سلعة أو إعادة ثمن دفعه المشتري مباشرة للبائع. ويجب على المشتري والبائع الاتفاق على التسليم والفحص والاسترجاع والضمان، مع الالتزام بأي حقوق إلزامية يقررها النظام على البائع أو مقدم الخدمة." }
        ]
      },
      {
        id: "paid-services",
        title: "3. خدمات SANANY المدفوعة",
        blocks: [
          { type: "p", text: "تراجع طلبات إلغاء أو استرداد الخدمات الرقمية المدفوعة بحسب حالة الخدمة والأنظمة السارية. وقد يكون الاسترداد متاحًا، كليًا أو جزئيًا بحسب الحالة، عندما لم تبدأ الخدمة أو حصل خصم مكرر أو فشلت الخدمة تقنيًا ولم يستفد منها المستخدم." },
          { type: "p", text: "إذا تم تنفيذ الخدمة أو تفعيل الميزة والاستفادة منها، فقد يكون الاسترداد مقيدًا بالقدر الذي تسمح به الأنظمة، مع عدم الإخلال بأي حق إلزامي للمستهلك." }
        ]
      },
      {
        id: "sale-commission",
        title: "4. عمولة البيع",
        blocks: [
          { type: "p", text: "إذا دفعت العمولة ثم تبين أن عملية البيع لم تكتمل أو ألغيت بعد ذلك، لا يتم الاسترداد آليًا. يمكن للبائع تقديم طلب مراجعة إلى info@sanany.com مع بيانات الإعلان والعملية والأدلة المتاحة، وتراجع SANANY الحالة وفق الوقائع والأنظمة والسياسات المطبقة وقت العملية." }
        ]
      },
      {
        id: "duplicate-charges",
        title: "5. حالات الخصم المكرر أو الخطأ التقني",
        blocks: [
          { type: "p", text: "إذا ثبت وجود خصم مكرر أو مبلغ محصل بالخطأ لصالح SANANY، تتم معالجة التصحيح أو الاسترداد وفق وسيلة الدفع والمدة الفنية لدى البنك أو مزود الدفع." }
        ]
      },
      {
        id: "violations",
        title: "6. المخالفات",
        blocks: [
          { type: "p", text: "لا ينشأ حق تلقائي في استرداد قيمة خدمة استُخدمت بالفعل لمجرد إزالة الإعلان أو تقييد الحساب بسبب مخالفة للسياسات، إلا إذا كان الاسترداد مطلوبًا بموجب الأنظمة أو تقرره SANANY بعد مراجعة الحالة." }
        ]
      },
      {
        id: "refund-request",
        title: "7. طلب الاسترداد",
        blocks: [
          { type: "p", text: "يرسل الطلب إلى info@sanany.com ويشمل -قدر الإمكان- رقم الحساب أو الجوال المرتبط، رقم الإعلان أو العملية، تاريخ الدفع، المبلغ، وشرح سبب الطلب. لا ينبغي إرسال رقم البطاقة الكامل أو رمز التحقق أو أي بيانات سرية عبر البريد الإلكتروني." }
        ]
      }
    ]
  },
  en: {
    title: "Cancellation and Refund Policy",
    metaTitle: "Cancellation and Refund Policy | SANANY",
    metaDescription: "SANANY Cancellation and Refund Policy: scope, user-to-user goods and services, paid SANANY services, sale commission, duplicate charges and technical errors, and how to request a refund.",
    sections: [
      {
        id: "scope",
        title: "1. Scope",
        blocks: [
          { type: "p", text: "This Policy applies to amounts paid to SANANY for Platform services or commission. The purchase price of goods or services sold by one user to another, where SANANY is not the direct seller, is governed by the arrangement between the transaction parties and any mandatory law that applies to them." }
        ]
      },
      {
        id: "user-to-user",
        title: "2. User-to-User Goods and Services",
        blocks: [
          { type: "p", text: "SANANY is not automatically responsible for accepting returns or refunding an amount paid by a buyer directly to a seller. Buyers and sellers should agree on delivery, inspection, return and warranty terms, while complying with any mandatory consumer rights applicable to the seller or service provider." }
        ]
      },
      {
        id: "paid-services",
        title: "3. Paid SANANY Services",
        blocks: [
          { type: "p", text: "Cancellation and refund requests for paid digital SANANY services are reviewed based on service status and applicable law. A full or partial refund may be available depending on the circumstances where, for example, the service has not started, a duplicate charge occurred, or a technical failure prevented the user from receiving the service." },
          { type: "p", text: "Where the service has already been performed, activated or used, refunds may be limited to the extent permitted by law, without affecting any mandatory consumer right." }
        ]
      },
      {
        id: "sale-commission",
        title: "4. Sale Commission",
        blocks: [
          { type: "p", text: "If a commission is paid and the underlying sale later fails or is cancelled, a refund is not automatic. The seller may submit a review request to info@sanany.com with the listing details, transaction information and available evidence. SANANY will review the circumstances under the policies and law applicable at the time of the transaction." }
        ]
      },
      {
        id: "duplicate-charges",
        title: "5. Duplicate Charges and Technical Errors",
        blocks: [
          { type: "p", text: "Where a duplicate charge or an amount collected in error for SANANY is verified, the correction or refund will be processed through the relevant payment method, subject to the technical processing time of the bank or payment provider." }
        ]
      },
      {
        id: "violations",
        title: "6. Policy Violations",
        blocks: [
          { type: "p", text: "Removal of a listing or restriction of an account for a policy violation does not automatically create a right to refund a SANANY service that has already been used, except where a refund is required by law or approved by SANANY after reviewing the circumstances." }
        ]
      },
      {
        id: "refund-request",
        title: "7. How to Request a Refund",
        blocks: [
          { type: "p", text: "Send the request to info@sanany.com and include, where possible, the account or linked phone information, listing or transaction reference, payment date, amount and reason for the request. Do not send a full payment-card number, verification code or other secret information by email." }
        ]
      }
    ]
  }
};
