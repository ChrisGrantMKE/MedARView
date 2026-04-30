export const HUD_MENU_ITEMS = [
  {
    id: 'patient',
    label: 'Patient data',
    subtitle: 'Last updated 02/14/26',
    detail: 'patient',
  },
  {
    id: 'tests',
    label: 'Test results',
    subtitle: '3 of 5 in range • 24 Apr',
    status: { text: '2 flagged', color: '#ec928e' },
    detail: 'tests',
  },
  {
    id: 'allergies',
    label: 'Allergies',
    subtitle: '3 documented',
    status: { text: 'Review', color: '#ffffff' },
    detail: 'allergies',
  },
  {
    id: 'heart',
    label: 'Heart rate',
    subtitle: '94 bpm • live',
    status: { text: 'Elevated', color: '#ec928e' },
    detail: 'heart',
  },
  {
    id: 'blood',
    label: 'Blood pressure',
    subtitle: '118 / 76 mmHg • 2h ago',
    status: { text: 'Normal', color: '#4ce995' },
    detail: 'blood',
  },
]
