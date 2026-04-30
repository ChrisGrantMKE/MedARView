/** Icons: only `src/assets/SVGS`. Drill views: selected row + page from `src/assets/NEW_UI_SVG`. */
import iconPatient from '../assets/SVGS/Patient.svg'
import iconTests from '../assets/SVGS/Test Results.svg'
import iconAllergies from '../assets/SVGS/Allergies.svg'
import iconHeart from '../assets/SVGS/Heart Rate.svg'
import iconBlood from '../assets/SVGS/Blood Pressure.svg'

import drillPatientBtn from '../assets/NEW_UI_SVG/Patient Data Button Selected.svg'
import drillPatientPage from '../assets/NEW_UI_SVG/Patient Data.svg'
import drillTestsBtn from '../assets/NEW_UI_SVG/Test results Button selected.svg'
import drillTestsPage from '../assets/NEW_UI_SVG/Test results.svg'
import drillAllergiesBtn from '../assets/NEW_UI_SVG/Allergies Button selected.svg'
import drillAllergiesPage from '../assets/NEW_UI_SVG/Allergies.svg'
import drillHeartBtn from '../assets/NEW_UI_SVG/Heart Rate Button selected.svg'
import drillHeartPage from '../assets/NEW_UI_SVG/Heart Rate.svg'
import drillBloodBtn from '../assets/NEW_UI_SVG/Blood Pressure Button selected.svg'
import drillBloodPage from '../assets/NEW_UI_SVG/Blood Pressure.svg'

const W = 530

export const HUD_MENU_ITEMS = [
  {
    id: 'patient',
    label: 'Patient data',
    subtitle: 'Last updated 02/14/26',
    iconSrc: iconPatient,
    drillSelectedSrc: drillPatientBtn,
    drillPageSrc: drillPatientPage,
    drillHeaderH: 111,
    drillPageH: 613,
  },
  {
    id: 'tests',
    label: 'Test results',
    subtitle: '3 of 5 in range • 24 Apr',
    status: { text: '2 flagged', color: '#ec928e' },
    iconSrc: iconTests,
    drillSelectedSrc: drillTestsBtn,
    drillPageSrc: drillTestsPage,
    drillHeaderH: 107,
    drillPageH: 256,
  },
  {
    id: 'allergies',
    label: 'Allergies',
    subtitle: '3 documented',
    status: { text: 'Review', color: '#ffffff' },
    iconSrc: iconAllergies,
    drillSelectedSrc: drillAllergiesBtn,
    drillPageSrc: drillAllergiesPage,
    drillHeaderH: 107,
    drillPageH: 526,
  },
  {
    id: 'heart',
    label: 'Heart rate',
    subtitle: '94 bpm • live',
    status: { text: 'Elevated', color: '#ec928e' },
    iconSrc: iconHeart,
    drillSelectedSrc: drillHeartBtn,
    drillPageSrc: drillHeartPage,
    drillHeaderH: 111,
    drillPageH: 380,
  },
  {
    id: 'blood',
    label: 'Blood pressure',
    subtitle: '118 / 76 mmHg • 2h ago',
    status: { text: 'Normal', color: '#4ce995' },
    iconSrc: iconBlood,
    drillSelectedSrc: drillBloodBtn,
    drillPageSrc: drillBloodPage,
    drillHeaderH: 107,
    drillPageH: 397,
  },
]

export const DRILL_HEADER_W = W
