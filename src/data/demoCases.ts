import { DemoCase } from '../types/triage';

export const DENGUE_DEMO_CASE: DemoCase = {
  id: 'dengue-warning-signs',
  title: 'Dengue with Warning Signs (AIIMS OPD)',
  subtitle: '3-day pyrexia, retro-orbital pain, petechiae, tachycardia',
  badge: '🔴 Critical High Triage',
  language: 'hi-IN',
  patientInfo: {
    token: 'A-104',
    name: 'Ramesh Sharma',
    age: '34',
    gender: 'Male',
    queueTime: '10:14 AM'
  },
  vitals: {
    bp: '105/72',
    pulse: '108',
    temp: '102.4',
    spo2: '96'
  },
  symptoms: 'पिछले 3 दिनों से लगातार 102° बुखार है, आंखों के पीछे बहुत तेज़ दर्द हो रहा है, उल्टी जैसा मन है और हाथ-पैरों में चकत्ते (petechiae) दिख रहे हैं।',
  hasSampleReport: true,
  sampleReportName: 'AIIMS_OPD_CBC_Report_A104.png',
  sampleReportSummary: 'Platelet: 38,000 /µL (Severe Thrombocytopenia) | HCT: 48.2% (Hemoconcentration) | Dengue NS1: POSITIVE'
};

export const CHEST_PAIN_DEMO_CASE: DemoCase = {
  id: 'cardiac-chest-pain',
  title: 'Acute Anginal Chest Pain / ACS',
  subtitle: 'Substernal pressure radiating to left arm, diaphoresis',
  badge: '🔴 Fast-Track Resuscitation',
  language: 'en-IN',
  patientInfo: {
    token: 'A-105',
    name: 'Surendra Verma',
    age: '58',
    gender: 'Male',
    queueTime: '10:22 AM'
  },
  vitals: {
    bp: '92/64',
    pulse: '112',
    temp: '98.4',
    spo2: '94'
  },
  symptoms: 'Severe squeezing central chest heaviness for 45 minutes radiating to left shoulder and jaw, associated with profuse cold diaphoresis and mild nausea.',
  hasSampleReport: false
};

export const ROUTINE_OPD_DEMO_CASE: DemoCase = {
  id: 'routine-dyspepsia',
  title: 'Chronic Gastric Dyspepsia & Fatigue',
  subtitle: 'Epigastric discomfort, stable hemodynamics',
  badge: '🟢 Routine OPD Consult',
  language: 'hi-IN',
  patientInfo: {
    token: 'A-108',
    name: 'Meena Devi',
    age: '42',
    gender: 'Female',
    queueTime: '10:35 AM'
  },
  vitals: {
    bp: '118/78',
    pulse: '74',
    temp: '98.6',
    spo2: '99'
  },
  symptoms: 'पिछले 2 हफ्तों से खाना खाने के बाद पेट के ऊपरी हिस्से में जलन और खट्टी डकारें आ रही हैं, कोई उल्टी या बुखार नहीं है।',
  hasSampleReport: false
};

