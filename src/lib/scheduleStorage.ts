import type { Schedule } from '@/types'

const STORAGE_KEY = 'megaschedule_schedules'

export interface StoredSchedule extends Schedule {
  weekStart: string // YYYY-MM-DD format for easy sorting
  monthStart?: string // YYYY-MM-01 format for monthly schedules
}

export class ScheduleStorage {
  static saveSchedule(schedule: Schedule): void {
    try {
      const schedules = this.getAllSchedules()
      const weekStart = new Date(schedule.weekStartDate)
        .toISOString()
        .split('T')[0]

      const monthStart = schedule.monthStartDate
        ? new Date(schedule.monthStartDate)
            .toISOString()
            .split('T')[0]
            .substring(0, 8) + '01'
        : undefined

      const storedSchedule: StoredSchedule = {
        ...schedule,
        weekStart,
        monthStart,
      }

      // Remove existing schedule for the same period if it exists
      const filteredSchedules = schedules.filter(s => {
        if (schedule.scheduleType === 'monthly' && monthStart) {
          return s.monthStart !== monthStart
        } else {
          return s.weekStart !== weekStart
        }
      })

      // Add the new schedule
      filteredSchedules.push(storedSchedule)

      // Sort by appropriate date (monthly schedules first, then weekly)
      filteredSchedules.sort((a, b) => {
        const aDate =
          a.scheduleType === 'monthly' && a.monthStart
            ? new Date(a.monthStart)
            : new Date(a.weekStart)
        const bDate =
          b.scheduleType === 'monthly' && b.monthStart
            ? new Date(b.monthStart)
            : new Date(b.weekStart)
        return bDate.getTime() - aDate.getTime()
      })

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSchedules))
      }
    } catch (error) {
      console.error('Failed to save schedule:', error)
    }
  }

  static getScheduleForWeek(weekStartDate: string): StoredSchedule | null {
    try {
      const weekStart = new Date(weekStartDate).toISOString().split('T')[0]
      const schedules = this.getAllSchedules()

      // First, try to find a dedicated weekly schedule
      const weeklySchedule = schedules.find(
        s => s.weekStart === weekStart && s.scheduleType !== 'monthly'
      )

      if (weeklySchedule) {
        return weeklySchedule
      }

      // Fallback: try to extract week from monthly schedule
      return this.extractWeekFromMonthlySchedule(weekStartDate)
    } catch (error) {
      console.error('Failed to get schedule for week:', error)
      return null
    }
  }

  static extractWeekFromMonthlySchedule(
    weekStartDate: string
  ): StoredSchedule | null {
    try {
      const weekStartDateObj = new Date(weekStartDate)
      const monthStart = new Date(
        weekStartDateObj.getFullYear(),
        weekStartDateObj.getMonth(),
        1
      )
      const monthStartString =
        monthStart.toISOString().split('T')[0].substring(0, 8) + '01'

      // Find the monthly schedule that contains this week
      const schedules = this.getAllSchedules()
      const monthlySchedule = schedules.find(
        s => s.monthStart === monthStartString && s.scheduleType === 'monthly'
      )

      if (!monthlySchedule) {
        return null
      }

      // Calculate the week dates (Monday to Sunday)
      const weekDates: string[] = []
      const startOfWeek = new Date(weekStartDateObj)
      startOfWeek.setDate(
        weekStartDateObj.getDate() - weekStartDateObj.getDay() + 1
      ) // Start from Monday

      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek)
        day.setDate(startOfWeek.getDate() + i)
        weekDates.push(day.toISOString().split('T')[0])
      }

      // Filter shifts from monthly schedule that belong to this week
      const weekShifts = monthlySchedule.shifts.filter(shift => {
        return shift.date && weekDates.includes(shift.date)
      })

      if (weekShifts.length === 0) {
        return null
      }

      // Create a weekly schedule from the filtered shifts
      const weeklyFromMonthly: StoredSchedule = {
        ...monthlySchedule,
        id: `weekly-from-monthly-${weekStartDate}`,
        weekStart: weekStartDateObj.toISOString().split('T')[0],
        weekStartDate: weekStartDateObj.toISOString(),
        scheduleType: 'weekly', // Convert to weekly type for display
        shifts: weekShifts,
        monthStart: undefined, // Clear monthly fields
        monthStartDate: undefined,
      }

      return weeklyFromMonthly
    } catch (error) {
      console.error('Failed to extract week from monthly schedule:', error)
      return null
    }
  }

  static getScheduleForMonth(monthStartDate: string): StoredSchedule | null {
    try {
      const monthStart =
        new Date(monthStartDate).toISOString().split('T')[0].substring(0, 8) +
        '01'
      const schedules = this.getAllSchedules()
      return (
        schedules.find(
          s => s.monthStart === monthStart && s.scheduleType === 'monthly'
        ) || null
      )
    } catch (error) {
      console.error('Failed to get schedule for month:', error)
      return null
    }
  }

  static getAllSchedules(): StoredSchedule[] {
    try {
      if (typeof window === 'undefined') return []

      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return []

      const schedules = JSON.parse(stored) as StoredSchedule[]
      return schedules.sort(
        (a, b) =>
          new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
      )
    } catch (error) {
      console.error('Failed to get all schedules:', error)
      return []
    }
  }

  static getPublishedSchedules(): StoredSchedule[] {
    return this.getAllSchedules().filter(s => s.isPublished)
  }

  static getWeeklySchedules(): StoredSchedule[] {
    return this.getAllSchedules().filter(s => s.scheduleType !== 'monthly')
  }

  static getMonthlySchedules(): StoredSchedule[] {
    return this.getAllSchedules().filter(s => s.scheduleType === 'monthly')
  }

  static deleteSchedule(weekStart: string): void {
    try {
      const schedules = this.getAllSchedules()
      const filteredSchedules = schedules.filter(s => s.weekStart !== weekStart)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSchedules))
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error)
    }
  }

  static deleteMonthlySchedule(monthStart: string): void {
    try {
      const schedules = this.getAllSchedules()
      const filteredSchedules = schedules.filter(
        s => s.monthStart !== monthStart
      )
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSchedules))
      }
    } catch (error) {
      console.error('Failed to delete monthly schedule:', error)
    }
  }

  static updateScheduleStatus(weekStart: string, isPublished: boolean): void {
    try {
      const schedules = this.getAllSchedules()
      const schedule = schedules.find(s => s.weekStart === weekStart)

      if (schedule) {
        schedule.isPublished = isPublished
        schedule.updatedAt = new Date().toISOString()
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
        }
      }
    } catch (error) {
      console.error('Failed to update schedule status:', error)
    }
  }

  static updateMonthlyScheduleStatus(
    monthStart: string,
    isPublished: boolean
  ): void {
    try {
      const schedules = this.getAllSchedules()
      const schedule = schedules.find(
        s => s.monthStart === monthStart && s.scheduleType === 'monthly'
      )

      if (schedule) {
        schedule.isPublished = isPublished
        schedule.updatedAt = new Date().toISOString()
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
        }
      }
    } catch (error) {
      console.error('Failed to update monthly schedule status:', error)
    }
  }

  static exportSchedules(): string {
    try {
      const schedules = this.getAllSchedules()
      return JSON.stringify(schedules, null, 2)
    } catch (error) {
      console.error('Failed to export schedules:', error)
      return '[]'
    }
  }

  static importSchedules(data: string): boolean {
    try {
      const schedules = JSON.parse(data) as StoredSchedule[]
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
      }
      return true
    } catch (error) {
      console.error('Failed to import schedules:', error)
      return false
    }
  }
}
