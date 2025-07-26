'use client'

import { useState, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

import { generateMockStaff } from '@/lib/mockData'
import type { Staff, StaffPreferences, ShiftType, DayOfWeek } from '@/types'

const SHIFT_TYPES: ShiftType[] = ['morning', 'afternoon', 'night']
const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)

  // Load mock data on component mount
  useEffect(() => {
    const mockStaff = generateMockStaff()
    setStaff(mockStaff)
  }, [])

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    skills: '',
    desiredHoursPerWeek: 40,
    preferredShifts: [] as ShiftType[],
    preferredDaysOff: [] as DayOfWeek[],
    holidays: [] as Date[],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const preferences: StaffPreferences = {
      desiredHoursPerWeek: formData.desiredHoursPerWeek,
      preferredShifts: formData.preferredShifts,
      preferredDaysOff: formData.preferredDaysOff,
      unavailableDates: [],
      holidays: formData.holidays.map(date => date.toISOString().split('T')[0]),
    }

    const newStaff: Staff = {
      id: editingStaff?.id || Date.now().toString(),
      name: formData.name,
      email: formData.email,
      skills: formData.skills.split(',').map(s => s.trim()),
      preferences,
      isActive: true,
    }

    if (editingStaff) {
      setStaff(staff.map(s => (s.id === editingStaff.id ? newStaff : s)))
    } else {
      setStaff([...staff, newStaff])
    }

    setShowForm(false)
    setEditingStaff(null)
    setFormData({
      name: '',
      email: '',
      skills: '',
      desiredHoursPerWeek: 40,
      preferredShifts: [],
      preferredDaysOff: [],
      holidays: [],
    })
  }

  const handleEdit = (staffMember: Staff) => {
    setEditingStaff(staffMember)
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      skills: staffMember.skills.join(', '),
      desiredHoursPerWeek: staffMember.preferences.desiredHoursPerWeek,
      preferredShifts: staffMember.preferences.preferredShifts,
      preferredDaysOff: staffMember.preferences.preferredDaysOff,
      holidays: (staffMember.preferences.holidays || []).map(
        dateStr => new Date(dateStr)
      ),
    })
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    setStaff(staff.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage team members and their scheduling preferences
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Add Staff Member
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Skills (comma-separated)
              </label>
              <input
                type="text"
                value={formData.skills}
                onChange={e =>
                  setFormData({ ...formData, skills: e.target.value })
                }
                placeholder="e.g. nursing, administration, emergency care"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Desired Hours Per Week
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={formData.desiredHoursPerWeek}
                onChange={e =>
                  setFormData({
                    ...formData,
                    desiredHoursPerWeek: parseInt(e.target.value),
                  })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Shifts
              </label>
              <div className="space-y-2">
                {SHIFT_TYPES.map(shift => (
                  <label key={shift} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.preferredShifts.includes(shift)}
                      onChange={e => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            preferredShifts: [
                              ...formData.preferredShifts,
                              shift,
                            ],
                          })
                        } else {
                          setFormData({
                            ...formData,
                            preferredShifts: formData.preferredShifts.filter(
                              s => s !== shift
                            ),
                          })
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">
                      {shift}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Days Off
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <label key={day} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.preferredDaysOff.includes(day)}
                      onChange={e => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            preferredDaysOff: [
                              ...formData.preferredDaysOff,
                              day,
                            ],
                          })
                        } else {
                          setFormData({
                            ...formData,
                            preferredDaysOff: formData.preferredDaysOff.filter(
                              d => d !== day
                            ),
                          })
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">
                      {day}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Holiday Requests
                </label>
                {formData.holidays.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, holidays: [] })}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <DatePicker
                selected={null}
                onChange={(date: Date | null) => {
                  if (date) {
                    // Check if date is already selected
                    const isAlreadySelected = formData.holidays.some(
                      holiday => holiday.getTime() === date.getTime()
                    )

                    if (isAlreadySelected) {
                      // Remove date if already selected
                      setFormData({
                        ...formData,
                        holidays: formData.holidays.filter(
                          holiday => holiday.getTime() !== date.getTime()
                        ),
                      })
                    } else {
                      // Add new date
                      setFormData({
                        ...formData,
                        holidays: [...formData.holidays, date],
                      })
                    }
                  }
                }}
                inline
                highlightDates={formData.holidays}
                dayClassName={date => {
                  const isSelected = formData.holidays.some(
                    holiday => holiday.getTime() === date.getTime()
                  )
                  return isSelected
                    ? 'react-datepicker__day--selected-custom'
                    : ''
                }}
                className="w-full"
                placeholderText="Click dates to select holidays"
              />
              <style jsx global>{`
                .react-datepicker__day--selected-custom {
                  background-color: #3b82f6 !important;
                  color: white !important;
                  border-radius: 50% !important;
                }
                .react-datepicker__day--selected-custom:hover {
                  background-color: #2563eb !important;
                }
              `}</style>
              <div className="mt-2 flex flex-wrap gap-1">
                {formData.holidays.map((date, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {date.toLocaleDateString()}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          holidays: formData.holidays.filter(
                            (_, i) => i !== index
                          ),
                        })
                      }}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Click calendar dates to select/deselect multiple holidays.
                Selected dates appear highlighted and as tags below. These dates
                will be strongly avoided when scheduling.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingStaff(null)
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {editingStaff ? 'Update' : 'Add'} Staff Member
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {staff.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">
              No staff members added yet. Click &quot;Add Staff Member&quot; to get
              started.
            </li>
          ) : (
            staff.map(staffMember => (
              <li key={staffMember.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        {staffMember.name}
                      </h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(staffMember)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(staffMember.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{staffMember.email}</p>
                    <div className="mt-2 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Skills:</span>{' '}
                        {staffMember.skills.join(', ')}
                      </p>
                      <p>
                        <span className="font-medium">Desired Hours:</span>{' '}
                        {staffMember.preferences.desiredHoursPerWeek}/week
                      </p>
                      <p>
                        <span className="font-medium">Preferred Shifts:</span>{' '}
                        {staffMember.preferences.preferredShifts.join(', ')}
                      </p>
                      <p>
                        <span className="font-medium">Preferred Days Off:</span>{' '}
                        {staffMember.preferences.preferredDaysOff.join(', ')}
                      </p>
                      <p>
                        <span className="font-medium">Holiday Requests:</span>{' '}
                        {staffMember.preferences.holidays?.join(', ') || 'None'}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
