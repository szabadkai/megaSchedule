import type { SchedulingConstraints } from './scheduler'

const CONFIG_STORAGE_KEY = 'megaschedule_config'

export class ConfigStorage {
  static saveConfig(constraints: SchedulingConstraints): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(constraints))
      }
    } catch (error) {
      console.error('Failed to save configuration:', error)
    }
  }

  static loadConfig(): SchedulingConstraints | null {
    try {
      if (typeof window === 'undefined') return null
      
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
      if (!stored) return null

      return JSON.parse(stored) as SchedulingConstraints
    } catch (error) {
      console.error('Failed to load configuration:', error)
      return null
    }
  }

  static getDefaultConfig(): SchedulingConstraints {
    return {
      maxConsecutiveShifts: 3,
      minRestHoursBetweenShifts: 8,
      maxHoursPerWeek: 40,
      requireSkillMatch: true,
      minimumSkillsRequired: true,
      shiftSkillRequirements: {
        morning: ['nursing'],
        afternoon: ['nursing'],
        night: ['nursing', 'emergency care'],
      },
      shiftStaffRequirements: {
        morning: { minimum: 2, maximum: 5 },
        afternoon: { minimum: 2, maximum: 4 },
        night: { minimum: 3, maximum: 4 },
      },
      weights: {
        preferredShift: 20,
        nonPreferredShift: -5,
        preferredDayOff: 30,
        matchingSkill: 15,
        noMatchingSkill: -10,
        needsMoreHours: 10,
      },
    }
  }

  static resetToDefaults(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(CONFIG_STORAGE_KEY)
      }
    } catch (error) {
      console.error('Failed to reset configuration:', error)
    }
  }

  static exportConfig(): string {
    try {
      const config = this.loadConfig() || this.getDefaultConfig()
      return JSON.stringify(config, null, 2)
    } catch (error) {
      console.error('Failed to export configuration:', error)
      return '{}'
    }
  }

  static importConfig(data: string): boolean {
    try {
      const config = JSON.parse(data) as SchedulingConstraints
      this.saveConfig(config)
      return true
    } catch (error) {
      console.error('Failed to import configuration:', error)
      return false
    }
  }
}
