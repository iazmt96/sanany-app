const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "lcwmjfbosjxrozubbrpc";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SITE_URL = process.env.SANANY_SITE_URL ?? "https://sanany.com/ar";
const BRAND_HOME_URL = process.env.SANANY_BRAND_HOME_URL ?? "https://sanany.com";
const LOGO_URL = new URL("/brand/sanany-logo.png", BRAND_HOME_URL).toString();

if (!ACCESS_TOKEN) {
  throw new Error("Missing SUPABASE_ACCESS_TOKEN. Set it before syncing Supabase auth email templates.");
}

function renderLayout({ eyebrow, title, subtitle, body, ctaLabel, ctaHref, footerNote, secondaryAction, accent = "#0f766e" }) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:'Tahoma','Arial',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f7fb;margin:0;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;">
            <tr>
              <td style="padding:0 0 16px 0;text-align:center;">
                <img src="${LOGO_URL}" alt="SANANY" width="164" style="display:block;margin:0 auto 18px auto;width:164px;max-width:100%;height:auto;" />
                <div style="display:inline-block;padding:7px 14px;border-radius:999px;background-color:#ccfbf1;color:${accent};font-size:12px;font-weight:700;letter-spacing:0.04em;">
                  ${eyebrow}
                </div>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border:1px solid #dbe4f0;border-radius:28px;box-shadow:0 18px 50px rgba(15,23,42,0.08);padding:36px 28px;">
                <div style="font-size:30px;line-height:1.3;font-weight:800;color:#0f172a;text-align:right;margin:0 0 12px 0;">${title}</div>
                <div style="font-size:15px;line-height:1.9;color:#475569;text-align:right;margin:0 0 24px 0;">${subtitle}</div>
                <div style="font-size:16px;line-height:1.95;color:#1e293b;text-align:right;">${body}</div>
                ${
                  ctaLabel && ctaHref
                    ? `<div style="padding:28px 0 18px 0;text-align:center;">
                  <a href="${ctaHref}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;line-height:1;padding:18px 28px;border-radius:18px;box-shadow:0 12px 24px rgba(15,118,110,0.22);">
                    ${ctaLabel}
                  </a>
                </div>`
                    : ""
                }
                ${
                  secondaryAction
                    ? `<div style="margin-top:8px;padding:16px 18px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;line-height:1.85;color:#475569;text-align:right;">
                  ${secondaryAction}
                </div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:18px 12px 0 12px;text-align:center;font-size:12px;line-height:1.9;color:#64748b;">
                <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">SANANY Marketplace</div>
                <div>${footerNote}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const confirmationUrl = "{{ .ConfirmationURL }}";
const token = "{{ .Token }}";
const email = "{{ .Email }}";
const newEmail = "{{ .NewEmail }}";
const oldEmail = "{{ .OldEmail }}";
const phone = "{{ .Phone }}";
const oldPhone = "{{ .OldPhone }}";
const provider = "{{ .Provider }}";
const factorType = "{{ .FactorType }}";

const footerNote =
  "هذه الرسالة مرسلة من SANANY. إذا لم تكن أنت صاحب الطلب، يمكنك تجاهل الرسالة بأمان. / This email was sent by SANANY. If this was not you, you can safely ignore it.";

const ctaFallback = (hrefLabel) =>
  `إذا لم يعمل الزر، انسخ هذا الرابط والصقه في المتصفح:<br /><span style="word-break:break-all;color:#0f766e;font-weight:700;">${hrefLabel}</span>`;

const payload = {
  site_url: SITE_URL,
  mailer_subjects_confirmation: "تأكيد البريد الإلكتروني | SANANY",
  mailer_templates_confirmation_content: renderLayout({
    eyebrow: "تفعيل الحساب",
    title: "أهلاً بك في SANANY",
    subtitle:
      "أكّد بريدك الإلكتروني لإكمال إنشاء حسابك والبدء في البيع والشراء داخل سنعني. / Confirm your email to finish creating your SANANY account.",
    body: `<p style="margin:0 0 14px 0;">مرحباً ${email}،</p>
<p style="margin:0 0 14px 0;">اضغط على الزر التالي لتفعيل حسابك بشكل آمن وبدء استخدام التطبيق.</p>`,
    ctaLabel: "تأكيد البريد الإلكتروني",
    ctaHref: confirmationUrl,
    secondaryAction: ctaFallback(confirmationUrl),
    footerNote
  }),
  mailer_subjects_magic_link: "رابط تسجيل الدخول | SANANY",
  mailer_templates_magic_link_content: renderLayout({
    eyebrow: "تسجيل دخول آمن",
    title: "رابط دخولك جاهز",
    subtitle:
      "استخدم هذا الرابط للدخول إلى حساب SANANY. الرابط صالح لفترة قصيرة ويُستخدم مرة واحدة فقط. / Use this link to sign in securely.",
    body: `<p style="margin:0 0 14px 0;">مرحباً ${email}،</p>
<p style="margin:0 0 14px 0;">فتحنا لك جلسة دخول آمنة. اضغط على الزر التالي للمتابعة.</p>`,
    ctaLabel: "الدخول إلى SANANY",
    ctaHref: confirmationUrl,
    secondaryAction: ctaFallback(confirmationUrl),
    footerNote
  }),
  mailer_subjects_recovery: "إعادة تعيين كلمة المرور | SANANY",
  mailer_templates_recovery_content: renderLayout({
    eyebrow: "أمان الحساب",
    title: "إعادة تعيين كلمة المرور",
    subtitle:
      "استلمنا طلباً لإعادة تعيين كلمة مرور حساب SANANY الخاص بك. / We received a password reset request for your SANANY account.",
    body: `<p style="margin:0 0 14px 0;">إذا كنت أنت من طلب ذلك، اضغط على الزر التالي لاختيار كلمة مرور جديدة.</p>
<p style="margin:0 0 14px 0;">إذا لم تطلب هذا الإجراء، تجاهل الرسالة وسيبقى حسابك كما هو.</p>`,
    ctaLabel: "اختيار كلمة مرور جديدة",
    ctaHref: confirmationUrl,
    secondaryAction: ctaFallback(confirmationUrl),
    footerNote
  }),
  mailer_subjects_invite: "دعوة إلى SANANY",
  mailer_templates_invite_content: renderLayout({
    eyebrow: "دعوة جديدة",
    title: "تمت دعوتك إلى SANANY",
    subtitle:
      "لديك دعوة للانضمام إلى SANANY Marketplace. / You have been invited to join SANANY Marketplace.",
    body: `<p style="margin:0 0 14px 0;">اضغط على الزر التالي لقبول الدعوة وإكمال إنشاء حسابك.</p>`,
    ctaLabel: "قبول الدعوة",
    ctaHref: confirmationUrl,
    secondaryAction: ctaFallback(confirmationUrl),
    footerNote
  }),
  mailer_subjects_email_change: "تأكيد البريد الإلكتروني الجديد | SANANY",
  mailer_templates_email_change_content: renderLayout({
    eyebrow: "تحديث البريد",
    title: "تأكيد بريدك الإلكتروني الجديد",
    subtitle:
      "نحتاج إلى تأكيد البريد الجديد قبل تحديث حسابك. / Confirm your new email address before we update your SANANY account.",
    body: `<p style="margin:0 0 14px 0;">يرجى الضغط على الزر التالي لتأكيد البريد الجديد:</p>
<p style="margin:0 0 14px 0;"><strong>${newEmail}</strong></p>`,
    ctaLabel: "تأكيد البريد الجديد",
    ctaHref: confirmationUrl,
    secondaryAction: ctaFallback(confirmationUrl),
    footerNote
  }),
  mailer_subjects_reauthentication: `${token} | رمز التحقق من SANANY`,
  mailer_templates_reauthentication_content: renderLayout({
    eyebrow: "رمز تحقق",
    title: "رمز التحقق الخاص بك",
    subtitle:
      "استخدم الرمز التالي لإكمال التحقق من هويتك في SANANY. / Use this verification code to continue securely.",
    body: `<p style="margin:0 0 16px 0;">الرمز صالح لفترة قصيرة، ولا ينبغي مشاركته مع أي شخص.</p>
<div style="direction:ltr;text-align:center;margin:8px 0 2px 0;">
  <span style="display:inline-block;padding:16px 22px;border-radius:20px;background:#0f172a;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:0.4em;">${token}</span>
</div>`,
    footerNote
  }),
  mailer_subjects_password_changed_notification: "تم تغيير كلمة المرور | SANANY",
  mailer_templates_password_changed_notification_content: renderLayout({
    eyebrow: "تنبيه أمني",
    title: "تم تغيير كلمة المرور",
    subtitle:
      "تم تغيير كلمة مرور حساب SANANY الخاص بك. / Your SANANY account password was changed.",
    body: `<p style="margin:0 0 14px 0;">إذا كنت أنت من أجرى هذا التغيير فلا يلزمك أي إجراء إضافي.</p>
<p style="margin:0 0 14px 0;">إذا لم تكن أنت، ننصح بإعادة تعيين كلمة المرور فوراً والتواصل مع الدعم.</p>`,
    footerNote
  }),
  mailer_subjects_email_changed_notification: "تم تغيير البريد الإلكتروني | SANANY",
  mailer_templates_email_changed_notification_content: renderLayout({
    eyebrow: "تنبيه أمني",
    title: "تم تغيير البريد الإلكتروني",
    subtitle:
      "تم تحديث البريد الإلكتروني المرتبط بحساب SANANY الخاص بك. / The email address on your SANANY account was updated.",
    body: `<p style="margin:0 0 14px 0;">البريد السابق: <strong>${oldEmail}</strong></p>
<p style="margin:0 0 14px 0;">البريد الحالي: <strong>${email}</strong></p>
<p style="margin:0;">إذا لم تكن أنت من طلب هذا التغيير، تواصل مع الدعم فوراً.</p>`,
    footerNote
  }),
  mailer_subjects_phone_changed_notification: "تم تغيير رقم الجوال | SANANY",
  mailer_templates_phone_changed_notification_content: renderLayout({
    eyebrow: "تنبيه أمني",
    title: "تم تغيير رقم الجوال",
    subtitle:
      "تم تحديث رقم الجوال المرتبط بحساب SANANY الخاص بك. / The phone number on your SANANY account was updated.",
    body: `<p style="margin:0 0 14px 0;">الرقم السابق: <strong>${oldPhone}</strong></p>
<p style="margin:0 0 14px 0;">الرقم الحالي: <strong>${phone}</strong></p>
<p style="margin:0;">إذا لم تطلب هذا التغيير، راجع إعدادات الأمان مباشرة.</p>`,
    footerNote
  }),
  mailer_subjects_mfa_factor_enrolled_notification: "تمت إضافة وسيلة تحقق جديدة | SANANY",
  mailer_templates_mfa_factor_enrolled_notification_content: renderLayout({
    eyebrow: "تنبيه أمني",
    title: "تمت إضافة وسيلة تحقق جديدة",
    subtitle:
      "تم تفعيل وسيلة تحقق إضافية لحساب SANANY الخاص بك. / A new verification method was added to your SANANY account.",
    body: `<p style="margin:0 0 14px 0;">الوسيلة المضافة: <strong>${factorType}</strong></p>
<p style="margin:0;">إذا لم يكن هذا الإجراء منك، غيّر كلمة المرور وتحقق من نشاط الحساب.</p>`,
    footerNote
  }),
  mailer_subjects_mfa_factor_unenrolled_notification: "تمت إزالة وسيلة تحقق | SANANY",
  mailer_templates_mfa_factor_unenrolled_notification_content: renderLayout({
    eyebrow: "تنبيه أمني",
    title: "تمت إزالة وسيلة تحقق",
    subtitle:
      "تمت إزالة إحدى وسائل التحقق من حساب SANANY الخاص بك. / A verification method was removed from your SANANY account.",
    body: `<p style="margin:0 0 14px 0;">الوسيلة التي أزيلت: <strong>${factorType}</strong></p>
<p style="margin:0;">إذا لم تطلب هذا التغيير، راجع أمان الحساب فوراً.</p>`,
    footerNote
  }),
  mailer_subjects_identity_linked_notification: "تم ربط طريقة تسجيل دخول جديدة | SANANY",
  mailer_templates_identity_linked_notification_content: renderLayout({
    eyebrow: "تنبيه أمني",
    title: "تم ربط طريقة تسجيل دخول جديدة",
    subtitle:
      "تم ربط مزود تسجيل دخول جديد بحساب SANANY الخاص بك. / A new sign-in method was linked to your SANANY account.",
    body: `<p style="margin:0 0 14px 0;">المزوّد المرتبط: <strong>${provider}</strong></p>
<p style="margin:0;">إذا لم تقم بذلك، غيّر كلمة المرور وراجع إعدادات الحساب.</p>`,
    footerNote
  }),
  mailer_subjects_identity_unlinked_notification: "تمت إزالة طريقة تسجيل دخول | SANANY",
  mailer_templates_identity_unlinked_notification_content: renderLayout({
    eyebrow: "تنبيه أمني",
    title: "تمت إزالة طريقة تسجيل دخول",
    subtitle:
      "تمت إزالة إحدى طرق تسجيل الدخول من حساب SANANY الخاص بك. / A sign-in method was removed from your SANANY account.",
    body: `<p style="margin:0 0 14px 0;">المزوّد الذي أزيل: <strong>${provider}</strong></p>
<p style="margin:0;">إذا لم يكن هذا الإجراء منك، تحقق من أمان الحساب فوراً.</p>`,
    footerNote
  })
};

const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  throw new Error(`Failed to sync email templates: ${response.status} ${await response.text()}`);
}

const result = await response.json();

console.log(
  JSON.stringify(
    {
      projectRef: PROJECT_REF,
      siteUrl: result.site_url,
      confirmationSubject: result.mailer_subjects_confirmation,
      magicLinkSubject: result.mailer_subjects_magic_link,
      recoverySubject: result.mailer_subjects_recovery
    },
    null,
    2
  )
);