// Generates an SVG data URL mimicking a real Indian hospital CBC diagnostic report
export function generateSampleCBCReportDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420" style="background:#ffffff;font-family:'Courier New', monospace, sans-serif;">
    <rect width="600" height="420" fill="#ffffff" />
    <rect x="12" y="12" width="576" height="396" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4"/>
    
    <!-- Hospital Header -->
    <rect x="20" y="20" width="560" height="60" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="35" y="44" font-size="14" font-weight="bold" fill="#0f172a">DEPARTMENT OF PATHOLOGY &amp; LABORATORY MEDICINE</text>
    <text x="35" y="62" font-size="11" fill="#475569">DR. S.N. MEDICAL COLLEGE &amp; HOSPITAL / AIIMS EMERGENCY TRIAGE</text>
    <text x="460" y="44" font-size="11" font-weight="bold" fill="#0284c7">TOKEN: #A-104</text>
    <text x="460" y="62" font-size="10" fill="#64748b">DATE: 06-OCT-2026</text>

    <!-- Patient Bar -->
    <line x1="20" y1="90" x2="580" y2="90" stroke="#0284c7" stroke-width="2"/>
    <text x="25" y="110" font-size="11" fill="#1e293b"><tspan font-weight="bold">PATIENT:</tspan> Ramesh Sharma (34 Y / M)</text>
    <text x="260" y="110" font-size="11" fill="#1e293b"><tspan font-weight="bold">REF BY:</tspan> Pre-OPD Triage</text>
    <text x="440" y="110" font-size="11" fill="#1e293b"><tspan font-weight="bold">SAMPLE:</tspan> EDTA Whole Blood</text>
    
    <!-- Table Headers -->
    <rect x="20" y="125" width="560" height="24" fill="#e2e8f0"/>
    <text x="30" y="141" font-size="11" font-weight="bold" fill="#0f172a">TEST DESCRIPTION</text>
    <text x="230" y="141" font-size="11" font-weight="bold" fill="#0f172a">OBSERVED VALUE</text>
    <text x="360" y="141" font-size="11" font-weight="bold" fill="#0f172a">REFERENCE RANGE</text>
    <text x="490" y="141" font-size="11" font-weight="bold" fill="#0f172a">STATUS</text>

    <!-- Test Row 1: Platelets -->
    <rect x="20" y="152" width="560" height="28" fill="#fee2e2" stroke="#fca5a5" stroke-width="0.8"/>
    <text x="30" y="171" font-size="11" font-weight="bold" fill="#991b1b">PLATELET COUNT (Stat)</text>
    <text x="230" y="171" font-size="12" font-weight="bold" fill="#b91c1c">38,000 /µL</text>
    <text x="360" y="171" font-size="11" fill="#334155">150,000 - 450,000</text>
    <text x="490" y="171" font-size="11" font-weight="bold" fill="#dc2626">CRITICAL LOW</text>

    <!-- Test Row 2: Hematocrit -->
    <rect x="20" y="182" width="560" height="26" fill="#fef2f2"/>
    <text x="30" y="200" font-size="11" font-weight="bold" fill="#991b1b">HEMATOCRIT (PCV)</text>
    <text x="230" y="200" font-size="11" font-weight="bold" fill="#b91c1c">48.2 %</text>
    <text x="360" y="200" font-size="11" fill="#334155">38.0 - 46.0 %</text>
    <text x="490" y="200" font-size="11" font-weight="bold" fill="#dc2626">ELEVATED (Hemoconc.)</text>

    <!-- Test Row 3: Total WBC -->
    <rect x="20" y="210" width="560" height="26" fill="#f8fafc"/>
    <text x="30" y="228" font-size="11" fill="#0f172a">Total Leukocyte Count (TLC)</text>
    <text x="230" y="228" font-size="11" font-weight="bold" fill="#475569">2,400 /µL</text>
    <text x="360" y="228" font-size="11" fill="#334155">4,000 - 11,000</text>
    <text x="490" y="228" font-size="11" fill="#d97706">LEUKOPENIA</text>

    <!-- Test Row 4: Hemoglobin -->
    <rect x="20" y="238" width="560" height="26" fill="#ffffff"/>
    <text x="30" y="256" font-size="11" fill="#0f172a">Hemoglobin (Hb)</text>
    <text x="230" y="256" font-size="11" fill="#0f172a">15.8 g/dL</text>
    <text x="360" y="256" font-size="11" fill="#334155">13.0 - 17.0 g/dL</text>
    <text x="490" y="256" font-size="11" fill="#16a34a">NORMAL</text>

    <!-- Test Row 5: Dengue Serology -->
    <rect x="20" y="266" width="560" height="28" fill="#fef3c7" stroke="#fcd34d" stroke-width="0.8"/>
    <text x="30" y="285" font-size="11" font-weight="bold" fill="#92400e">Dengue NS1 Antigen (Rapid)</text>
    <text x="230" y="285" font-size="12" font-weight="bold" fill="#b45309">REACTIVE (POSITIVE)</text>
    <text x="360" y="285" font-size="11" fill="#334155">Non-Reactive</text>
    <text x="490" y="285" font-size="11" font-weight="bold" fill="#b45309">REACTIVE</text>

    <!-- Footer Note -->
    <rect x="20" y="306" width="560" height="85" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="30" y="326" font-size="10" font-weight="bold" fill="#dc2626">PATHOLOGIST CLINICAL CORRELATION NOTE:</text>
    <text x="30" y="342" font-size="10" fill="#334155">Severe thrombocytopenia (&lt;50k) with hemoconcentration (HCT &gt;48%) in a pyrexial patient.</text>
    <text x="30" y="358" font-size="10" fill="#334155">High suspicion of Dengue Hemorrhagic Phase. Advise immediate clinical triage &amp; IV fluids.</text>
    <text x="440" y="380" font-size="9" fill="#64748b">Verified by Dr. A. Gupta (MD Path)</text>
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
