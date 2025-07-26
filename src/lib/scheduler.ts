import type { Staff, Shift, Schedule, ShiftType, DayOfWeek } from '@/types'

export interface SchedulingConstraints {
  maxConsecutiveShifts: number
  minRestHoursBetweenShifts: number
  maxHoursPerWeek: number
  requireSkillMatch: boolean
  minimumSkillsRequired: boolean // If true, staff without required skills cannot be assigned

  // Required skills by shift type
  shiftSkillRequirements: {
    morning: string[]
    afternoon: string[]
    night: string[]
  }

  // Minimum staff requirements by shift type
  shiftStaffRequirements: {
    morning: { minimum: number; maximum: number }
    afternoon: { minimum: number; maximum: number }
    night: { minimum: number; maximum: number }
  }

  // Scoring weights
  weights: {
    preferredShift: number // Bonus for preferred shift types
    nonPreferredShift: number // Penalty for non-preferred shifts
    preferredDayOff: number // Penalty for working on preferred day off
    matchingSkill: number // Bonus per matching skill
    noMatchingSkill: number // Penalty for no matching skills
    needsMoreHours: number // Bonus for staff needing more hours
  }
}

export class SimpleScheduler {
  private staff: Staff[]
  private constraints: SchedulingConstraints

  constructor(
    staff: Staff[],
    constraints: SchedulingConstraints = {
      maxConsecutiveShifts: 3,
      minRestHoursBetweenShifts: 12,
      maxHoursPerWeek: 48,
      requireSkillMatch: true,
      minimumSkillsRequired: false,
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
        preferredShift: 30,
        nonPreferredShift: -10,
        preferredDayOff: -20,
        matchingSkill: 15,
        noMatchingSkill: -15,
        needsMoreHours: 5,
      },
    }
  ) {
    this.staff = staff.filter(s => s.isActive)
    this.constraints = constraints
  }

  generateSchedule(
    weekStartDate: string,
    shiftTemplates: Shift[],
    customConstraints?: SchedulingConstraints
  ): Schedule {
    if (customConstraints) {
      this.constraints = customConstraints
    }
    const shifts = [...shiftTemplates]
    const staffAssignments = new Map<string, Shift[]>()

    // Initialize staff assignments
    this.staff.forEach(staff => {
      staffAssignments.set(staff.id, [])
    })

    // Sort shifts by priority (required skills, minimum staff)
    const sortedShifts = shifts.sort((a, b) => {
      const aPriority = a.requiredSkills.length + a.minimumStaff
      const bPriority = b.requiredSkills.length + b.minimumStaff
      return bPriority - aPriority
    })

    // Multi-pass assignment: strict preferences first, then relaxed
    sortedShifts.forEach(shift => {
      // Pass 1: Try with strict preferences
      let availableStaff = this.getAvailableStaff(shift, staffAssignments, true)
      let selectedStaff = this.selectBestStaff(shift, availableStaff)

      // Pass 2: If understaffed, try with relaxed constraints
      if (selectedStaff.length < shift.minimumStaff) {
        availableStaff = this.getAvailableStaff(shift, staffAssignments, false)
        selectedStaff = this.selectBestStaff(shift, availableStaff)
      }

      shift.assignedStaff = selectedStaff

      // Update staff assignments
      shift.assignedStaff.forEach(staffId => {
        const currentAssignments = staffAssignments.get(staffId) || []
        staffAssignments.set(staffId, [...currentAssignments, shift])
      })
    })

    return {
      id: `schedule-${Date.now()}`,
      weekStartDate,
      shifts,
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  private getAvailableStaff(
    shift: Shift,
    staffAssignments: Map<string, Shift[]>,
    strict: boolean = true
  ): Staff[] {
    return this.staff.filter(staff => {
      const currentAssignments = staffAssignments.get(staff.id) || []

      // Always check hard constraints first

      // Check max hours per week (hard constraint)
      const currentHours = this.calculateWeeklyHours(currentAssignments)
      const shiftHours = this.calculateShiftHours(shift)
      if (currentHours + shiftHours > this.constraints.maxHoursPerWeek) {
        return false
      }

      // Check rest time between shifts (hard constraint)
      if (this.violatesRestTime(shift, currentAssignments)) {
        return false
      }

      // Check consecutive shifts constraint (hard constraint)
      if (this.violatesConsecutiveShifts(shift, currentAssignments)) {
        return false
      }

      // Soft constraints - only apply in strict mode
      if (strict) {
        // Check if staff wants this day off (soft constraint)
        if (staff.preferences.preferredDaysOff.includes(shift.day)) {
          return false
        }

        // Check if staff has requested holiday on this date (strict constraint)
        const shiftDate = this.getShiftDate(shift)
        if (staff.preferences.holidays?.includes(shiftDate)) {
          return false
        }

        // Check if staff prefers this shift type (soft constraint)
        if (
          staff.preferences.preferredShifts.length > 0 &&
          !staff.preferences.preferredShifts.includes(shift.type)
        ) {
          return false
        }

        // Check skills match (soft constraint in strict mode)
        if (
          this.constraints.requireSkillMatch &&
          this.constraints.minimumSkillsRequired &&
          shift.requiredSkills.length > 0
        ) {
          const hasRequiredSkill = shift.requiredSkills.some(skill =>
            staff.skills.includes(skill)
          )
          if (!hasRequiredSkill) {
            return false
          }
        }
      }

      return true
    })
  }

  private selectBestStaff(shift: Shift, availableStaff: Staff[]): string[] {
    if (availableStaff.length === 0) {
      return []
    }

    // Score staff based on preferences and workload
    const scoredStaff = availableStaff.map(staff => ({
      staff,
      score: this.calculateStaffScore(staff, shift),
    }))

    // Sort by score (higher is better)
    scoredStaff.sort((a, b) => b.score - a.score)

    // Fix: Select staff count properly
    // We want to assign at least minimumStaff, but not more than available or maximum
    const selectedCount = Math.min(
      availableStaff.length, // Can't assign more than available
      Math.max(shift.minimumStaff, 1), // Always try to assign at least 1 if available
      shift.maximumStaff // Don't exceed maximum
    )

    return scoredStaff.slice(0, selectedCount).map(s => s.staff.id)
  }

  private calculateStaffScore(staff: Staff, shift: Shift): number {
    let score = 100
    const weights = this.constraints.weights

    // Bonus for preferred shift types
    if (staff.preferences.preferredShifts.includes(shift.type)) {
      score += weights.preferredShift
    } else if (staff.preferences.preferredShifts.length > 0) {
      // Penalty for non-preferred shifts, but still allow assignment
      score += weights.nonPreferredShift
    }

    // Penalty for preferred days off
    if (staff.preferences.preferredDaysOff.includes(shift.day)) {
      score += weights.preferredDayOff
    }

    // Strong penalty for working on holidays
    const shiftDate = this.getShiftDate(shift)
    const isOnHoliday = staff.preferences.holidays?.includes(shiftDate) || false
    if (isOnHoliday) {
      score += weights.preferredDayOff * 3 // Triple penalty for holidays
    }

    // Bonus for matching skills
    const matchingSkills = shift.requiredSkills.filter(skill =>
      staff.skills.includes(skill)
    ).length
    score += matchingSkills * weights.matchingSkill

    // Penalty for no matching skills (but still allow assignment)
    if (shift.requiredSkills.length > 0 && matchingSkills === 0) {
      score += weights.noMatchingSkill
    }

    // Bonus for staff who need more hours (simple heuristic)
    // Staff with lower desired hours get slight preference for shorter shifts
    if (staff.preferences.desiredHoursPerWeek < 40) {
      score += weights.needsMoreHours
    }

    // Randomize slightly to avoid always picking the same staff
    score += Math.random() * 5

    return Math.max(score, 10) // Ensure minimum score so everyone has a chance
  }

  private calculateWeeklyHours(assignments: Shift[]): number {
    return assignments.reduce((total, shift) => {
      return total + this.calculateShiftHours(shift)
    }, 0)
  }

  private calculateShiftHours(shift: Shift): number {
    // Simple calculation - assume 8 hours per shift
    // In a real implementation, you'd parse start/end times
    const shiftHours: Record<ShiftType, number> = {
      morning: 8,
      afternoon: 8,
      night: 8,
    }
    return shiftHours[shift.type] || 8
  }

  private violatesConsecutiveShifts(
    shift: Shift,
    currentAssignments: Shift[]
  ): boolean {
    if (currentAssignments.length === 0) return false

    // Get the day order for proper consecutive checking
    const dayOrder: DayOfWeek[] = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]
    const currentShiftDay = dayOrder.indexOf(shift.day)

    // Check for consecutive days worked
    const workedDays = currentAssignments
      .map(s => dayOrder.indexOf(s.day))
      .sort((a, b) => a - b)

    let consecutiveCount = 1
    for (let i = 1; i < workedDays.length; i++) {
      if (workedDays[i] === workedDays[i - 1] + 1) {
        consecutiveCount++
        if (consecutiveCount >= this.constraints.maxConsecutiveShifts) {
          // Check if adding this shift would extend the consecutive run
          if (currentShiftDay === workedDays[workedDays.length - 1] + 1) {
            return true
          }
        }
      } else {
        consecutiveCount = 1
      }
    }

    return false
  }

  private violatesRestTime(shift: Shift, currentAssignments: Shift[]): boolean {
    // Check for same-day conflicts (multiple shifts same day)
    const sameDayShifts = currentAssignments.filter(s => s.day === shift.day)

    if (sameDayShifts.length > 0) {
      // Allow multiple shifts per day only if there's enough rest time between them
      const shiftStartHour = this.getShiftStartHour(shift.type)

      for (const existingShift of sameDayShifts) {
        const existingEndHour = this.getShiftEndHour(existingShift.type)
        const timeDiff = Math.abs(shiftStartHour - existingEndHour)

        // Require at least 8 hours rest between shifts on same day
        if (timeDiff < 8) {
          return true
        }
      }
    }

    return false
  }

  private getShiftStartHour(shiftType: ShiftType): number {
    const times = { morning: 7, afternoon: 15, night: 23 }
    return times[shiftType]
  }

  private getShiftEndHour(shiftType: ShiftType): number {
    const times = { morning: 15, afternoon: 23, night: 7 }
    return times[shiftType]
  }

  private getShiftDate(shift: Shift): string {
    // Extract date from shift ID which includes timestamp
    // Format: dayName-shiftType-timestamp
    const parts = shift.id.split('-')
    if (parts.length >= 3) {
      const timestamp = parseInt(parts[2])
      if (!isNaN(timestamp)) {
        const date = new Date(timestamp)
        return date.toISOString().split('T')[0] // Return YYYY-MM-DD format
      }
    }

    // Fallback: use current week start date and calculate from day
    const weekStart = new Date()
    const dayIndex = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ].indexOf(shift.day)
    if (dayIndex !== -1) {
      const shiftDate = new Date(weekStart)
      shiftDate.setDate(weekStart.getDate() - weekStart.getDay() + 1 + dayIndex) // Monday = 1
      return shiftDate.toISOString().split('T')[0]
    }

    return new Date().toISOString().split('T')[0]
  }
}
