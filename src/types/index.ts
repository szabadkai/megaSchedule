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

export type ShiftType = 'morning' | 'afternoon' | 'night'

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

export interface DepartmentConstraints {
  maxConsecutiveShifts: number
  minRestHoursBetweenShifts: number
  maxHoursPerWeek: number
  minHoursPerWeek: number
}
