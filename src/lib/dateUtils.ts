import type { DayOfWeek } from '@/types'

export class DateUtils {
  static getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ]
    return days[date.getDay()]
  }

  static getWeekDates(weekStartDate: Date): Date[] {
    const week = []
    const startOfWeek = new Date(weekStartDate)
    startOfWeek.setDate(weekStartDate.getDate() - weekStartDate.getDay() + 1) // Start from Monday

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      week.push(day)
    }
    return week
  }

  static getMonthDates(monthStartDate: Date): Date[] {
    const year = monthStartDate.getFullYear()
    const month = monthStartDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const dates = []
    for (
      let date = new Date(firstDay);
      date <= lastDay;
      date.setDate(date.getDate() + 1)
    ) {
      dates.push(new Date(date))
    }

    return dates
  }

  static getMonthWeeks(monthStartDate: Date): Date[][] {
    const monthDates = this.getMonthDates(monthStartDate)
    const weeks: Date[][] = []
    let currentWeek: Date[] = []

    monthDates.forEach(date => {
      const dayOfWeek = date.getDay()

      // Start new week on Monday (day 1)
      if (dayOfWeek === 1 && currentWeek.length > 0) {
        weeks.push(currentWeek)
        currentWeek = []
      }

      currentWeek.push(date)
    })

    // Add the last week if it has dates
    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }

    return weeks
  }

  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0] // YYYY-MM-DD
  }

  static formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    })
  }

  static getMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1)
  }

  static getMonthEnd(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0)
  }

  static addMonths(date: Date, months: number): Date {
    const result = new Date(date)
    result.setMonth(result.getMonth() + months)
    return result
  }

  static addWeeks(date: Date, weeks: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + weeks * 7)
    return result
  }

  static isToday(date: Date): boolean {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  static isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6 // Sunday or Saturday
  }

  static getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  static getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }
}
