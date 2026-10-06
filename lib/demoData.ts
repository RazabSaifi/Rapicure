import { DemoCase } from "./types";

export const DEMO_CASES: DemoCase[] = [
  {
    id: "dengue_demo",
    name: "⚡ Dengue Warning Signs (Emergency Triage)",
    description: "4-day high grade fever, retro-orbital pain, severe abdominal ache, petechial rash on forearm. Critical thrombocytopenia.",
    patientInfo: {
      name: "Ramesh Kumar Sharma",
      age: "28",
      gender: "Male",
      uhid: "AIIMS-JDH-2026-89412",
      tokenNo: "OPD-042",
    },
    vitals: {
      bpSystolic: "96",
      bpDiastolic: "64",
      pulse: "118",
      temp: "103.2",
      spo2: "97",
    },
    language: "hi-IN",
    narrative:
      "डॉक्टर साहब, 4 दिन से बहुत तेज बुखार और ठंड लग रही है। आँखों के पीछे बहुत दर्द है और कमर टूट रही है। कल रात से पेट में तेज दर्द और उल्टी जैसा लग रहा है। हाथों पर लाल-लाल चकत्ते (dhaabe) निकल आए हैं और बहुत कमजोरी महसूस हो रही है, चक्कर आ रहे हैं।",
    simulatedResponse: {
      priority: "HIGH",
      priority_reason:
        "Tachycardia (118 bpm), borderline hypotension (96/64), persistent high fever (103.2°F), petechial rash with severe abdominal pain indicating Probable Dengue with Critical Warning Signs / Impending Dengue Shock Syndrome.",
      subjective:
        "28-year-old male presents with 4-day history of acute high-grade fever associated with chills, classic retro-orbital pain, and severe myalgia ('breakbone' pattern). Developed acute severe abdominal pain, persistent nausea, postural dizziness, and spontaneous cutaneous petechial eruptions within the last 18 hours.",
      objective:
        "Vitals: Febrile (103.2°F), Tachycardic (Pulse 118 bpm, regular), Borderline Hypotensive (BP 96/64 mmHg), SpO2 97% on room air. Extracted Lab/Clinical: Severe Thrombocytopenia flagged; capillary fragility indicated by petechial lesions.",
      red_flags:
        "🚨 CRITICAL WARNING SIGNS: Postural dizziness & tachycardia with narrowing pulse pressure (32 mmHg). High risk of Dengue Shock Syndrome and spontaneous plasma leakage. Immediate IV access and fluid resuscitation required.",
      doctor_audio_brief:
        "Priority High. 28-year-old male with 4-day fever, retro-orbital pain, severe abdominal pain, and petechial rash. Pulse 118, BP 96 over 64. Suspected Dengue with warning signs. Recommend immediate IV crystalloids and urgent STAT hematocrit.",
      plan: [
        "Immediate IV crystalloid infusion (Normal Saline 10-20 mL/kg over 1 hour) with continuous BP monitoring.",
        "STAT complete hemogram (CBC) for Hematocrit (HCT) and Platelet count baseline.",
        "Dengue Serology (NS1 Antigen & IgM/IgG rapid test) + Serum Electrolytes & LFT.",
        "Strictly avoid NSAIDs (Ibuprofen/Diclofenac/Aspirin). Administer IV/Oral Paracetamol 650mg for antipyresis.",
        "Urgent Bedside Ultrasound Abdomen to evaluate for ascites, gallbladder wall edema, or pleural effusion.",
        "Admit to High Dependency Unit (HDU) / Dengue Triage Ward for 2-hourly vitals charting.",
      ],
    },
  },
  {
    id: "copd_demo",
    name: "🫁 Acute Respiratory Distress (COPD)",
    description: "62-year-old chronic smoker with severe dyspnea, wheezing, and hypoxemia (SpO2 88%).",
    patientInfo: {
      name: "Mohan Lal Gurjar",
      age: "62",
      gender: "Male",
      uhid: "AIIMS-JDH-2026-67310",
      tokenNo: "OPD-019",
    },
    vitals: {
      bpSystolic: "158",
      bpDiastolic: "94",
      pulse: "106",
      temp: "99.1",
      spo2: "88",
    },
    language: "hi-IN",
    narrative:
      "सांस बहुत ज्यादा फूल रही है, बैठा भी नहीं जा रहा। पिछले 3 दिन से पीला बलगम आ रहा है और छाती में बहुत ज्यादा सीटी जैसी आवाज आ रही है। इनहेलर लेने के बाद भी आराम नहीं मिल रहा।",
    simulatedResponse: {
      priority: "HIGH",
      priority_reason:
        "Severe Hypoxemia (SpO2 88%), Tachypnea with audible wheeze and purulent sputum in a known COPD patient. High risk of hypercapnic respiratory failure.",
      subjective:
        "62-year-old male presents with acute exacerbation of breathlessness (NYHA Class IV), productive cough with purulent yellow sputum for 3 days, and refractory response to standard bronchodilator inhalers.",
      objective:
        "SpO2 88% on room air, Tachypnea, Pulse 106 bpm, BP 158/94 mmHg. Bilateral polyphonic wheezing on respiratory auscultation.",
      red_flags:
        "🚨 RESPIRATORY COMPROMISE: Hypoxemia (SpO2 88%) with accessory muscle usage. Risk of acute respiratory acidosis and CO2 retention.",
      doctor_audio_brief:
        "Priority High. 62-year-old male with severe COPD exacerbation. SpO2 88 percent on room air, pulse 106. Needs controlled oxygen therapy and nebulization immediately.",
      plan: [
        "Initiate controlled Oxygen therapy via Venturi mask (target SpO2 88-92% to prevent hypercapnia).",
        "Nebulization with Duolin (Levosalbutamol + Ipratropium) and Budecort STAT.",
        "IV Hydrocortisone 100mg or Oral Prednisolone 40mg.",
        "STAT Arterial Blood Gas (ABG) analysis and Chest X-ray PA view.",
      ],
    },
  },
];
