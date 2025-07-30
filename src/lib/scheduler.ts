import type {
  Staff,
  Shift,
  Schedule,
  ShiftType,
  DayOfWeek,
  ScheduleConfiguration,
} from '@/types'

import { DateUtils } from './dateUtils'

// Legacy interface for backwards compatibility
export interface SchedulingConstraints {
  maxConsecutiveShifts: number
  minRestHoursBetweenShifts: number
  maxHoursPerWeek: number
  requireSkillMatch: boolean
  minimumSkillsRequired: boolean // If true, staff without required skills cannot be assigned

  // Weekend scheduling options
  weekendScheduleEnabled: boolean // If true, use different schedule for weekends

  // Required skills by shift type (weekdays)
  shiftSkillRequirements: {
    morning: string[]
    afternoon: string[]
    night: string[]
  }

  // Minimum staff requirements by shift type (weekdays)
  shiftStaffRequirements: {
    morning: { minimum: number; maximum: number }
    afternoon: { minimum: number; maximum: number }
    night: { minimum: number; maximum: number }
  }

  // Weekend-specific requirements (used when weekendScheduleEnabled = true)
  weekendShiftSkillRequirements: {
    morning: string[]
    afternoon: string[]
    night: string[]
    day: string[] // 12-hour day shift
  }

  weekendShiftStaffRequirements: {
    morning: { minimum: number; maximum: number }
    afternoon: { minimum: number; maximum: number }
    night: { minimum: number; maximum: number }
    day: { minimum: number; maximum: number } // 12-hour day shift
  }

  // Which shifts to use for weekends
  weekendShiftTypes: ('morning' | 'afternoon' | 'night' | 'day')[]

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
      weekendScheduleEnabled: false,
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
      weekendShiftSkillRequirements: {
        morning: ['nursing'],
        afternoon: ['nursing'],
        night: ['nursing', 'emergency care'],
        day: ['nursing', 'patient care'],
      },
      weekendShiftStaffRequirements: {
        morning: { minimum: 1, maximum: 3 },
        afternoon: { minimum: 1, maximum: 3 },
        night: { minimum: 2, maximum: 3 },
        day: { minimum: 2, maximum: 4 },
      },
      weekendShiftTypes: ['day', 'night'],
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
    // Simple calculation - assume 8 hours per shift, 12 for day shift
    // In a real implementation, you'd parse start/end times
    const shiftHours: Record<ShiftType, number> = {
      morning: 8,
      afternoon: 8,
      night: 8,
      day: 12, // 12-hour weekend day shift
      fullday: 24, // 24-hour full day shift
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
    const times = { morning: 7, afternoon: 15, night: 23, day: 7, fullday: 0 }
    return times[shiftType] || 7
  }

