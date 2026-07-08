export const ar = {
  app: {
    title: "سناني"
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
    subtitle: "بوابة الوصول إلى سوق سناني",
    emailPlaceholder: "البريد الإلكتروني",
    passwordPlaceholder: "كلمة المرور",
    emailLabel: "البريد الإلكتروني",
    passwordLabel: "كلمة المرور",
    signInAction: "دخول",
    signUpAction: "تسجيل",
    switchToSignUp: "ليس لديك حساب؟ سجل الآن",
    switchToSignIn: "لديك حساب بالفعل؟ سجل الدخول",
    configError: "المصادقة غير متاحة بسبب نقص الإعدادات.",
    errors: {
      emailRequired: "البريد الإلكتروني مطلوب.",
      passwordRequired: "كلمة المرور مطلوبة.",
      invalidCredentials: "بيانات الدخول غير صحيحة.",
      userExists: "يوجد حساب مسجل بهذا البريد الإلكتروني.",
      unknown: "حدث خطأ غير متوقع أثناء المصادقة."
    }
  },
  marketplace: {
    pageTitle: "سوق الخدمات والمنتجات",
    pageSubtitle: "استعرض أحدث العروض من مزودي سناني",
    pricePerDay: "{{value}} ريال / يوم",
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
