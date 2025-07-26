import type { Schedule } from '@/types'

const STORAGE_KEY = 'megaschedule_schedules'

export interface StoredSchedule extends Schedule {
  weekStart: string // YYYY-MM-DD format for easy sorting
}

export class ScheduleStorage {
  static saveSchedule(schedule: Schedule): void {
    try {
      const schedules = this.getAllSchedules()
      const weekStart = new Date(schedule.weekStartDate)
        .toISOString()
        .split('T')[0]

      const storedSchedule: StoredSchedule = {
        ...schedule,
        weekStart,
      }

      // Remove existing schedule for the same week if it exists
      const filteredSchedules = schedules.filter(s => s.weekStart !== weekStart)

      // Add the new schedule
      filteredSchedules.push(storedSchedule)

      // Sort by week start date
      filteredSchedules.sort(
        (a, b) =>
          new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
      )

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSchedules))
    } catch (error) {
      console.error('Failed to save schedule:', error)
    }
  }

  static getScheduleForWeek(weekStartDate: string): StoredSchedule | null {
    try {
      const weekStart = new Date(weekStartDate).toISOString().split('T')[0]
      const schedules = this.getAllSchedules()
      return schedules.find(s => s.weekStart === weekStart) || null
    } catch (error) {
      console.error('Failed to get schedule for week:', error)
      return null
    }
  }

  static getAllSchedules(): StoredSchedule[] {
    try {
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

  static deleteSchedule(weekStart: string): void {
    try {
      const schedules = this.getAllSchedules()
      const filteredSchedules = schedules.filter(s => s.weekStart !== weekStart)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSchedules))
    } catch (error) {
      console.error('Failed to delete schedule:', error)
    }
  }

  static updateScheduleStatus(weekStart: string, isPublished: boolean): void {
    try {
      const schedules = this.getAllSchedules()
      const schedule = schedules.find(s => s.weekStart === weekStart)

      if (schedule) {
        schedule.isPublished = isPublished
        schedule.updatedAt = new Date().toISOString()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
      }
    } catch (error) {
      console.error('Failed to update schedule status:', error)
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
      return true
    } catch (error) {
      console.error('Failed to import schedules:', error)
      return false
    }
  }
}
