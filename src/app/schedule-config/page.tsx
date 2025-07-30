'use client'

import { useState, useEffect } from 'react'

import { DayOfWeek, ShiftType } from '@/types'
import { ScheduleConfigStorage } from '@/lib/scheduleConfigStorage'

const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const SHIFT_TYPES: ShiftType[] = [
  'morning',
  'afternoon',
  'night',
  'day',
  'fullday',
]

interface DayScheduleConfig {
  enabledShiftTypes: ShiftType[]
  shiftSkillRequirements: Record<ShiftType, string[]>
  shiftStaffRequirements: Record<
    ShiftType,
    { minimum: number; maximum: number }
  >
}

interface ScheduleConfiguration {
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

export default function ScheduleConfigPage() {
  const [config, setConfig] =
    useState<ScheduleConfiguration>(defaultConfiguration)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday')
  const [activeTab, setActiveTab] = useState<'days' | 'global' | 'weights'>(
    'days'
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string>('')

  // Load configuration on mount
  useEffect(() => {
    const loadedConfig = ScheduleConfigStorage.loadConfiguration()
    setConfig(loadedConfig)
  }, [])

  const currentDayConfig = config.dayConfigurations[selectedDay]

  const updateDayConfig = (
    day: DayOfWeek,
    updates: Partial<DayScheduleConfig>
  ) => {
    setConfig(prev => ({
      ...prev,
      dayConfigurations: {
        ...prev.dayConfigurations,
        [day]: {
          ...prev.dayConfigurations[day],
          ...updates,
        },
      },
    }))
  }

  const getShiftDuration = (shiftType: ShiftType) => {
    switch (shiftType) {
      case 'morning':
      case 'afternoon':
        return '8h'
      case 'night':
      case 'day':
        return '12h'
      case 'fullday':
        return '24h'
      default:
        return '8h'
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')

    try {
      ScheduleConfigStorage.saveConfiguration(config)
      setSaveMessage('Configuration saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch {
      setSaveMessage('Failed to save configuration. Please try again.')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (
      confirm(
        'Are you sure you want to reset to default configuration? This will lose all your current settings.'
      )
    ) {
      const defaultConfig = ScheduleConfigStorage.resetToDefaults()
      setConfig(defaultConfig)
      setSaveMessage('Configuration reset to defaults!')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const handleLoadTemplate = (templateId: string) => {
    try {
      const templateConfig = ScheduleConfigStorage.getTemplate(templateId)
      setConfig(templateConfig)
      setSaveMessage(`Template "${templateId}" loaded successfully!`)
      setTimeout(() => setSaveMessage(''), 3000)
    } catch {
      setSaveMessage('Failed to load template. Please try again.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const handleExport = () => {
    try {
      const exportData = ScheduleConfigStorage.exportConfiguration()
      const blob = new Blob([exportData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'schedule-config.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSaveMessage('Configuration exported successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch {
      setSaveMessage('Failed to export configuration.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = e => {
      try {
        const jsonString = e.target?.result as string
        const importedConfig =
          ScheduleConfigStorage.importConfiguration(jsonString)
        setConfig(importedConfig)
        setSaveMessage('Configuration imported successfully!')
        setTimeout(() => setSaveMessage(''), 3000)
      } catch {
        setSaveMessage(
          'Failed to import configuration. Please check the file format.'
        )
        setTimeout(() => setSaveMessage(''), 3000)
      }
    }
    reader.readAsText(file)
    // Reset the input
    event.target.value = ''
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Schedule Configuration
          </h1>
          <p className="text-gray-600">
            Configure shift schedules, requirements, and constraints for each
            day of the week
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'days', label: 'Daily Schedules' },
              { id: 'global', label: 'Global Constraints' },
              { id: 'weights', label: 'Preference Weights' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as 'days' | 'global' | 'weights')
                }
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Daily Schedules Tab */}
        {activeTab === 'days' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              {/* Day Selector */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Configure by Day
                </h3>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${
                        selectedDay === day
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day Configuration */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3 capitalize">
                    {selectedDay} Configuration
                  </h4>

                  {/* Enabled Shift Types */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Available Shift Types
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {SHIFT_TYPES.map(shiftType => (
                        <label key={shiftType} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={currentDayConfig.enabledShiftTypes.includes(
                              shiftType
                            )}
                            onChange={e => {
                              const newEnabledTypes = e.target.checked
                                ? [
                                    ...currentDayConfig.enabledShiftTypes,
                                    shiftType,
                                  ]
                                : currentDayConfig.enabledShiftTypes.filter(
                                    t => t !== shiftType
                                  )
                              updateDayConfig(selectedDay, {
                                enabledShiftTypes: newEnabledTypes,
                              })
                            }}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">
                            {shiftType === 'fullday' ? 'Full Day' : shiftType} (
                            {getShiftDuration(shiftType)})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Shift Requirements */}
                  <div className="space-y-4">
                    <h5 className="text-sm font-medium text-gray-700">
                      Shift Requirements
                    </h5>
                    {currentDayConfig.enabledShiftTypes.map(shiftType => (
                      <div
                        key={shiftType}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <h6 className="text-sm font-medium text-gray-900 mb-3 capitalize">
                          {shiftType === 'fullday' ? 'Full Day' : shiftType}{' '}
                          Shift ({getShiftDuration(shiftType)})
                        </h6>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Skills */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Required Skills
                            </label>
                            <input
                              type="text"
                              value={
                                currentDayConfig.shiftSkillRequirements[
                                  shiftType
                                ]?.join(', ') || ''
                              }
                              onChange={e => {
                                const skills = e.target.value
                                  .split(',')
                                  .map(s => s.trim())
                                  .filter(s => s.length > 0)
                                updateDayConfig(selectedDay, {
                                  shiftSkillRequirements: {
                                    ...currentDayConfig.shiftSkillRequirements,
                                    [shiftType]: skills,
                                  },
                                })
                              }}
                              placeholder="Enter skills separated by commas"
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                          </div>

                          {/* Min Staff */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Minimum Staff
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={
                                currentDayConfig.shiftStaffRequirements[
                                  shiftType
                                ]?.minimum || 1
                              }
                              onChange={e => {
                                const minimum = parseInt(e.target.value) || 1
                                updateDayConfig(selectedDay, {
                                  shiftStaffRequirements: {
                                    ...currentDayConfig.shiftStaffRequirements,
                                    [shiftType]: {
                                      ...currentDayConfig
                                        .shiftStaffRequirements[shiftType],
                                      minimum,
                                    },
                                  },
                                })
                              }}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                          </div>

                          {/* Max Staff */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Maximum Staff
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={
                                currentDayConfig.shiftStaffRequirements[
                                  shiftType
                                ]?.maximum || 1
                              }
                              onChange={e => {
                                const maximum = parseInt(e.target.value) || 1
                                updateDayConfig(selectedDay, {
                                  shiftStaffRequirements: {
                                    ...currentDayConfig.shiftStaffRequirements,
                                    [shiftType]: {
                                      ...currentDayConfig
                                        .shiftStaffRequirements[shiftType],
                                      maximum,
                                    },
                                  },
                                })
                              }}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Constraints Tab */}
        {activeTab === 'global' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">
              Global Constraints
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Consecutive Shifts
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.maxConsecutiveShifts}
                  onChange={e =>
                    setConfig({
                      ...config,
                      maxConsecutiveShifts: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Rest Hours Between Shifts
                </label>
                <input
                  type="number"
                  min="0"
                  value={config.minRestHoursBetweenShifts}
                  onChange={e =>
                    setConfig({
                      ...config,
                      minRestHoursBetweenShifts: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Hours Per Week
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.maxHoursPerWeek}
                  onChange={e =>
                    setConfig({
                      ...config,
                      maxHoursPerWeek: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Hours Per Week
                </label>
                <input
                  type="number"
                  min="0"
                  value={config.minHoursPerWeek}
                  onChange={e =>
                    setConfig({
                      ...config,
                      minHoursPerWeek: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.requireSkillMatch}
                  onChange={e =>
                    setConfig({
                      ...config,
                      requireSkillMatch: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Require skill match for shift assignments
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.minimumSkillsRequired}
                  onChange={e =>
                    setConfig({
                      ...config,
                      minimumSkillsRequired: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Staff without required skills cannot be assigned
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Weights Tab */}
        {activeTab === 'weights' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">
              Preference Weights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Shift Bonus
                </label>
                <input
                  type="number"
                  value={config.weights.preferredShift}
                  onChange={e =>
                    setConfig({
                      ...config,
                      weights: {
                        ...config.weights,
                        preferredShift: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Non-Preferred Shift Penalty
                </label>
                <input
                  type="number"
                  value={config.weights.nonPreferredShift}
                  onChange={e =>
                    setConfig({
                      ...config,
                      weights: {
                        ...config.weights,
                        nonPreferredShift: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Day Off Penalty
                </label>
                <input
                  type="number"
                  value={config.weights.preferredDayOff}
                  onChange={e =>
                    setConfig({
                      ...config,
                      weights: {
                        ...config.weights,
                        preferredDayOff: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matching Skill Bonus
                </label>
                <input
                  type="number"
                  value={config.weights.matchingSkill}
                  onChange={e =>
                    setConfig({
                      ...config,
                      weights: {
                        ...config.weights,
                        matchingSkill: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Needs More Hours Bonus
                </label>
                <input
                  type="number"
                  value={config.weights.needsMoreHours}
                  onChange={e =>
                    setConfig({
                      ...config,
                      weights: {
                        ...config.weights,
                        needsMoreHours: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Save Message */}
        {saveMessage && (
          <div
            className={`mt-6 p-4 rounded-md ${
              saveMessage.includes('Failed')
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            {saveMessage}
          </div>
        )}

        {/* Template Selector */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-md font-medium text-gray-900 mb-3">
            Quick Templates
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ScheduleConfigStorage.getAvailableTemplates().map(template => (
              <button
                key={template.id}
                onClick={() => handleLoadTemplate(template.id)}
                className="text-left p-3 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300"
              >
                <div className="font-medium text-sm text-gray-900">
                  {template.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
            >
              Export Config
            </button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200">
                Import Config
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleReset}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
            >
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded-md text-white ${
                isSaving
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
