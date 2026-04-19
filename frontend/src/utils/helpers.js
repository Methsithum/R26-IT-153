import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatJournalDate(date) {
  return format(new Date(date), 'EEE, MMM d')
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
