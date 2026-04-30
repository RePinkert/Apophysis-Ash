import { ref, computed } from 'vue'
import zhCN from './locales/zh-CN'
import en from './locales/en'

const locales: Record<string, Record<string, Record<string, string>>> = {
  'zh-CN': zhCN,
  'en': en,
}

const currentLocale = ref('zh-CN')

export function setLocale(locale: string) {
  if (locales[locale]) {
    currentLocale.value = locale
  }
}

export function getLocale(): string {
  return currentLocale.value
}

export function getAvailableLocales(): { value: string; label: string }[] {
  return [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en', label: 'English' },
  ]
}

export function t(key: string): string {
  const [section, field] = key.split('.')
  const translations = locales[currentLocale.value]
  return translations?.[section]?.[field] ?? key
}

export function useI18n() {
  const locale = computed(() => currentLocale.value)

  function translate(key: string): string {
    return t(key)
  }

  return { t: translate, locale, setLocale, getAvailableLocales }
}
