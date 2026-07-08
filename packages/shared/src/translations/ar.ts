export const ar = {
  app: {
    title: "سنعني"
  },
  common: {
    loading: "جاري التحميل...",
    retry: "إعادة المحاولة",
    signOut: "تسجيل الخروج",
    next: "التالي",
    previous: "السابق",
    page: "الصفحة {{current}} من {{total}}"
  },
  language: {
    ar: "العربية",
    en: "الإنجليزية"
  },
  auth: {
    signInTitle: "تسجيل الدخول",
    signUpTitle: "إنشاء حساب",
    subtitle: "بوابة الوصول إلى سوق سنعني",
    emailPlaceholder: "البريد الإلكتروني",
    passwordPlaceholder: "كلمة المرور",
    emailLabel: "البريد الإلكتروني",
    passwordLabel: "كلمة المرور",
    signInAction: "دخول",
    signUpAction: "تسجيل",
    switchToSignUp: "ليس لديك حساب؟ سجل الآن",
    switchToSignIn: "لديك حساب بالفعل؟ سجل الدخول",
    emailConfirmationSent: "تم إنشاء الحساب. افحص بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.",
    configError: "المصادقة غير متاحة بسبب نقص الإعدادات.",
    errors: {
      emailRequired: "البريد الإلكتروني مطلوب.",
      passwordRequired: "كلمة المرور مطلوبة.",
      invalidEmail: "صيغة البريد الإلكتروني غير صحيحة.",
      emailNotConfirmed: "البريد الإلكتروني غير مؤكد. افحص بريدك ثم حاول مجددًا.",
      invalidCredentials: "بيانات الدخول غير صحيحة.",
      userExists: "يوجد حساب مسجل بهذا البريد الإلكتروني.",
      rateLimited: "تم تجاوز الحد المسموح به لإرسال البريد. انتظر قليلاً ثم حاول مجددًا.",
      passwordTooShort: "كلمة المرور قصيرة جداً. يجب أن تكون 6 أحرف على الأقل.",
      unknown: "حدث خطأ غير متوقع أثناء المصادقة."
    }
  },
  marketplace: {
    pageTitle: "سوق الخدمات والمنتجات",
    pageSubtitle: "استعرض أحدث العروض من مزودي سنعني",
    pricePerDay: "{{value}} ريال / يوم",
    listCount: "{{count}} إعلان",
    postedAt: "نشر {{value}}",
    create: {
      title: "أضف إعلان جديد",
      open: "أضف إعلاناً",
      close: "إغلاق",
      listingTitleLabel: "عنوان الإعلان",
      listingDescriptionLabel: "وصف الإعلان",
      listingPriceLabel: "السعر",
      listingTitlePlaceholder: "مثال: صيانة مكيفات منزلية",
      listingDescriptionPlaceholder: "اكتب تفاصيل الخدمة أو المنتج",
      listingPricePlaceholder: "مثال: 180",
      submit: "نشر الإعلان",
      success: "تم نشر الإعلان بنجاح.",
      errors: {
        authRequired: "يجب تسجيل الدخول لإضافة إعلان.",
        titleRequired: "عنوان الإعلان مطلوب.",
        priceInvalid: "السعر يجب أن يكون رقمًا صحيحًا أكبر من صفر."
      }
    },
    sort: {
      label: "الترتيب",
      newest: "الأحدث",
      priceHigh: "الأعلى سعراً",
      priceLow: "الأقل سعراً"
    },
    searchPlaceholder: "ابحث في العروض",
    filters: {
      all: "كل العروض",
      available: "المتاح فقط",
      reserved: "المحجوز فقط"
    },
    emptyState: "لا توجد عروض تطابق المرشحات.",
    loadError: "تعذر تحميل العروض.",
    signOutHint: "تم تسجيل الدخول عبر {{email}}",
    status: {
      available: "متاح",
      reserved: "محجوز"
    }
  }
} as const;
