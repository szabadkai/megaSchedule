'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

import { ScheduleStorage, type StoredSchedule } from '@/lib/scheduleStorage'

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<StoredSchedule[]>([])
  const [filter, setFilter] = useState<'all' | 'published' | 'drafts'>('all')

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = () => {
    const allSchedules = ScheduleStorage.getAllSchedules()
    setSchedules(allSchedules)
  }

  const filteredSchedules = schedules.filter(schedule => {
    if (filter === 'published') return schedule.isPublished
    if (filter === 'drafts') return !schedule.isPublished
    return true
  })

  const deleteSchedule = (schedule: StoredSchedule) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      if (schedule.scheduleType === 'monthly' && schedule.monthStart) {
        ScheduleStorage.deleteMonthlySchedule(schedule.monthStart)
      } else {
        ScheduleStorage.deleteSchedule(schedule.weekStart)
      }
      loadSchedules()
    }
  }

  const togglePublished = (schedule: StoredSchedule) => {
    if (schedule.scheduleType === 'monthly' && schedule.monthStart) {
      ScheduleStorage.updateMonthlyScheduleStatus(
        schedule.monthStart,
        !schedule.isPublished
      )
    } else {
      ScheduleStorage.updateScheduleStatus(
        schedule.weekStart,
        !schedule.isPublished
      )
    }
    loadSchedules()
  }

  const exportSchedules = () => {
    const data = ScheduleStorage.exportSchedules()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedules-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatSchedulePeriod = (schedule: StoredSchedule) => {
    if (schedule.scheduleType === 'monthly' && schedule.monthStart) {
      const monthDate = new Date(schedule.monthStart)
      return {
        primary: monthDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
        }),
        secondary: `Month of ${monthDate.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })}`,
      }
    } else {
      // Weekly schedule
      const start = new Date(schedule.weekStart)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)

      return {
        primary: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        secondary: `Week of ${start.toLocaleDateString()}`,
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schedule History</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage all saved schedules
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={exportSchedules}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Export All
          </button>
          <Link
            href="/schedule"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Create New
          </Link>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex space-x-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({schedules.length})
            </button>
            <button
              onClick={() => setFilter('published')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                filter === 'published'
                  ? 'bg-green-100 text-green-800'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Published ({schedules.filter(s => s.isPublished).length})
            </button>
            <button
              onClick={() => setFilter('drafts')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                filter === 'drafts'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Drafts ({schedules.filter(s => !s.isPublished).length})
            </button>
          </div>
        </div>

        {filteredSchedules.length === 0 ? (
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
            <p className="text-gray-500 text-lg">No schedules found</p>
            <p className="text-gray-400 text-sm mt-2">
              Create your first schedule to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Shifts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSchedules.map(schedule => {
                  const periodInfo = formatSchedulePeriod(schedule)
                  const scheduleKey =
                    schedule.scheduleType === 'monthly'
                      ? schedule.monthStart
                      : schedule.weekStart

                  return (
                    <tr key={scheduleKey} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {periodInfo.primary}
                        </div>
                        <div className="text-sm text-gray-500">
                          {periodInfo.secondary}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            schedule.scheduleType === 'monthly'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {schedule.scheduleType === 'monthly'
                            ? '🗓️ Monthly'
                            : '📅 Weekly'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            schedule.isPublished
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {schedule.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {schedule.shifts.length} shifts
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(schedule.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Link
                          href={
                            schedule.scheduleType === 'monthly' &&
                            schedule.monthStart
                              ? `/schedule?month=${schedule.monthStart}&view=monthly`
                              : `/schedule?week=${schedule.weekStart}`
                          }
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => togglePublished(schedule)}
                          className={`${
                            schedule.isPublished
                              ? 'text-yellow-600 hover:text-yellow-900'
                              : 'text-green-600 hover:text-green-900'
                          }`}
                        >
                          {schedule.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => deleteSchedule(schedule)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
