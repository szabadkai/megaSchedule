'use client'

import React, { useState, useEffect } from 'react'

import { generateMockStaff } from '@/lib/mockData'
import {
  ConfigurableScheduler,
  type SchedulingConstraints,
} from '@/lib/scheduler'
import { ScheduleStorage } from '@/lib/scheduleStorage'
import { ScheduleConfigStorage } from '@/lib/scheduleConfigStorage'
import { ConfigStorage } from '@/lib/configStorage'
import { DateUtils } from '@/lib/dateUtils'
import type { Schedule, Shift, DayOfWeek, Staff } from '@/types'

const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const SHIFT_TIMES = {
  morning: { start: '07:00', end: '15:00' },
  afternoon: { start: '15:00', end: '23:00' },
  night: { start: '23:00', end: '07:00' },
  day: { start: '07:00', end: '19:00' },
  fullday: { start: '00:00', end: '23:59' },
}

export default function SchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly')
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

  // Handle URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const weekParam = urlParams.get('week')
    const monthParam = urlParams.get('month')
    const viewParam = urlParams.get('view')

    if (monthParam) {
      setCurrentMonth(new Date(monthParam))
      setViewMode('monthly')
    } else if (weekParam) {
      setCurrentWeek(new Date(weekParam))
      setViewMode('weekly')
    } else if (viewParam === 'monthly') {
      setViewMode('monthly')
    }
  }, [])

  // Load mock staff data
  useEffect(() => {
    const mockStaff = generateMockStaff()
    setStaff(mockStaff)
  }, [])

  // Load saved schedule when period or view mode changes
  useEffect(() => {
    if (viewMode === 'weekly') {
      const weekStart = getWeekDates(currentWeek)[0].toISOString()
      const savedSchedule = ScheduleStorage.getScheduleForWeek(weekStart)
      setSchedule(savedSchedule)
    } else {
      const monthStart = DateUtils.getMonthStart(currentMonth).toISOString()
      const savedSchedule = ScheduleStorage.getScheduleForMonth(monthStart)
      setSchedule(savedSchedule)
    }
  }, [currentWeek, currentMonth, viewMode])

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
      // Load configuration from ScheduleConfigStorage
      const config = ScheduleConfigStorage.loadConfiguration()

      // Create a new ConfigurableScheduler with staff and config
      const scheduler = new ConfigurableScheduler(staff, config)

      let generatedSchedule: Schedule

      if (viewMode === 'weekly') {
        const weekDates = getWeekDates(currentWeek)
        generatedSchedule = scheduler.generateSchedule(
          weekDates[0].toISOString()
        )
      } else {
        // Monthly schedule generation
        const monthStart = DateUtils.getMonthStart(currentMonth).toISOString()
        generatedSchedule = scheduler.generateMonthlySchedule(monthStart)
      }

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

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = DateUtils.addMonths(
      currentMonth,
      direction === 'next' ? 1 : -1
    )
    setCurrentMonth(newMonth)
    // Schedule will be loaded in useEffect when currentMonth changes
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
    const assignedStaffIds = shift.assignedStaff || []
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
            View and manage {viewMode} schedules
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'weekly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📅 Weekly
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🗓️ Monthly
            </button>
          </div>

          {/* Navigation Controls */}
          <div className="flex space-x-2">
            {viewMode === 'weekly' ? (
              <>
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
              </>
            ) : (
              <>
                <button
                  onClick={() => navigateMonth('prev')}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  ← Previous Month
                </button>
                <button
                  onClick={() => navigateMonth('next')}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Next Month →
                </button>
              </>
            )}

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
              {isGenerating
                ? 'Generating...'
                : `Generate ${viewMode === 'weekly' ? 'Weekly' : 'Monthly'} Schedule`}
            </button>
          </div>
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
          {/* Configuration Link */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Schedule Configuration
                </h4>
                <p className="text-sm text-blue-700">
                  Configure shift types, requirements, and constraints for each
                  day of the week
                </p>
              </div>
              <a
                href="/schedule-config"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Configure Schedule
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            {viewMode === 'weekly'
              ? `Week of ${formatDate(weekDates[0])} - ${formatDate(weekDates[6])}`
              : DateUtils.formatMonthYear(currentMonth)}
          </h2>
          {viewMode === 'weekly' &&
            schedule &&
            schedule.id.includes('weekly-from-monthly') && (
              <p className="text-sm text-blue-600 mt-1">
                📅 Showing data from monthly schedule
              </p>
            )}
          {viewMode === 'monthly' && (
            <p className="text-sm text-gray-600 mt-1">
              {DateUtils.getDaysInMonth(currentMonth)} days •
              {schedule
                ? ` ${schedule.shifts.length} total shifts`
                : ' No schedule generated'}
            </p>
          )}
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
              No schedule generated for this{' '}
              {viewMode === 'weekly' ? 'week' : 'month'}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Click &quot;Generate Schedule&quot; to create a new {viewMode}{' '}
              schedule
            </p>
          </div>
        ) : viewMode === 'weekly' ? (
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
                {(() => {
                  // Get all unique shift types that exist in the schedule
                  const existingShiftTypes = Array.from(
                    new Set(schedule.shifts.map(shift => shift.type))
                  ).sort((a, b) => {
                    // Sort by preferred order: morning, afternoon, night, day, fullday
                    const order = [
                      'morning',
                      'afternoon',
                      'night',
                      'day',
                      'fullday',
                    ]
                    return order.indexOf(a) - order.indexOf(b)
                  })

                  return existingShiftTypes.map(shiftType => (
                    <tr key={shiftType}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div>
                          <div className="capitalize">
                            {shiftType === 'fullday' ? 'Full Day' : shiftType}
                          </div>
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
                                    {shift.assignedStaff.map(
                                      (staffId, index) => {
                                        const staffSkills =
                                          getStaffSkills(staffId)
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
                                      }
                                    )}
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
                  ))
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="monthly-schedule-view">
            {/* Monthly Calendar-style View */}
            <div className="grid grid-cols-1 gap-4">
              {(() => {
                // Group shifts by date for monthly view
                const shiftsByDate = new Map<string, Shift[]>()
                schedule.shifts.forEach(shift => {
                  const date = shift.date || 'unknown'
                  if (!shiftsByDate.has(date)) {
                    shiftsByDate.set(date, [])
                  }
                  shiftsByDate.get(date)!.push(shift)
                })

                // Note: sortedDates available if needed for other features

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-7 gap-1 mb-4">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                        day => (
                          <div
                            key={day}
                            className="text-center text-xs font-medium text-gray-500 py-2"
                          >
                            {day}
                          </div>
                        )
                      )}
                    </div>

                    {/* Monthly Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const monthDates = DateUtils.getMonthDates(currentMonth)
                        const firstDate = monthDates[0]
                        const firstDayOfWeek = firstDate.getDay() // 0=Sunday, 1=Monday, etc.

                        // Calculate padding for first week (Monday=0, Tuesday=1, etc. in our display)
                        // Convert Sunday=0 to Monday=6, and Monday=1 to Monday=0, etc.
                        const mondayBasedDay =
                          firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

                        // Debug: Log calendar positioning
                        console.log(
                          `First day of ${DateUtils.formatMonthYear(currentMonth)}: ${firstDate.toDateString()}, Day of week: ${firstDayOfWeek}, Padding cells: ${mondayBasedDay}`
                        )

                        const calendarCells = []

                        // Add empty cells for days before the first day of the month
                        for (let i = 0; i < mondayBasedDay; i++) {
                          calendarCells.push(
                            <div
                              key={`empty-${i}`}
                              className="min-h-24 p-1 border border-transparent"
                            ></div>
                          )
                        }

                        // Add all the actual month dates
                        monthDates.forEach(date => {
                          const dateString = DateUtils.formatDate(date)
                          const dayShifts = shiftsByDate.get(dateString) || []
                          const isToday = DateUtils.isToday(date)
                          const isWeekend = DateUtils.isWeekend(date)

                          calendarCells.push(
                            <div
                              key={dateString}
                              className={`min-h-24 p-1 border rounded text-xs ${
                                isToday
                                  ? 'bg-blue-50 border-blue-200'
                                  : isWeekend
                                    ? 'bg-gray-50 border-gray-200'
                                    : 'bg-white border-gray-200'
                              }`}
                            >
                              <div
                                className={`font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}
                              >
                                {date.getDate()}
                              </div>

                              {dayShifts.length > 0 ? (
                                <div className="space-y-1">
                                  {dayShifts.map(shift => {
                                    const isUnderstaffed =
                                      shift.assignedStaff.length <
                                      shift.minimumStaff
                                    return (
                                      <div
                                        key={shift.id}
                                        className={`px-1 py-0.5 rounded text-xs ${
                                          isUnderstaffed
                                            ? 'bg-red-100 text-red-700'
                                            : shift.assignedStaff.length === 0
                                              ? 'bg-yellow-100 text-yellow-700'
                                              : 'bg-green-100 text-green-700'
                                        }`}
                                        title={`${shift.type}: ${shift.assignedStaff.length}/${shift.minimumStaff}-${shift.maximumStaff} staff`}
                                      >
                                        <div className="font-medium">
                                          {shift.type === 'fullday'
                                            ? 'Full'
                                            : shift.type.substring(0, 3)}
                                        </div>
                                        <div>
                                          {shift.assignedStaff.length}/
                                          {shift.minimumStaff}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="text-gray-400 text-xs">
                                  No shifts
                                </div>
                              )}
                            </div>
                          )
                        })

                        return calendarCells
                      })().map((cell, index) => (
                        <React.Fragment key={`cell-${index}`}>
                          {cell}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Monthly Summary Stats */}
                    <div className="mt-6 bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Monthly Summary
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Total Shifts</div>
                          <div className="font-semibold">
                            {schedule.shifts.length}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Assigned</div>
                          <div className="font-semibold text-green-600">
                            {
                              schedule.shifts.filter(
                                s => s.assignedStaff.length > 0
                              ).length
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Understaffed</div>
                          <div className="font-semibold text-red-600">
                            {
                              schedule.shifts.filter(
                                s => s.assignedStaff.length < s.minimumStaff
                              ).length
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Unassigned</div>
                          <div className="font-semibold text-yellow-600">
                            {
                              schedule.shifts.filter(
                                s => s.assignedStaff.length === 0
                              ).length
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
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
                <span className="text-blue-600 font-medium">
                  {schedule.id.includes('weekly-from-monthly')
                    ? '📅 From Monthly'
                    : '✓ Saved'}
                </span>
              </span>
              <span className="text-xs">
                Updated: {new Date(schedule.updatedAt).toLocaleString()}
              </span>
            </div>
            <div className="space-x-2">
              {!schedule.id.includes('weekly-from-monthly') ? (
                <>
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
                </>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  To edit this schedule, switch to monthly view
                </div>
              )}
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
