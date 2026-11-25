import dayjs from 'dayjs'

export function money(value) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(number)
}

export function number(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value || 0))
}

export function date(value, pattern = 'DD MMM YYYY') {
  if (!value) return '-'
  return dayjs(value).format(pattern)
}

export function dateTime(value) {
  if (!value) return '-'
  return dayjs(value).format('DD MMM YYYY HH:mm')
}

export function time(value) {
  if (!value) return '-'
  return dayjs(value).format('HH:mm')
}

export function age(birthDate) {
  if (!birthDate) return '-'
  const years = dayjs().diff(dayjs(birthDate), 'year')
  if (years <= 0) {
    const months = dayjs().diff(dayjs(birthDate), 'month')
    return `${Math.max(months, 0)} bln`
  }
  return `${years} th`
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function greeting() {
  const hour = dayjs().hour()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 19) return 'Selamat sore'
  return 'Selamat malam'
}

export function today() {
  return dayjs().format('YYYY-MM-DD')
}

export function normalizeTime(value) {
  if (!value) return null
  if (typeof value === 'string') return value.length === 5 ? `${value}:00` : value
  return value.format('HH:mm:ss')
}
