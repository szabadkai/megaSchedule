import type { Staff, StaffPreferences, ShiftType, DayOfWeek } from '@/types'

export const SAMPLE_SKILLS = [
  'nursing',
  'administration',
  'emergency care',
  'patient care',
  'surgery',
  'pharmacy',
  'radiology',
  'laboratory',
  'physical therapy',
  'mental health',
  'pediatrics',
  'geriatrics',
]

export const generateMockStaff = (): Staff[] => {
  const staff: Staff[] = [
    {
      id: '1',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@hospital.com',
      skills: ['nursing', 'emergency care', 'patient care'],
      preferences: {
        desiredHoursPerWeek: 40,
        preferredShifts: ['morning', 'afternoon'],
        preferredDaysOff: ['saturday', 'sunday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '2',
      name: 'Michael Chen',
      email: 'michael.chen@hospital.com',
      skills: ['surgery', 'emergency care'],
      preferences: {
        desiredHoursPerWeek: 45,
        preferredShifts: ['morning'],
        preferredDaysOff: ['wednesday', 'sunday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '3',
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@hospital.com',
      skills: ['nursing', 'pediatrics', 'patient care'],
      preferences: {
        desiredHoursPerWeek: 36,
        preferredShifts: ['afternoon', 'night'],
        preferredDaysOff: ['monday', 'tuesday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '4',
      name: 'David Thompson',
      email: 'david.thompson@hospital.com',
      skills: ['administration', 'pharmacy'],
      preferences: {
        desiredHoursPerWeek: 40,
        preferredShifts: ['morning', 'afternoon'],
        preferredDaysOff: ['saturday', 'sunday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '5',
      name: 'Jessica Kim',
      email: 'jessica.kim@hospital.com',
      skills: ['nursing', 'mental health', 'patient care'],
      preferences: {
        desiredHoursPerWeek: 32,
        preferredShifts: ['morning'],
        preferredDaysOff: ['friday', 'saturday', 'sunday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '6',
      name: 'Robert Martinez',
      email: 'robert.martinez@hospital.com',
      skills: ['radiology', 'laboratory'],
      preferences: {
        desiredHoursPerWeek: 40,
        preferredShifts: ['afternoon', 'night'],
        preferredDaysOff: ['thursday', 'friday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '7',
      name: 'Lisa Anderson',
      email: 'lisa.anderson@hospital.com',
      skills: ['nursing', 'geriatrics', 'patient care'],
      preferences: {
        desiredHoursPerWeek: 48,
        preferredShifts: ['night'],
        preferredDaysOff: ['monday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '8',
      name: 'James Wilson',
      email: 'james.wilson@hospital.com',
      skills: ['physical therapy', 'patient care'],
      preferences: {
        desiredHoursPerWeek: 35,
        preferredShifts: ['morning', 'afternoon'],
        preferredDaysOff: ['saturday', 'sunday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '9',
      name: 'Amanda Foster',
      email: 'amanda.foster@hospital.com',
      skills: ['emergency care', 'surgery', 'patient care'],
      preferences: {
        desiredHoursPerWeek: 42,
        preferredShifts: ['afternoon', 'night'],
        preferredDaysOff: ['wednesday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '10',
      name: 'Christopher Lee',
      email: 'christopher.lee@hospital.com',
      skills: ['nursing', 'emergency care', 'mental health'],
      preferences: {
        desiredHoursPerWeek: 40,
        preferredShifts: ['night'],
        preferredDaysOff: ['tuesday', 'friday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '11',
      name: 'Rachel Green',
      email: 'rachel.green@hospital.com',
      skills: ['administration', 'patient care'],
      preferences: {
        desiredHoursPerWeek: 30,
        preferredShifts: ['morning'],
        preferredDaysOff: ['saturday', 'sunday', 'wednesday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
    {
      id: '12',
      name: 'Kevin Brown',
      email: 'kevin.brown@hospital.com',
      skills: ['laboratory', 'radiology', 'pharmacy'],
      preferences: {
        desiredHoursPerWeek: 38,
        preferredShifts: ['morning', 'afternoon'],
        preferredDaysOff: ['sunday', 'monday'],
        unavailableDates: [],
        holidays: [],
      },
      isActive: true,
    },
  ]

  return staff
}

// Helper function to get random subset of skills
export const getRandomSkills = (count: number = 2): string[] => {
  const shuffled = [...SAMPLE_SKILLS].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

// Helper function to get random shift preferences
export const getRandomShiftPreferences = (): ShiftType[] => {
  const shifts: ShiftType[] = ['morning', 'afternoon', 'night']
  const preferredCount = Math.floor(Math.random() * 2) + 1 // 1-2 preferred shifts
  const shuffled = [...shifts].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, preferredCount)
}

// Helper function to get random days off
export const getRandomDaysOff = (): DayOfWeek[] => {
  const days: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]
  const daysOffCount = Math.floor(Math.random() * 3) + 1 // 1-3 days off
  const shuffled = [...days].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, daysOffCount)
}

// Helper function to generate a random staff member
export const generateRandomStaff = (
  id: string,
  name: string,
  email: string
): Staff => {
  return {
    id,
    name,
    email,
    skills: getRandomSkills(Math.floor(Math.random() * 3) + 1), // 1-3 skills
    preferences: {
      desiredHoursPerWeek: Math.floor(Math.random() * 20) + 30, // 30-50 hours
      preferredShifts: getRandomShiftPreferences(),
      preferredDaysOff: getRandomDaysOff(),
      unavailableDates: [],
      holidays: [],
    },
    isActive: true,
  }
}
