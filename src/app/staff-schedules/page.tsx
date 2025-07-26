'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

import { generateMockStaff } from '@/lib/mockData'
import { ScheduleStorage, type StoredSchedule } from '@/lib/scheduleStorage'
import type { Staff, Shift, DayOfWeek, ShiftType } from '@/types'

const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

interface StaffShiftSummary {
  staff: Staff
  shifts: Shift[]
  totalHours: number
  shiftCounts: Record<ShiftType, number>
  dayCounts: Record<DayOfWeek, number>
}

export default function StaffSchedulesPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [schedules, setSchedules] = useState<StoredSchedule[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [sortBy, setSortBy] = useState<'name' | 'hours' | 'shifts'>('name')
  const [filterBy, setFilterBy] = useState<'all' | 'assigned' | 'unassigned'>(
    'all'
  )

  useEffect(() => {
    // Load staff and schedules
    const mockStaff = generateMockStaff()
    setStaff(mockStaff)

    const allSchedules = ScheduleStorage.getAllSchedules()
    setSchedules(allSchedules)

    // Set most recent week as default
    if (allSchedules.length > 0) {
      setSelectedWeek(allSchedules[0].weekStart)
    }
  }, [])

  const calculateStaffSummaries = (): StaffShiftSummary[] => {
    const selectedSchedule = schedules.find(s => s.weekStart === selectedWeek)
    if (!selectedSchedule) {
      return staff.map(s => ({
        staff: s,
        shifts: [],
        totalHours: 0,
        shiftCounts: { morning: 0, afternoon: 0, night: 0 },
        dayCounts: {
          monday: 0,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 0,
          sunday: 0,
        },
      }))
    }

    return staff.map(staffMember => {
      const assignedShifts = selectedSchedule.shifts.filter(shift =>
        shift.assignedStaff.includes(staffMember.id)
      )

      const totalHours = assignedShifts.length * 8 // Assuming 8 hours per shift

      const shiftCounts: Record<ShiftType, number> = {
        morning: 0,
        afternoon: 0,
        night: 0,
      }
      const dayCounts: Record<DayOfWeek, number> = {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
      }

      assignedShifts.forEach(shift => {
        shiftCounts[shift.type]++
        dayCounts[shift.day]++
      })

      return {
        staff: staffMember,
        shifts: assignedShifts,
        totalHours,
        shiftCounts,
        dayCounts,
      }
    })
  }

  const staffSummaries = calculateStaffSummaries()

  const filteredAndSortedSummaries = staffSummaries
    .filter(summary => {
      if (filterBy === 'assigned') return summary.shifts.length > 0
      if (filterBy === 'unassigned') return summary.shifts.length === 0
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.staff.name.localeCompare(b.staff.name)
        case 'hours':
          return b.totalHours - a.totalHours
        case 'shifts':
          return b.shifts.length - a.shifts.length
        default:
          return 0
      }
    })

  const formatWeekRange = (weekStart: string) => {
    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
  }

  const getShiftBadgeColor = (shiftType: ShiftType) => {
    switch (shiftType) {
      case 'morning':
        return 'bg-yellow-100 text-yellow-800'
      case 'afternoon':
        return 'bg-blue-100 text-blue-800'
      case 'night':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const exportStaffSchedules = () => {
    if (!selectedWeek) return

    const selectedSchedule = schedules.find(s => s.weekStart === selectedWeek)
    if (!selectedSchedule) return

    // Create matrix with shifts as rows and staff as columns
    const shiftRows: string[][] = []

    // Header row with staff names
    const staffNames = staff.filter(s => s.isActive).map(s => s.name)
    const headerRow = ['Shift', 'Day', 'Time', ...staffNames]
    shiftRows.push(headerRow)

    // Group shifts by day and type for better organization
    const shiftsByDayAndType: { [key: string]: Shift[] } = {}

    DAYS_OF_WEEK.forEach(day => {
      ;['morning', 'afternoon', 'night'].forEach(shiftType => {
        const key = `${day}-${shiftType}`
        shiftsByDayAndType[key] = selectedSchedule.shifts.filter(
          shift => shift.day === day && shift.type === shiftType
        )
      })
    })

    // Create rows for each shift
    Object.entries(shiftsByDayAndType).forEach(([key, shifts]) => {
      if (shifts.length > 0) {
        const shift = shifts[0] // Take first shift (should only be one per day/type combo)
        const [day, type] = key.split('-')

        const row = [
          type.charAt(0).toUpperCase() + type.slice(1), // Capitalize shift type
          day.charAt(0).toUpperCase() + day.slice(1), // Capitalize day
          `${shift.startTime} - ${shift.endTime}`,
          ...staff
            .filter(s => s.isActive)
            .map(staffMember =>
              shift.assignedStaff.includes(staffMember.id) ? 'X' : ''
            ),
        ]
        shiftRows.push(row)
      }
    })

    // Add summary rows
    shiftRows.push([]) // Empty row for separation
    shiftRows.push([
      'SUMMARY',
      '',
      '',
      ...staff
        .filter(s => s.isActive)
        .map(staffMember => {
          const summary = staffSummaries.find(
            s => s.staff.id === staffMember.id
          )
          return `${summary?.shifts.length || 0} shifts`
        }),
    ])

    shiftRows.push([
      'TOTAL HOURS',
      '',
      '',
      ...staff
        .filter(s => s.isActive)
        .map(staffMember => {
          const summary = staffSummaries.find(
            s => s.staff.id === staffMember.id
          )
          return `${summary?.totalHours || 0}h`
        }),
    ])

    const csvContent = shiftRows.map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `staff-schedule-matrix-${selectedWeek}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Schedules</h1>
          <p className="mt-1 text-sm text-gray-600">
            View individual staff schedules and workload distribution
          </p>
        </div>
        <div className="flex space-x-2">
          {selectedWeek && (
            <button
              onClick={exportStaffSchedules}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Export Matrix CSV
            </button>
          )}
          <Link
            href="/schedule"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Edit Schedules
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Week
            </label>
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a week...</option>
              {schedules.map(schedule => (
                <option key={schedule.weekStart} value={schedule.weekStart}>
                  {formatWeekRange(schedule.weekStart)}{' '}
                  {schedule.isPublished ? '(Published)' : '(Draft)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={e =>
                setSortBy(e.target.value as 'name' | 'hours' | 'shifts')
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="name">Name</option>
              <option value="hours">Total Hours</option>
              <option value="shifts">Number of Shifts</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter
            </label>
            <select
              value={filterBy}
              onChange={e =>
                setFilterBy(e.target.value as 'all' | 'assigned' | 'unassigned')
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Staff</option>
              <option value="assigned">With Assignments</option>
              <option value="unassigned">No Assignments</option>
            </select>
          </div>
        </div>
      </div>

      {/* Workload Summary */}
      {selectedWeek && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Workload Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {
                  filteredAndSortedSummaries.filter(s => s.shifts.length > 0)
                    .length
                }
              </div>
              <div className="text-sm text-gray-600">Staff Assigned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(
                  filteredAndSortedSummaries.reduce(
                    (sum, s) => sum + s.totalHours,
                    0
                  ) /
                    filteredAndSortedSummaries.filter(s => s.shifts.length > 0)
                      .length
                ) || 0}
                h
              </div>
              <div className="text-sm text-gray-600">Avg Hours/Person</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {filteredAndSortedSummaries.reduce(
                  (sum, s) => sum + s.totalHours,
                  0
                )}
                h
              </div>
              <div className="text-sm text-gray-600">Total Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {filteredAndSortedSummaries.reduce(
                  (sum, s) => sum + s.shifts.length,
                  0
                )}
              </div>
              <div className="text-sm text-gray-600">Total Shifts</div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Schedule Cards */}
      {!selectedWeek ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            Please select a week to view staff schedules
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAndSortedSummaries.map(summary => (
            <div
              key={summary.staff.id}
              className="bg-white shadow rounded-lg p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {summary.staff.name}
                  </h3>
                  <p className="text-sm text-gray-600">{summary.staff.email}</p>
                  <p className="text-sm text-gray-600">
                    Skills: {summary.staff.skills.join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {summary.totalHours}h
                  </div>
                  <div className="text-sm text-gray-600">
                    {summary.shifts.length} shifts
                  </div>
                  <div
                    className={`text-xs px-2 py-1 rounded mt-1 ${
                      summary.totalHours === 0
                        ? 'bg-gray-100 text-gray-600'
                        : summary.totalHours < 30
                          ? 'bg-yellow-100 text-yellow-700'
                          : summary.totalHours > 45
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {summary.totalHours === 0
                      ? 'No shifts'
                      : summary.totalHours < 30
                        ? 'Light week'
                        : summary.totalHours > 45
                          ? 'Heavy week'
                          : 'Balanced'}
                  </div>
                </div>
              </div>

              {summary.shifts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No shifts assigned this week
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-yellow-50 rounded">
                      <div className="font-medium">Morning</div>
                      <div>{summary.shiftCounts.morning}</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="font-medium">Afternoon</div>
                      <div>{summary.shiftCounts.afternoon}</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <div className="font-medium">Night</div>
                      <div>{summary.shiftCounts.night}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      Weekly Schedule
                    </h4>
                    <div className="space-y-1">
                      {DAYS_OF_WEEK.map(day => {
                        const dayShifts = summary.shifts.filter(
                          shift => shift.day === day
                        )
                        return (
                          <div
                            key={day}
                            className="flex justify-between items-center text-sm"
                          >
                            <span className="capitalize font-medium w-20">
                              {day}
                            </span>
                            <div className="flex space-x-1 flex-1">
                              {dayShifts.length === 0 ? (
                                <span className="text-gray-400">Off</span>
                              ) : (
                                dayShifts.map((shift, index) => (
                                  <span
                                    key={index}
                                    className={`px-2 py-1 rounded text-xs ${getShiftBadgeColor(shift.type)}`}
                                  >
                                    {shift.type}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