  private getShiftEndHour(shiftType: ShiftType): number {
    const times = { morning: 15, afternoon: 23, night: 7, day: 19, fullday: 23 }
    return times[shiftType] || 15
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

// New scheduler that uses ScheduleConfiguration
export class ConfigurableScheduler {
  private staff: Staff[]
  private config: ScheduleConfiguration

  constructor(staff: Staff[], config: ScheduleConfiguration) {
    this.staff = staff
    this.config = config
  }

  generateSchedule(weekStartDate: string): Schedule {
    const shifts: Shift[] = []
    const daysOfWeek: DayOfWeek[] = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]

    // Generate shifts for each day based on day-specific configuration
    daysOfWeek.forEach(day => {
      const dayConfig = this.config.dayConfigurations[day]

      dayConfig.enabledShiftTypes.forEach(shiftType => {
        const skillRequirements =
          dayConfig.shiftSkillRequirements[shiftType] || []
        const staffReq = dayConfig.shiftStaffRequirements[shiftType] || {
          minimum: 2,
          maximum: 4,
        }

        const shift: Shift = {
          id: `${day}-${shiftType}-${Date.now()}-${Math.random()}`,
          type: shiftType,
          day: day,
          startTime: this.getShiftStartTime(shiftType),
          endTime: this.getShiftEndTime(shiftType),
          requiredSkills: skillRequirements,
          minimumStaff: staffReq.minimum,
          maximumStaff: staffReq.maximum,
          assignedStaff: [],
        }

        shifts.push(shift)
      })
    })

    // Auto-assign staff to shifts using the same logic as the original scheduler
    this.autoAssignStaff(shifts)

    return {
      id: `schedule-${Date.now()}`,
      weekStartDate,
      scheduleType: 'weekly',
      shifts,
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  generateMonthlySchedule(monthStartDate: string): Schedule {
    const monthDate = new Date(monthStartDate)
    const monthDates = DateUtils.getMonthDates(monthDate)
    const shifts: Shift[] = []

    console.log(
      `Generating monthly schedule for ${DateUtils.formatMonthYear(monthDate)} (${monthDates.length} days)`
    )

    // Validation: ensure we have the expected number of days
    const expectedDays = DateUtils.getDaysInMonth(monthDate)
    if (monthDates.length !== expectedDays) {
      console.warn(`Expected ${expectedDays} days but got ${monthDates.length}`)
    }

    // Generate shifts for each day in the month
    monthDates.forEach(date => {
      const dayOfWeek = DateUtils.getDayOfWeek(date)
      const dayConfig = this.config.dayConfigurations[dayOfWeek]
      const dateString = DateUtils.formatDate(date)

      dayConfig.enabledShiftTypes.forEach(shiftType => {
        const skillRequirements =
          dayConfig.shiftSkillRequirements[shiftType] || []
        const staffReq = dayConfig.shiftStaffRequirements[shiftType] || {
          minimum: 2,
          maximum: 4,
        }

        const shift: Shift = {
          id: `${dateString}-${shiftType}-${Date.now()}-${Math.random()}`,
          type: shiftType,
          day: dayOfWeek,
          date: dateString,
          startTime: this.getShiftStartTime(shiftType),
          endTime: this.getShiftEndTime(shiftType),
          requiredSkills: skillRequirements,
          minimumStaff: staffReq.minimum,
          maximumStaff: staffReq.maximum,
          assignedStaff: [],
        }

        shifts.push(shift)
      })
    })

    console.log(`Generated ${shifts.length} shifts for monthly schedule`)

    // Auto-assign staff to shifts with enhanced monthly logic
    this.autoAssignMonthlyStaff(shifts)

    return {
      id: `monthly-schedule-${Date.now()}`,
      weekStartDate: DateUtils.formatDate(monthDate), // Keep for compatibility
      monthStartDate: DateUtils.formatDate(DateUtils.getMonthStart(monthDate)),
      scheduleType: 'monthly',
      shifts,
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  private getShiftStartTime(shiftType: ShiftType): string {
    const times = {
      morning: '07:00',
      afternoon: '15:00',
      night: '23:00',
      day: '07:00',
      fullday: '00:00',
    }
    return times[shiftType] || '07:00'
  }

  private getShiftEndTime(shiftType: ShiftType): string {
    const times = {
      morning: '15:00',
      afternoon: '23:00',
      night: '07:00',
      day: '19:00',
      fullday: '23:59',
    }
    return times[shiftType] || '15:00'
  }

  private autoAssignStaff(shifts: Shift[]) {
    const assignments = new Map<string, Shift[]>()

    // Initialize staff assignments
    this.staff.forEach(staff => {
      if (staff.isActive) {
        assignments.set(staff.id, [])
      }
    })

    // Enhanced shift prioritization - fill hardest shifts first
    const sortedShifts = [...shifts].sort((a, b) => {
      const getPriorityScore = (shift: Shift) => {
        let priority = 0

        // Much higher priority for shifts with specific skill requirements (hardest to fill)
        if (shift.requiredSkills.length > 0) {
          priority += shift.requiredSkills.length * 20

          // Extra priority if required skills are rare among staff
          const staffWithSkills = this.staff.filter(
            s =>
              s.isActive &&
              shift.requiredSkills.some(skill => s.skills.includes(skill))
          ).length
          if (staffWithSkills < shift.minimumStaff * 2) {
            priority += 25 // Very hard to fill
          }
        }

        // High priority for shifts with tight staffing ratios
        const staffingRatio =
          shift.maximumStaff / Math.max(shift.minimumStaff, 1)
        if (staffingRatio < 1.5) {
          priority += 20 // Low flexibility
        }

        // Critical shift types priority
        const shiftTypePriority = {
          fullday: 30,
          night: 25,
          day: 15,
          morning: 10,
          afternoon: 5,
        }
        priority += shiftTypePriority[shift.type] || 0

        // Weekend shifts are harder to staff
        if (shift.day === 'saturday' || shift.day === 'sunday') {
          priority += 15
        }

        // Higher minimum staff = higher priority
        priority += shift.minimumStaff * 8

        // Consider available staff pool for this shift
        const availableStaff = this.staff.filter(staff => {
          if (!staff.isActive) return false

          // Basic skill check
          if (
            this.config.requireSkillMatch &&
            shift.requiredSkills.length > 0
          ) {
            const hasRequiredSkills = shift.requiredSkills.some(skill =>
              staff.skills.includes(skill)
            )
            if (this.config.minimumSkillsRequired && !hasRequiredSkills) {
              return false
            }
          }

          return true
        }).length

        // If very few staff can work this shift, prioritize it highly
        if (availableStaff < shift.minimumStaff * 1.5) {
          priority += 30
        }

        return priority
      }

      return getPriorityScore(b) - getPriorityScore(a)
    })

    // Assign staff to each shift
    for (const shift of sortedShifts) {
      // First, get ALL active staff as potential candidates - be very permissive
      const allActiveCandidates = this.staff.filter(staff => {
        if (!staff.isActive) return false

        // Only constraint: don't assign someone already working this exact shift
        const alreadyAssignedToShift = shift.assignedStaff.includes(staff.id)
        if (alreadyAssignedToShift) return false

        return true
      })

      // Score and sort candidates
      const scoredCandidates = allActiveCandidates
        .map(staff => ({
          staff,
          score: this.calculateStaffScore(
            staff,
            shift,
            assignments.get(staff.id) || []
          ),
        }))
        .sort((a, b) => b.score - a.score)

      // PRIORITY 1: Fill minimum staff requirements at ALL COSTS
      let assignedCount = 0

      // Step 1: Try to assign with good scores first (but not too picky)
      for (const candidate of scoredCandidates) {
        if (assignedCount >= shift.maximumStaff) break
        if (assignedCount >= shift.minimumStaff && candidate.score < 0) break // Once minimum is met, be more selective

        shift.assignedStaff.push(candidate.staff.id)
        assignments.get(candidate.staff.id)?.push(shift)
        assignedCount++
      }

      // Step 2: If we STILL don't have minimum staff, assign ANYONE available
      if (assignedCount < shift.minimumStaff) {
        console.warn(
          `Shift ${shift.day} ${shift.type} only has ${assignedCount}/${shift.minimumStaff} staff - using emergency assignment`
        )

        // Get any remaining active staff not already assigned to this shift
        const emergencyStaff = this.staff.filter(staff => {
          return staff.isActive && !shift.assignedStaff.includes(staff.id)
        })

        // Assign anyone we can find until we hit minimum
        for (const staff of emergencyStaff) {
          if (assignedCount >= shift.minimumStaff) break
          if (assignedCount >= shift.maximumStaff) break

          console.warn(
            `Emergency assignment: ${staff.name} to ${shift.day} ${shift.type}`
          )
          shift.assignedStaff.push(staff.id)
          assignments.get(staff.id)?.push(shift)
          assignedCount++
        }
      }

      // Log final assignment status
      if (assignedCount < shift.minimumStaff) {
        console.error(
          `CRITICAL: ${shift.day} ${shift.type} shift only has ${assignedCount}/${shift.minimumStaff} staff - UNDERSTAFFED!`
        )
      }
    }
  }

  private calculateStaffScore(
    staff: Staff,
    shift: Shift,
    currentAssignments: Shift[]
  ): number {
    let score = 50 // Start with a positive base score so most staff are viable

    // Preferred shift bonus/penalty (much smaller penalties)
    if (staff.preferences.preferredShifts.includes(shift.type)) {
      score += this.config.weights.preferredShift
    } else if (staff.preferences.preferredShifts.length > 0) {
      score += Math.max(this.config.weights.nonPreferredShift, -3) // Cap penalty at -3
    }

    // Preferred day off penalty (smaller penalty)
    if (staff.preferences.preferredDaysOff.includes(shift.day)) {
      score += Math.max(this.config.weights.preferredDayOff, -5) // Cap penalty at -5
    }

    // Skill matching bonus (smaller penalty for no skills)
    if (shift.requiredSkills.length > 0) {
      const matchingSkills = shift.requiredSkills.filter(skill =>
        staff.skills.includes(skill)
      ).length

      if (matchingSkills > 0) {
        score += matchingSkills * this.config.weights.matchingSkill
      } else {
        // Very small penalty - anyone can work if needed
        score -= 5
      }
    }

    // Workload balancing - favor underworked staff but don't penalize overworked too much
    const currentHours = this.calculateWeeklyHours(currentAssignments)
    const targetHours = staff.preferences.desiredHoursPerWeek

    if (currentHours < targetHours) {
      // Staff needs more hours - bonus
      const hoursNeeded = targetHours - currentHours
      score += Math.min(hoursNeeded * 2, 20) // Smaller bonus, capped at 20
    } else if (currentHours > targetHours) {
      // Staff is already over target - small penalty
      const hoursOver = currentHours - targetHours
      score -= Math.min(hoursOver, 10) // Cap penalty at 10
    }

    // Workload distribution bonus (smaller bonuses and penalties)
    const totalShifts = this.staff.length > 0 ? Math.ceil(7 * 2.5) : 0
    const targetShiftsPerStaff =
      totalShifts / Math.max(this.staff.filter(s => s.isActive).length, 1)

    if (currentAssignments.length < targetShiftsPerStaff) {
      // Bonus for underworked staff
      const underworkBonus =
        (targetShiftsPerStaff - currentAssignments.length) * 3
      score += Math.min(underworkBonus, 15) // Cap bonus at 15
    } else if (currentAssignments.length > targetShiftsPerStaff) {
      // Small penalty for overworked staff
      const overworkPenalty =
        (currentAssignments.length - targetShiftsPerStaff) * 2
      score -= Math.min(overworkPenalty, 10) // Cap penalty at 10
    }

    // Holiday penalty (reduced but still significant)
    const shiftDate = this.getShiftDate()
    if (staff.preferences.holidays?.includes(shiftDate)) {
      score -= 30 // Reduced from 100 to 30
    }

    // Apply constraint penalties (but keep scores viable)
    const constraintPenalties = this.calculateConstraintPenalties(
      staff,
      shift,
      currentAssignments
    )
    score -= constraintPenalties

    return score // Don't enforce minimum - let negative scores be possible but prefer positive ones
  }

  private calculateConstraintPenalties(
    staff: Staff,
    shift: Shift,
    currentAssignments: Shift[]
  ): number {
    let penalty = 0

    // Small penalties for constraint violations (instead of hard blocks)
    if (this.violatesMaxConsecutive(shift, currentAssignments)) {
      penalty += 10 // Small penalty instead of blocking
    }

    if (this.violatesRestTime(shift, currentAssignments)) {
      penalty += 15 // Small penalty instead of blocking
    }

    if (this.violatesMaxHours(shift, currentAssignments)) {
      penalty += 20 // Penalty for going over hours, but still allow if needed
    }

    return penalty
  }

  private getShiftDate(): string {
    // Simple date calculation - in a real implementation, this would use the actual week dates
    // For now, return a placeholder format
    return `2024-01-01` // This should be replaced with actual date calculation
  }

  private violatesMaxConsecutive(
    shift: Shift,
    currentAssignments: Shift[]
  ): boolean {
    if (currentAssignments.length === 0) return false

    // Sort assignments by day to check consecutive patterns
    const sortedAssignments = [...currentAssignments].sort((a, b) => {
      const dayOrder = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]
      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
    })

    // Check if adding this shift would create too many consecutive shifts
    const dayOrder = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]
    const shiftDayIndex = dayOrder.indexOf(shift.day)

    let consecutiveCount = 1 // Count the new shift

    // Count consecutive shifts before this day
    for (let i = shiftDayIndex - 1; i >= 0; i--) {
      const dayName = dayOrder[i]
      if (sortedAssignments.some(s => s.day === dayName)) {
        consecutiveCount++
      } else {
        break
      }
    }

    // Count consecutive shifts after this day
    for (let i = shiftDayIndex + 1; i < dayOrder.length; i++) {
      const dayName = dayOrder[i]
      if (sortedAssignments.some(s => s.day === dayName)) {
        consecutiveCount++
      } else {
        break
      }
    }

    return consecutiveCount > this.config.maxConsecutiveShifts
  }

  private violatesMaxHours(shift: Shift, currentAssignments: Shift[]): boolean {
    const currentHours = this.calculateWeeklyHours(currentAssignments)
    const shiftHours = this.getShiftHours(shift.type)
    return currentHours + shiftHours > this.config.maxHoursPerWeek
  }

  private violatesRestTime(shift: Shift, currentAssignments: Shift[]): boolean {
    if (currentAssignments.length === 0) return false

    const dayOrder = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]
    const shiftDayIndex = dayOrder.indexOf(shift.day)
    const shiftStartHour = this.getShiftStartHour(shift.type)
    const shiftEndHour = this.getShiftEndHour(shift.type)

    // Check conflicts with shifts on adjacent days
    for (const assignment of currentAssignments) {
      const assignmentDayIndex = dayOrder.indexOf(assignment.day)
      const assignmentStartHour = this.getShiftStartHour(assignment.type)
      const assignmentEndHour = this.getShiftEndHour(assignment.type)

      // Check if this is an adjacent day
      const dayDiff = Math.abs(shiftDayIndex - assignmentDayIndex)

      if (dayDiff === 1) {
        // Adjacent days - check for adequate rest time
        let timeBetweenShifts: number

        if (shiftDayIndex > assignmentDayIndex) {
          // New shift is after existing shift
          timeBetweenShifts = shiftStartHour + (24 - assignmentEndHour)
          if (assignmentEndHour > shiftStartHour) {
            timeBetweenShifts = shiftStartHour + (24 - assignmentEndHour)
          }
        } else {
          // New shift is before existing shift
          timeBetweenShifts = assignmentStartHour + (24 - shiftEndHour)
          if (shiftEndHour > assignmentStartHour) {
            timeBetweenShifts = assignmentStartHour + (24 - shiftEndHour)
          }
        }

        if (timeBetweenShifts < this.config.minRestHoursBetweenShifts) {
          return true
        }
      } else if (dayDiff === 0) {
        // Same day - check for overlap
        const overlap = !(
          shiftEndHour <= assignmentStartHour ||
          assignmentEndHour <= shiftStartHour
        )
        if (overlap) {
          return true
        }
      }
    }

    return false
  }

  private getShiftStartHour(shiftType: string): number {
    const times = { morning: 7, afternoon: 15, night: 23, day: 7, fullday: 0 }
    return times[shiftType as keyof typeof times] || 7
  }

  private getShiftEndHour(shiftType: string): number {
    const times = { morning: 15, afternoon: 23, night: 7, day: 19, fullday: 24 }
    return times[shiftType as keyof typeof times] || 15
  }

  private calculateWeeklyHours(assignments: Shift[]): number {
    return assignments.reduce((total, shift) => {
      return total + this.getShiftHours(shift.type)
    }, 0)
  }

  private getShiftHours(shiftType: ShiftType): number {
    const hours = {
      morning: 8,
      afternoon: 8,
      night: 12,
      day: 12,
      fullday: 24,
    }
    return hours[shiftType] || 8
  }

  private autoAssignMonthlyStaff(shifts: Shift[]) {
    const assignments = new Map<string, Shift[]>()

    // Initialize staff assignments
    this.staff.forEach(staff => {
      if (staff.isActive) {
        assignments.set(staff.id, [])
      }
    })

    // Group shifts by date for better monthly tracking
    const shiftsByDate = new Map<string, Shift[]>()
    shifts.forEach(shift => {
      const date = shift.date || 'unknown'
      if (!shiftsByDate.has(date)) {
        shiftsByDate.set(date, [])
      }
      shiftsByDate.get(date)!.push(shift)
    })

    // Sort shifts with enhanced monthly priority
    const sortedShifts = [...shifts].sort((a, b) => {
      const getPriorityScore = (shift: Shift) => {
        let priority = 0

        // Same priority logic as weekly but with monthly considerations
        if (shift.requiredSkills.length > 0) {
          priority += shift.requiredSkills.length * 20

          const staffWithSkills = this.staff.filter(
            s =>
              s.isActive &&
              shift.requiredSkills.some(skill => s.skills.includes(skill))
          ).length
          if (staffWithSkills < shift.minimumStaff * 2) {
            priority += 25
          }
        }

        const staffingRatio =
          shift.maximumStaff / Math.max(shift.minimumStaff, 1)
        if (staffingRatio < 1.5) {
          priority += 20
        }

        const shiftTypePriority = {
          fullday: 30,
          night: 25,
          day: 15,
          morning: 10,
          afternoon: 5,
        }
        priority += shiftTypePriority[shift.type] || 0

        if (shift.day === 'saturday' || shift.day === 'sunday') {
          priority += 15
        }

        priority += shift.minimumStaff * 8

        // Monthly-specific: prioritize earlier dates slightly to build momentum
        if (shift.date) {
          const dayOfMonth = parseInt(shift.date.split('-')[2])
          priority += Math.max(0, 32 - dayOfMonth) * 0.5 // Small boost for earlier dates
        }

        return priority
      }

      return getPriorityScore(b) - getPriorityScore(a)
    })

    // Enhanced monthly assignment with better distribution
    for (const shift of sortedShifts) {
      const allActiveCandidates = this.staff.filter(staff => {
        if (!staff.isActive) return false
        const alreadyAssignedToShift = shift.assignedStaff.includes(staff.id)
        if (alreadyAssignedToShift) return false
        return true
      })

      // Calculate monthly-aware scores
      const scoredCandidates = allActiveCandidates
        .map(staff => ({
          staff,
          score: this.calculateMonthlyStaffScore(
            staff,
            shift,
            assignments.get(staff.id) || [],
            shifts
          ),
        }))
        .sort((a, b) => b.score - a.score)

      let assignedCount = 0

      // First pass: assign with good scores
      for (const candidate of scoredCandidates) {
        if (assignedCount >= shift.maximumStaff) break
        if (assignedCount >= shift.minimumStaff && candidate.score < 0) break

        shift.assignedStaff.push(candidate.staff.id)
        assignments.get(candidate.staff.id)?.push(shift)
        assignedCount++
      }

      // Emergency assignment if needed
      if (assignedCount < shift.minimumStaff) {
        console.warn(
          `Monthly schedule: Emergency assignment for ${shift.date} ${shift.type}`
        )

        const emergencyStaff = this.staff.filter(staff => {
          return staff.isActive && !shift.assignedStaff.includes(staff.id)
        })

        for (const staff of emergencyStaff) {
          if (assignedCount >= shift.minimumStaff) break
          if (assignedCount >= shift.maximumStaff) break

          shift.assignedStaff.push(staff.id)
          assignments.get(staff.id)?.push(shift)
          assignedCount++
        }
      }

      if (assignedCount < shift.minimumStaff) {
        console.error(
          `CRITICAL: Monthly ${shift.date} ${shift.type} shift understaffed: ${assignedCount}/${shift.minimumStaff}`
        )
      }
    }

    // Log monthly assignment summary
    const totalAssignments =
      assignments.size > 0
        ? Array.from(assignments.values()).reduce(
            (sum, shifts) => sum + shifts.length,
            0
          )
        : 0
    console.log(
      `Monthly schedule completed: ${totalAssignments} total assignments across ${this.staff.filter(s => s.isActive).length} staff`
    )
  }

  private calculateMonthlyStaffScore(
    staff: Staff,
    shift: Shift,
    currentAssignments: Shift[],
    allShifts: Shift[]
  ): number {
    let score = 50 // Base positive score

    // Standard scoring factors (same as weekly)
    if (staff.preferences.preferredShifts.includes(shift.type)) {
      score += this.config.weights.preferredShift
    } else if (staff.preferences.preferredShifts.length > 0) {
      score += Math.max(this.config.weights.nonPreferredShift, -3)
    }

    if (staff.preferences.preferredDaysOff.includes(shift.day)) {
      score += Math.max(this.config.weights.preferredDayOff, -5)
    }

    // Skill matching
    if (shift.requiredSkills.length > 0) {
      const matchingSkills = shift.requiredSkills.filter(skill =>
        staff.skills.includes(skill)
      ).length

      if (matchingSkills > 0) {
        score += matchingSkills * this.config.weights.matchingSkill
      } else {
        score -= 5
      }
    }

    // Monthly workload balancing - more sophisticated
    const monthlyHours = this.calculateMonthlyHours(currentAssignments)
    const targetMonthlyHours = staff.preferences.desiredHoursPerWeek * 4.33 // Approximate weeks per month

    if (monthlyHours < targetMonthlyHours * 0.8) {
      // Staff significantly under target
      score += 25
    } else if (monthlyHours < targetMonthlyHours) {
      // Staff somewhat under target
      score += 15
    } else if (monthlyHours > targetMonthlyHours * 1.2) {
      // Staff significantly over target
      score -= 15
    }

    // Monthly distribution bonus - favor staff with fewer assignments this month
    const monthlyAssignments = currentAssignments.length
    const averageMonthlyAssignments =
      allShifts.length / Math.max(this.staff.filter(s => s.isActive).length, 1)

    if (monthlyAssignments < averageMonthlyAssignments * 0.8) {
      score += 20 // Strong bonus for underutilized staff
    } else if (monthlyAssignments > averageMonthlyAssignments * 1.2) {
      score -= 10 // Penalty for overutilized staff
    }

    // Holiday penalty (check actual date)
    if (shift.date && staff.preferences.holidays?.includes(shift.date)) {
      score -= 30
    }

    // Constraint penalties (smaller for monthly flexibility)
    const constraintPenalties = this.calculateConstraintPenalties(
      staff,
      shift,
      currentAssignments
    )
    score -= constraintPenalties * 0.5 // Reduced impact for monthly scheduling

    return score
  }

  private calculateMonthlyHours(assignments: Shift[]): number {
    return assignments.reduce((total, shift) => {
      return total + this.getShiftHours(shift.type)
    }, 0)
  }
}
