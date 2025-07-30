export interface Staff {
  id: string
  name: string
  email: string
  skills: string[]
  preferences: StaffPreferences
  isActive: boolean
}

export interface StaffPreferences {
  desiredHoursPerWeek: number
  preferredShifts: ShiftType[]
  preferredDaysOff: DayOfWeek[]
  unavailableDates: string[]
  holidays: string[] // ISO date strings for holiday requests
}

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'day' | 'fullday'

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface Shift {
  id: string
  type: ShiftType
  day: DayOfWeek
  date?: string // ISO date string for monthly schedules (YYYY-MM-DD)
  startTime: string
  endTime: string
  requiredSkills: string[]
  minimumStaff: number
  maximumStaff: number
  assignedStaff: string[]
}

export interface Schedule {
  id: string
  weekStartDate: string
  monthStartDate?: string // For monthly schedules (YYYY-MM-01)
  scheduleType?: 'weekly' | 'monthly'
  shifts: Shift[]
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface Department {
  id: string
  name: string
  staff: Staff[]
  shiftTemplates: ShiftTemplate[]
  constraints: DepartmentConstraints
}

export interface ShiftTemplate {
  id: string
  type: ShiftType
  startTime: string
  endTime: string
  requiredSkills: string[]
  minimumStaff: number
  maximumStaff: number
  daysOfWeek: DayOfWeek[]
}

export interface DayScheduleConfig {
  enabledShiftTypes: ShiftType[]
  shiftSkillRequirements: Record<ShiftType, string[]>
  shiftStaffRequirements: Record<
    ShiftType,
    { minimum: number; maximum: number }
  >
}

export interface ScheduleConfiguration {
  // Global constraints
  maxConsecutiveShifts: number
  minRestHoursBetweenShifts: number
  maxHoursPerWeek: number
  minHoursPerWeek: number
  requireSkillMatch: boolean
  minimumSkillsRequired: boolean

  // Per-day configurations
  dayConfigurations: Record<DayOfWeek, DayScheduleConfig>

  // Weights
  weights: {
    preferredShift: number
    nonPreferredShift: number
    preferredDayOff: number
    matchingSkill: number
    needsMoreHours: number
  }
}

export interface DepartmentConstraints {
  maxConsecutiveShifts: number
  minRestHoursBetweenShifts: number
  maxHoursPerWeek: number
  minHoursPerWeek: number
}
