export const en = {
  app: {
    title: "SANANY"
  },
  common: {
    loading: "Loading...",
    retry: "Try again",
    signOut: "Sign out",
    next: "Next",
    previous: "Previous",
    page: "Page {{current}} of {{total}}"
  },
  language: {
    ar: "Arabic",
    en: "English"
  },
  auth: {
    signInTitle: "Sign in",
    signUpTitle: "Create account",
    subtitle: "Your access gateway to SANANY marketplace",
    emailPlaceholder: "Email address",
    passwordPlaceholder: "Password",
    emailLabel: "Email",
    passwordLabel: "Password",
    signInAction: "Sign in",
    signUpAction: "Sign up",
    switchToSignUp: "Don't have an account? Sign up now",
    switchToSignIn: "Already have an account? Sign in",
    configError: "Authentication is unavailable due to missing configuration.",
    errors: {
      emailRequired: "Email is required.",
      passwordRequired: "Password is required.",
      invalidCredentials: "Invalid email or password.",
      userExists: "An account already exists for this email.",
      unknown: "An unexpected authentication error occurred."
    }
  },
  marketplace: {
    pageTitle: "Marketplace",
    pageSubtitle: "Browse recent offers from SANANY providers",
    pricePerDay: "SAR {{value}} / day",
    searchPlaceholder: "Search listings",
    filters: {
      all: "All listings",
      available: "Available only",
      reserved: "Reserved only"
    },
    emptyState: "No listings matched your filters.",
    loadError: "Unable to load listings.",
    status: {
      available: "Available",
      reserved: "Reserved"
    },
    signOutHint: "Signed in as {{email}}"
  }
} as const;
