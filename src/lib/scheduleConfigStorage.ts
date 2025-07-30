import {
  ScheduleConfiguration,
  DayOfWeek,
  ShiftType,
  DayScheduleConfig,
} from '@/types'

const STORAGE_KEY = 'megaschedule-config'

const defaultDayConfig: DayScheduleConfig = {
  enabledShiftTypes: ['morning', 'afternoon', 'night'],
  shiftSkillRequirements: {
    morning: [],
    afternoon: [],
    night: [],
    day: [],
    fullday: [],
  },
  shiftStaffRequirements: {
    morning: { minimum: 2, maximum: 4 },
    afternoon: { minimum: 2, maximum: 4 },
    night: { minimum: 2, maximum: 4 },
    day: { minimum: 2, maximum: 4 },
    fullday: { minimum: 1, maximum: 2 },
  },
}

const defaultConfiguration: ScheduleConfiguration = {
  maxConsecutiveShifts: 3,
  minRestHoursBetweenShifts: 12,
  maxHoursPerWeek: 40,
  minHoursPerWeek: 20,
  requireSkillMatch: true,
  minimumSkillsRequired: true,
  dayConfigurations: {
    monday: { ...defaultDayConfig },
    tuesday: { ...defaultDayConfig },
    wednesday: { ...defaultDayConfig },
    thursday: { ...defaultDayConfig },
    friday: { ...defaultDayConfig },
    saturday: {
      ...defaultDayConfig,
      enabledShiftTypes: ['day', 'night'],
    },
    sunday: {
      ...defaultDayConfig,
      enabledShiftTypes: ['day', 'night'],
    },
  },
  weights: {
    preferredShift: 10,
    nonPreferredShift: -5,
    preferredDayOff: -15,
    matchingSkill: 5,
    needsMoreHours: 8,
  },
}

export class ScheduleConfigStorage {
  static loadConfiguration(): ScheduleConfiguration {
    if (typeof window === 'undefined') {
      return defaultConfiguration
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to handle missing properties
        return this.migrateConfiguration(parsed)
      }
    } catch {
      console.warn('Failed to load schedule configuration')
    }

