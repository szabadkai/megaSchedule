'use client'

import { useState, useEffect } from 'react'

import { generateMockStaff } from '@/lib/mockData'
import { SimpleScheduler, type SchedulingConstraints } from '@/lib/scheduler'
import { ScheduleStorage } from '@/lib/scheduleStorage'
import { ConfigStorage } from '@/lib/configStorage'
import type { Schedule, Shift, DayOfWeek, ShiftType, Staff } from '@/types'

const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]
const SHIFT_TYPES: ShiftType[] = ['morning', 'afternoon', 'night']

const SHIFT_TIMES = {
  morning: { start: '07:00', end: '15:00' },
  afternoon: { start: '15:00', end: '23:00' },
  night: { start: '23:00', end: '07:00' },
}

export default function SchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [constraints, setConstraints] = useState<SchedulingConstraints>(() => {
    // Load saved configuration or use defaults
    return ConfigStorage.loadConfig() || ConfigStorage.getDefaultConfig()
  })

  // Load mock staff data and check for existing schedule on component mount
  useEffect(() => {
    const mockStaff = generateMockStaff()
    setStaff(mockStaff)

    // Check if there's a saved schedule for the current week
    const weekStart = getWeekDates(currentWeek)[0].toISOString()
    const savedSchedule = ScheduleStorage.getScheduleForWeek(weekStart)
    if (savedSchedule) {
      setSchedule(savedSchedule)
    }
  }, [])

  // Load saved schedule when week changes
  useEffect(() => {
    const weekStart = getWeekDates(currentWeek)[0].toISOString()
    const savedSchedule = ScheduleStorage.getScheduleForWeek(weekStart)
    if (savedSchedule) {
      setSchedule(savedSchedule)
    } else {
      setSchedule(null)
    }
  }, [currentWeek])

  // Save configuration whenever it changes
  useEffect(() => {
    ConfigStorage.saveConfig(constraints)
  }, [constraints])

  const getWeekDates = (date: Date) => {
    const week = []
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay() + 1) // Start from Monday

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      week.push(day)
    }
    return week
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const generateSmartSchedule = async () => {
    if (staff.length === 0) {
      alert('No staff members available. Please add staff first.')
      return
    }

    setIsGenerating(true)

    try {
      const weekDates = getWeekDates(currentWeek)
      const shiftTemplates: Shift[] = []

      // Create shift templates for the week
      weekDates.forEach((date, dayIndex) => {
        const dayName = DAYS_OF_WEEK[dayIndex]

        SHIFT_TYPES.forEach(shiftType => {
          // Use configured skill and staff requirements
          const requiredSkills =
            constraints.shiftSkillRequirements[shiftType] || []
          const staffReq = constraints.shiftStaffRequirements[shiftType]
          const minimumStaff = staffReq?.minimum || 2
          const maximumStaff = staffReq?.maximum || 4

          const shift: Shift = {
            id: `${dayName}-${shiftType}-${date.getTime()}`,
            type: shiftType,
            day: dayName,
            startTime: SHIFT_TIMES[shiftType].start,
            endTime: SHIFT_TIMES[shiftType].end,
            requiredSkills,
            minimumStaff,
            maximumStaff,
            assignedStaff: [],
          }
          shiftTemplates.push(shift)
        })
      })

      // Use the scheduler to assign staff
      const scheduler = new SimpleScheduler(staff)
      const generatedSchedule = scheduler.generateSchedule(
        weekDates[0].toISOString(),
        shiftTemplates,
        constraints
      )

      setSchedule(generatedSchedule)

      // Save the generated schedule (as draft)
      ScheduleStorage.saveSchedule(generatedSchedule)
    } catch (error) {
      console.error('Error generating schedule:', error)
      alert('Error generating schedule. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const getStaffName = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId)
    return staffMember ? staffMember.name : `Staff ${staffId}`
  }

  const getStaffSkills = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId)
    return staffMember ? staffMember.skills : []
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeek(newWeek)
    // Schedule will be loaded in useEffect when currentWeek changes
  }

  const toggleSchedulePublished = () => {
    if (schedule) {
      const updatedSchedule = {
        ...schedule,
        isPublished: !schedule.isPublished,
        updatedAt: new Date().toISOString(),
      }

      setSchedule(updatedSchedule)

      // Save the updated schedule status
      ScheduleStorage.saveSchedule(updatedSchedule)
    }
  }

  const editSchedule = () => {
    setEditMode(!editMode)
  }

  const openShiftEditor = (shift: Shift) => {
    setEditingShift(shift)
  }

  const closeShiftEditor = () => {
    setEditingShift(null)
  }

  const updateShiftAssignments = (
    shiftId: string,
    newAssignments: string[]
  ) => {
    if (!schedule) return

    const updatedShifts = schedule.shifts.map(shift =>
      shift.id === shiftId ? { ...shift, assignedStaff: newAssignments } : shift
    )

    const updatedSchedule = {
      ...schedule,
      shifts: updatedShifts,
      updatedAt: new Date().toISOString(),
    }

    setSchedule(updatedSchedule)
    ScheduleStorage.saveSchedule(updatedSchedule)
  }

  const getAvailableStaffForShift = (shift: Shift): Staff[] => {
    // Get staff that aren't already assigned to this shift
    const assignedStaffIds = shift.assignedStaff
    return staff.filter(s => !assignedStaffIds.includes(s.id) && s.isActive)
  }

  const removeStaffFromShift = (shiftId: string, staffId: string) => {
    if (!schedule) return

    const shift = schedule.shifts.find(s => s.id === shiftId)
    if (!shift) return

    const newAssignments = shift.assignedStaff.filter(id => id !== staffId)
    updateShiftAssignments(shiftId, newAssignments)
  }

  const addStaffToShift = (shiftId: string, staffId: string) => {
    if (!schedule) return

    const shift = schedule.shifts.find(s => s.id === shiftId)
    if (!shift) return

    // Check if shift is at maximum capacity
    if (shift.assignedStaff.length >= shift.maximumStaff) {
      alert('This shift is already at maximum capacity.')
      return
    }

    const newAssignments = [...shift.assignedStaff, staffId]
    updateShiftAssignments(shiftId, newAssignments)
  }

  const weekDates = getWeekDates(currentWeek)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schedule</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage weekly schedules
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => navigateWeek('prev')}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
          >
            ← Previous Week
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
          >
            Next Week →
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm font-medium"
          >
            ⚙️ Config
          </button>
          <button
            onClick={generateSmartSchedule}
            disabled={isGenerating || staff.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            {isGenerating ? 'Generating...' : 'Generate Schedule'}
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Schedule Configuration
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  const defaultConfig = ConfigStorage.getDefaultConfig()
                  setConstraints(defaultConfig)
                }}
                className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 border border-gray-300 rounded"
              >
                Reset to Defaults
              </button>
              <button
                onClick={() => {
                  const data = ConfigStorage.exportConfig()
                  navigator.clipboard.writeText(data)
                  alert('Configuration copied to clipboard!')
                }}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-300 rounded"
              >
                Export
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Constraints
              </h4>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm text-gray-600">
                    Max Consecutive Shifts
                  </span>
                  <input
                    type="number"
                    value={constraints.maxConsecutiveShifts}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        maxConsecutiveShifts: parseInt(e.target.value),
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">
                    Min Rest Hours Between Shifts
                  </span>
                  <input
                    type="number"
                    value={constraints.minRestHoursBetweenShifts}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        minRestHoursBetweenShifts: parseInt(e.target.value),
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">
                    Max Hours Per Week
                  </span>
                  <input
                    type="number"
                    value={constraints.maxHoursPerWeek}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        maxHoursPerWeek: parseInt(e.target.value),
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={constraints.requireSkillMatch}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        requireSkillMatch: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Require Skill Match
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={constraints.minimumSkillsRequired}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        minimumSkillsRequired: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Minimum Skills Required
                  </span>
                </label>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Skill Requirements by Shift
              </h4>
              <div className="space-y-3">
                {SHIFT_TYPES.map(shiftType => (
                  <div key={shiftType} className="space-y-2">
                    <label className="block">
                      <span className="text-sm text-gray-600 capitalize">
                        {shiftType} Shift Skills
                      </span>
                      <input
                        type="text"
                        value={constraints.shiftSkillRequirements[
                          shiftType
                        ].join(', ')}
                        onChange={e =>
                          setConstraints({
                            ...constraints,
                            shiftSkillRequirements: {
                              ...constraints.shiftSkillRequirements,
                              [shiftType]: e.target.value
                                .split(',')
                                .map(s => s.trim())
                                .filter(s => s.length > 0),
                            },
                          })
                        }
                        placeholder="Enter skills separated by commas"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-sm text-gray-600">Min Staff</span>
                        <input
                          type="number"
                          min="1"
                          value={
                            constraints.shiftStaffRequirements[shiftType]
                              .minimum
                          }
                          onChange={e =>
                            setConstraints({
                              ...constraints,
                              shiftStaffRequirements: {
                                ...constraints.shiftStaffRequirements,
                                [shiftType]: {
                                  ...constraints.shiftStaffRequirements[
                                    shiftType
                                  ],
                                  minimum: parseInt(e.target.value) || 1,
                                },
                              },
                            })
                          }
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm text-gray-600">Max Staff</span>
                        <input
                          type="number"
                          min="1"
                          value={
                            constraints.shiftStaffRequirements[shiftType]
                              .maximum
                          }
                          onChange={e =>
                            setConstraints({
                              ...constraints,
                              shiftStaffRequirements: {
                                ...constraints.shiftStaffRequirements,
                                [shiftType]: {
                                  ...constraints.shiftStaffRequirements[
                                    shiftType
                                  ],
                                  maximum: parseInt(e.target.value) || 1,
                                },
                              },
                            })
                          }
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Preference Weights
              </h4>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm text-gray-600">Preferred Shift</span>
                  <input
                    type="number"
                    value={constraints.weights.preferredShift}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        weights: {
                          ...constraints.weights,
                          preferredShift: parseInt(e.target.value),
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">
                    Non-Preferred Shift
                  </span>
                  <input
                    type="number"
                    value={constraints.weights.nonPreferredShift}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        weights: {
                          ...constraints.weights,
                          nonPreferredShift: parseInt(e.target.value),
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">
                    Preferred Day Off
                  </span>
                  <input
                    type="number"
                    value={constraints.weights.preferredDayOff}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        weights: {
                          ...constraints.weights,
                          preferredDayOff: parseInt(e.target.value),
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">Matching Skill</span>
                  <input
                    type="number"
                    value={constraints.weights.matchingSkill}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        weights: {
                          ...constraints.weights,
                          matchingSkill: parseInt(e.target.value),
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">
                    No Matching Skill
                  </span>
                  <input
                    type="number"
                    value={constraints.weights.noMatchingSkill}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        weights: {
                          ...constraints.weights,
                          noMatchingSkill: parseInt(e.target.value),
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">
                    Needs More Hours
                  </span>
                  <input
                    type="number"
                    value={constraints.weights.needsMoreHours}
                    onChange={e =>
                      setConstraints({
                        ...constraints,
                        weights: {
                          ...constraints.weights,
                          needsMoreHours: parseInt(e.target.value),
                        },
                      })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            Week of {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
          </h2>
        </div>

        {!schedule ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">
              No schedule generated for this week
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Click "Generate Schedule" to create a new schedule
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shift
                  </th>
                  {weekDates.map((date, index) => (
                    <th
                      key={index}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div>
                        <div className="font-medium">{DAYS_OF_WEEK[index]}</div>
                        <div className="text-gray-400">{formatDate(date)}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {SHIFT_TYPES.map(shiftType => (
                  <tr key={shiftType}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div>
                        <div className="capitalize">{shiftType}</div>
                        <div className="text-gray-500 text-xs">
                          {SHIFT_TIMES[shiftType].start} -{' '}
                          {SHIFT_TIMES[shiftType].end}
                        </div>
                      </div>
                    </td>
                    {DAYS_OF_WEEK.map(day => {
                      const shift = schedule.shifts.find(
                        s => s.day === day && s.type === shiftType
                      )
                      return (
                        <td
                          key={`${day}-${shiftType}`}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {shift ? (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <div className="text-xs text-gray-400">
                                  {shift.assignedStaff.length}/
                                  {shift.minimumStaff}-{shift.maximumStaff}{' '}
                                  staff
                                </div>
                                {editMode && (
                                  <button
                                    onClick={() => openShiftEditor(shift)}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                              {shift.assignedStaff.length === 0 ? (
                                <div className="text-red-500 text-xs">
                                  Unassigned
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {shift.assignedStaff.map((staffId, index) => {
                                    const staffSkills = getStaffSkills(staffId)
                                    return (
                                      <div
                                        key={index}
                                        className={`${
                                          editMode
                                            ? 'bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs relative group cursor-pointer flex justify-between items-center'
                                            : 'bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs relative group cursor-help'
                                        }`}
                                        title={`Skills: ${staffSkills.join(', ')}`}
                                      >
                                        <span>{getStaffName(staffId)}</span>
                                        {editMode && (
                                          <button
                                            onClick={() =>
                                              removeStaffFromShift(
                                                shift.id,
                                                staffId
                                              )
                                            }
                                            className="text-red-600 hover:text-red-800 ml-1"
                                          >
                                            ×
                                          </button>
                                        )}
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                          Skills: {staffSkills.join(', ')}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-400 text-xs">
                              No shift
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {schedule && (
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-500 space-x-4">
              <span>
                Status:{' '}
                {schedule.isPublished ? (
                  <span className="text-green-600 font-medium">Published</span>
                ) : (
                  <span className="text-yellow-600 font-medium">Draft</span>
                )}
              </span>
              <span>
                <span className="text-blue-600 font-medium">✓ Saved</span>
              </span>
              <span className="text-xs">
                Updated: {new Date(schedule.updatedAt).toLocaleString()}
              </span>
            </div>
            <div className="space-x-2">
              <button
                onClick={editSchedule}
                className={`${
                  editMode
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                } text-white px-4 py-2 rounded-md text-sm font-medium`}
              >
                {editMode ? 'Exit Edit Mode' : 'Edit Schedule'}
              </button>
              <button
                onClick={toggleSchedulePublished}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {schedule.isPublished ? 'Unpublish' : 'Publish'} Schedule
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Shift Editor Modal */}
      {editingShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Edit {editingShift.type} shift - {editingShift.day}
              </h3>
              <button
                onClick={closeShiftEditor}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  Time: {editingShift.startTime} - {editingShift.endTime}
                </div>
                <div>
                  Required Skills:{' '}
                  {editingShift.requiredSkills.join(', ') || 'None'}
                </div>
                <div>
                  Staff Range: {editingShift.minimumStaff} -{' '}
                  {editingShift.maximumStaff}
                </div>
                <div>
                  Currently Assigned: {editingShift.assignedStaff.length}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">
                  Currently Assigned Staff
                </h4>
                {editingShift.assignedStaff.length === 0 ? (
                  <p className="text-gray-500 text-sm">No staff assigned</p>
                ) : (
                  <div className="space-y-2">
                    {editingShift.assignedStaff.map(staffId => {
                      const staffMember = staff.find(s => s.id === staffId)
                      if (!staffMember) return null

                      return (
                        <div
                          key={staffId}
                          className="flex justify-between items-center bg-blue-50 p-3 rounded"
                        >
                          <div>
                            <div className="font-medium">
                              {staffMember.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              Skills: {staffMember.skills.join(', ')}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              removeStaffFromShift(editingShift.id, staffId)
                            }
                            className="text-red-600 hover:text-red-800 px-2 py-1 rounded"
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">
                  Available Staff
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {getAvailableStaffForShift(editingShift).map(staffMember => {
                    const hasRequiredSkills =
                      editingShift.requiredSkills.length === 0 ||
                      editingShift.requiredSkills.some(skill =>
                        staffMember.skills.includes(skill)
                      )

                    return (
                      <div
                        key={staffMember.id}
                        className={`flex justify-between items-center p-3 rounded ${
                          hasRequiredSkills ? 'bg-green-50' : 'bg-gray-50'
                        }`}
                      >
                        <div>
                          <div className="font-medium">{staffMember.name}</div>
                          <div className="text-sm text-gray-600">
                            Skills: {staffMember.skills.join(', ')}
                          </div>
                          {!hasRequiredSkills && (
                            <div className="text-xs text-orange-600">
                              ⚠ Missing required skills
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            addStaffToShift(editingShift.id, staffMember.id)
                          }
                          disabled={
                            editingShift.assignedStaff.length >=
                            editingShift.maximumStaff
                          }
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm"
                        >
                          Add
                        </button>
                      </div>
                    )
                  })}
                  {getAvailableStaffForShift(editingShift).length === 0 && (
                    <p className="text-gray-500 text-sm">No available staff</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={closeShiftEditor}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
