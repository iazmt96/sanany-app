import type { Metadata } from "next";
import { resources } from "@sanany/shared";
import { defaultLanguage, isSupportedLanguage, type AppLanguage } from "@sanany/utils";
import { buildAlternates, localizedPath } from "./seo";

export function resolveLanguage(language: string): AppLanguage {
  return isSupportedLanguage(language) ? language : defaultLanguage;
}

export function buildPublicMetadata(language: AppLanguage, pathname: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: localizedPath(language, pathname),
      languages: buildAlternates(pathname)
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: localizedPath(language, pathname)
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function buildPrivateMetadata(language: AppLanguage, pathname: string, title: string, description: string): Metadata {
  return {
    ...buildPublicMetadata(language, pathname, title, description),
    robots: {
      index: false,
      follow: false,
      nocache: true
    }
  };
}

export function getDictionary(language: AppLanguage) {
  return resources[language].translation;
}