    return defaultConfiguration
  }

  static saveConfiguration(config: ScheduleConfiguration): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch (error) {
      console.error('Failed to save schedule configuration:', error)
    }
  }

  static resetToDefaults(): ScheduleConfiguration {
    this.saveConfiguration(defaultConfiguration)
    return defaultConfiguration
  }

  static exportConfiguration(): string {
    const config = this.loadConfiguration()
    return JSON.stringify(config, null, 2)
  }

  static importConfiguration(jsonString: string): ScheduleConfiguration {
    try {
      const parsed = JSON.parse(jsonString)
      const migrated = this.migrateConfiguration(parsed)
      this.saveConfiguration(migrated)
      return migrated
    } catch {
      throw new Error('Invalid configuration format')
    }
  }

  // Migration logic to handle configuration format changes
  private static migrateConfiguration(config: unknown): ScheduleConfiguration {
    // Start with defaults
    const migrated: ScheduleConfiguration = JSON.parse(
      JSON.stringify(defaultConfiguration)
    )

    // Type guard to check if config is an object
    if (typeof config !== 'object' || config === null) {
      return migrated
    }

    const configObj = config as Record<string, unknown>

    // Migrate global constraints
    if (typeof configObj.maxConsecutiveShifts === 'number') {
      migrated.maxConsecutiveShifts = configObj.maxConsecutiveShifts
    }
    if (typeof configObj.minRestHoursBetweenShifts === 'number') {
      migrated.minRestHoursBetweenShifts = configObj.minRestHoursBetweenShifts
    }
    if (typeof configObj.maxHoursPerWeek === 'number') {
      migrated.maxHoursPerWeek = configObj.maxHoursPerWeek
    }
    if (typeof configObj.minHoursPerWeek === 'number') {
      migrated.minHoursPerWeek = configObj.minHoursPerWeek
    }
    if (typeof configObj.requireSkillMatch === 'boolean') {
      migrated.requireSkillMatch = configObj.requireSkillMatch
    }
    if (typeof configObj.minimumSkillsRequired === 'boolean') {
      migrated.minimumSkillsRequired = configObj.minimumSkillsRequired
    }

    // Migrate weights
    if (typeof configObj.weights === 'object' && configObj.weights !== null) {
      migrated.weights = {
        ...migrated.weights,
        ...(configObj.weights as typeof migrated.weights),
      }
    }

    // Migrate day configurations
    if (
      typeof configObj.dayConfigurations === 'object' &&
      configObj.dayConfigurations !== null
    ) {
      const days: DayOfWeek[] = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]

      days.forEach(day => {
        if (
          typeof configObj.dayConfigurations === 'object' &&
          configObj.dayConfigurations !== null &&
          (configObj.dayConfigurations as Record<string, unknown>)[day]
        ) {
          const dayConfig = (
            configObj.dayConfigurations as Record<string, unknown>
          )[day]

          // Type guard to check if dayConfig is an object
          if (typeof dayConfig === 'object' && dayConfig !== null) {
            const dayConfigObj = dayConfig as Record<string, unknown>

            // Merge with default day config
            migrated.dayConfigurations[day] = {
              enabledShiftTypes:
                (Array.isArray(dayConfigObj.enabledShiftTypes)
                  ? dayConfigObj.enabledShiftTypes
                  : null) || migrated.dayConfigurations[day].enabledShiftTypes,
              shiftSkillRequirements: {
                ...migrated.dayConfigurations[day].shiftSkillRequirements,
                ...(typeof dayConfigObj.shiftSkillRequirements === 'object' &&
                dayConfigObj.shiftSkillRequirements !== null
                  ? dayConfigObj.shiftSkillRequirements
                  : {}),
              },
              shiftStaffRequirements: {
                ...migrated.dayConfigurations[day].shiftStaffRequirements,
                ...(typeof dayConfigObj.shiftStaffRequirements === 'object' &&
                dayConfigObj.shiftStaffRequirements !== null
                  ? dayConfigObj.shiftStaffRequirements
                  : {}),
              },
            }
          }
        }
      })
    }

    // Handle legacy format migration (from old SchedulingConstraints)
    if (configObj.weekendScheduleEnabled && configObj.weekendShiftTypes) {
      // Migrate weekend settings to Saturday/Sunday
      const weekendConfig: DayScheduleConfig = {
        enabledShiftTypes: configObj.weekendShiftTypes as any,
        shiftSkillRequirements: {
          ...defaultDayConfig.shiftSkillRequirements,
          ...((configObj.weekendShiftSkillRequirements as any) || {}),
        },
        shiftStaffRequirements: {
          ...defaultDayConfig.shiftStaffRequirements,
          ...((configObj.weekendShiftStaffRequirements as any) || {}),
        },
      }

      migrated.dayConfigurations.saturday = { ...weekendConfig }
      migrated.dayConfigurations.sunday = { ...weekendConfig }

      // Set weekday config from legacy settings
      if (
        configObj.shiftSkillRequirements ||
        configObj.shiftStaffRequirements
      ) {
        const weekdayDays: DayOfWeek[] = [
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
        ]
        weekdayDays.forEach(day => {
          migrated.dayConfigurations[day] = {
            enabledShiftTypes: ['morning', 'afternoon', 'night'],
            shiftSkillRequirements: {
              ...defaultDayConfig.shiftSkillRequirements,
              ...((configObj.shiftSkillRequirements as any) || {}),
            },
            shiftStaffRequirements: {
              ...defaultDayConfig.shiftStaffRequirements,
              ...((configObj.shiftStaffRequirements as any) || {}),
            },
          }
        })
      }
    }

    return migrated
  }

  // Predefined templates
  static getTemplate(templateName: string): ScheduleConfiguration {
    switch (templateName) {
      case 'standard':
        return defaultConfiguration

      case '24-7-coverage':
        return {
          ...defaultConfiguration,
          dayConfigurations: {
            monday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            tuesday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            wednesday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            thursday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            friday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            saturday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            sunday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
          },
        }

      case 'weekend-day-shifts':
        return {
          ...defaultConfiguration,
          dayConfigurations: {
            monday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            tuesday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            wednesday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            thursday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            friday: {
              ...defaultDayConfig,
              enabledShiftTypes: ['morning', 'afternoon', 'night'],
            },
            saturday: { ...defaultDayConfig, enabledShiftTypes: ['day'] },
            sunday: { ...defaultDayConfig, enabledShiftTypes: ['day'] },
          },
        }

      case 'minimal-coverage':
        const minimalConfig = {
          ...defaultDayConfig,
          enabledShiftTypes: ['morning', 'afternoon'] as ShiftType[],
          shiftStaffRequirements: {
            ...defaultDayConfig.shiftStaffRequirements,
            morning: { minimum: 1, maximum: 2 },
            afternoon: { minimum: 1, maximum: 2 },
          },
        }
        return {
          ...defaultConfiguration,
          maxHoursPerWeek: 30,
          dayConfigurations: {
            monday: minimalConfig,
            tuesday: minimalConfig,
            wednesday: minimalConfig,
            thursday: minimalConfig,
            friday: minimalConfig,
            saturday: { ...minimalConfig, enabledShiftTypes: [] },
            sunday: { ...minimalConfig, enabledShiftTypes: [] },
          },
        }

      default:
        return defaultConfiguration
    }
  }

  static getAvailableTemplates(): Array<{
    id: string
    name: string
    description: string
  }> {
    return [
      {
        id: 'standard',
        name: 'Standard Schedule',
        description: 'Regular weekday shifts with weekend day shifts',
      },
      {
        id: '24-7-coverage',
        name: '24/7 Coverage',
        description:
          'Full coverage with morning, afternoon, and night shifts every day',
      },
      {
        id: 'weekend-day-shifts',
        name: 'Weekend Day Shifts',
        description:
          'Regular weekday shifts with single day shifts on weekends',
      },
      {
        id: 'minimal-coverage',
        name: 'Minimal Coverage',
        description:
          'Basic coverage with morning and afternoon shifts, weekends off',
      },
    ]
  }
}
