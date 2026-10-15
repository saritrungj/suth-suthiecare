// เก็บข้อมูลและฟังก์ชันสำหรับสร้าง Template อัตโนมัติ

export const getTemplate9Q = () => {
  const timestamp = Date.now();
  const q9_titles = [
    "1. เบื่อ ไม่สนใจอยากทำอะไร",
    "2. ไม่สบายใจ ซึมเศร้า ท้อแท้",
    "3. หลับยาก หรือหลับๆ ตื่นๆ หรือหลับมากไป",
    "4. เหนื่อยง่าย หรือ ไม่ค่อยมีแรง",
    "5. เบื่ออาหาร หรือ กินมากเกินไป",
    "6. รู้สึกไม่ดีกับตัวเอง คิดว่าตัวเองล้มเหลว หรือทำให้ตนเองหรือครอบครัวผิดหวัง",
    "7. สมาธิไม่ดีเวลาทำอะไร เช่น ดูโทรทัศน์ ฟังวิทยุ หรือทำงานที่ต้องใช้ความตั้งใจ",
    "8. พูดช้า ทำอะไรช้าลง จนคนอื่นสังเกตเห็นได้ หรือกระสับกระส่ายไม่สามารถอยู่นิ่งได้เหมือนที่เคยเป็น",
    "9. คิดทำร้ายตนเอง หรือคิดว่าถ้าตายไปคงจะดี",
  ];
  const q9_cols = [
    "ไม่มีเลย",
    "เป็นบางวัน (1-7 วัน)",
    "เป็นบ่อย (>7 วัน)",
    "เป็นทุกวัน",
  ];
  const q9_scores = [0, 1, 2, 3];
  const q9_rules = [
    {
      min: 0,
      max: 6,
      label: "ปกติ / ไม่มีอาการซึมเศร้า",
      color: "#4caf50",
      advice: "รักษาสุขภาพจิตให้แจ่มใสต่อไป",
    },
    {
      min: 7,
      max: 12,
      label: "มีอาการซึมเศร้าระดับน้อย",
      color: "#fbbc04",
      advice: "ควรพักผ่อนให้เพียงพอและปรึกษาคนใกล้ชิด",
    },
    {
      min: 13,
      max: 18,
      label: "มีอาการซึมเศร้าระดับปานกลาง",
      color: "#ff9800",
      advice: "แนะนำให้พบเจ้าหน้าที่เพื่อรับคำปรึกษาเพิ่มเติม",
    },
    {
      min: 19,
      max: 27,
      label: "มีอาการซึมเศร้าระดับรุนแรง",
      color: "#d93025",
      advice: "ควรพบจิตแพทย์โดยด่วนเพื่อรับการประเมินและการรักษา",
    },
  ];
  return [
    {
      id: `q${timestamp}`,
      type: "grid_multiple",
      title: "แบบประเมินโรคซึมเศร้า (9Q)",
      text: "ในช่วง 2 สัปดาห์ที่ผ่านมา รวมทั้งวันนี้ ท่านมีอาการเหล่านี้บ่อยแค่ไหน",
      options: [],
      optionScores: [],
      optionImages: [],
      optionHasInput: [],
      rows: [...q9_titles],
      cols: [...q9_cols],
      colScores: [...q9_scores],
      rowScores: Array(q9_titles.length).fill(1),
      cellScores: Array(q9_titles.length)
        .fill(null)
        .map(() => Array(q9_cols.length).fill(0)),
      scoreMode: "column",
      required: true,
      hasDescription: true,
      image: null,
      isScored: true,
      scoringRules: q9_rules,
    },
  ];
};

export const getTemplateBMI = () => {
  const timestamp = Date.now();
  const bmi_rules = [
    {
      min: 0,
      max: 18.49,
      label: "น้ำหนักน้อย / ผอม",
      color: "#03a9f4",
      advice:
        "ควรรับประทานอาหารที่มีประโยชน์ให้เพียงพอและออกกำลังกายเพื่อสร้างกล้ามเนื้อ",
    },
    {
      min: 18.5,
      max: 22.99,
      label: "ปกติ (สุขภาพดี)",
      color: "#4caf50",
      advice: "รักษาสุขภาพและน้ำหนักให้อยู่ในเกณฑ์นี้ต่อไป",
    },
    {
      min: 23,
      max: 24.99,
      label: "ท้วม / โรคอ้วนระดับ 1",
      color: "#ff9800",
      advice: "ควรควบคุมอาหารและออกกำลังกายอย่างสม่ำเสมอ",
    },
    {
      min: 25,
      max: 29.99,
      label: "อ้วน / โรคอ้วนระดับ 2",
      color: "#ff5722",
      advice: "ควรปรับเปลี่ยนพฤติกรรมการกินและลดน้ำหนักเพื่อสุขภาพ",
    },
    {
      min: 30,
      max: 100,
      label: "อ้วนมาก / โรคอ้วนระดับ 3",
      color: "#d93025",
      advice: "ควรปรึกษาแพทย์หรือนักโภชนาการเพื่อลดน้ำหนักอย่างถูกวิธี",
    },
  ];
  return [
    {
      id: `q${timestamp}`,
      type: "bmi",
      title: "การประเมินดัชนีมวลกาย (BMI)",
      text: "กรุณากรอกน้ำหนักและส่วนสูงของท่าน เพื่อให้ระบบคำนวณค่า BMI อัตโนมัติ",
      options: [],
      optionScores: [],
      optionImages: [],
      optionHasInput: [],
      rows: [],
      cols: [],
      colScores: [],
      required: true,
      hasDescription: true,
      image: null,
      isScored: true,
      scoringRules: bmi_rules,
    },
  ];
};

export const getTemplateLSM = () => {
  const timestamp = Date.now();
  const colsLikert = ["7 วัน", "5-6 วัน", "3-4 วัน", "1-2 วัน", "ไม่ปฏิบัติ"];
  const colScores = [5, 4, 3, 2, 1];

  const foodRowScores = [
    [5, 4, 3, 2, 1],
    [5, 4, 3, 2, 1],
    [5, 4, 3, 2, 1],
    [1, 2, 3, 4, 5],
    [1, 2, 3, 4, 5],
    [1, 2, 3, 4, 5],
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1],
  ];
  const exerciseRowScores = [
    [5, 4, 3, 2, 1],
    [4, 4, 3, 2, 1],
    [2, 2, 2, 2, 1],
  ];

  const createGrid = (
    id,
    title,
    text,
    rows,
    rules,
    scoreMode = "column",
    rowScores,
  ) => ({
    id: `${id}_${timestamp}`,
    type: "grid_multiple",
    title,
    text,
    rows,
    cols: colsLikert,
    colScores,
    scoreMode,
    cellScores: scoreMode === "cell" ? rowScores : null,
    isScored: true,
    scoringRules: rules,
    rowScores: scoreMode === "column" ? rowScores : null,
  });

  return [
    // ===============================================
    // ตอนที่ 1: ข้อมูลทั่วไป
    // ===============================================
    {
      id: `sec_info_${timestamp}`,
      type: "section",
      title: "ตอนที่ 1 ข้อมูลทั่วไปของผู้ตอบแบบประเมิน",
      text: "โปรดระบุข้อมูลของท่านตามความเป็นจริง",
      stepName: "ตอนที่ 1",
      hasDescription: false,
    },
    {
      id: `q1_${timestamp}`,
      type: "full_name",
      title: "1. ชื่อ-นามสกุล",
      options: [],
      optionHasInput: [],
      required: true,
      isScored: false,
    },
    {
      id: `q2_${timestamp}`,
      type: "short_text",
      title: "2. ชื่อเล่น",
      options: [],
      optionHasInput: [],
      required: false,
      isScored: false,
    },
    {
      id: `q3_${timestamp}`,
      type: "short_text",
      title: "3. อายุ (ปี)",
      options: [],
      optionHasInput: [],
      required: true,
      isScored: false,
    },
    {
      id: `q4_${timestamp}`,
      type: "multiple_choice",
      title: "4. เพศ",
      options: ["1. หญิง", "2. ชาย", "3. เพศทางเลือก (LGBTQ+)"],
      optionScores: [0, 0, 0],
      optionHasInput: [false, false, false],
      required: true,
      isScored: false,
    },
    {
      id: `q5_${timestamp}`,
      type: "bmi",
      title: "5. น้ำหนัก ส่วนสูง ดัชนีมวลกาย",
      options: [],
      optionHasInput: [],
      required: true,
      isScored: true,
      scoringRules: [
        {
          min: 0,
          max: 18.49,
          label: "น้ำหนักน้อย / ผอม",
          color: "#03a9f4",
          advice: "",
        },
        {
          min: 18.5,
          max: 22.99,
          label: "ปกติ (สุขภาพดี)",
          color: "#4caf50",
          advice: "",
        },
        {
          min: 23,
          max: 24.99,
          label: "ท้วม / โรคอ้วนระดับ 1",
          color: "#ff9800",
          advice: "",
        },
        {
          min: 25,
          max: 29.99,
          label: "อ้วน / โรคอ้วนระดับ 2",
          color: "#ff5722",
          advice: "",
        },
        {
          min: 30,
          max: 100,
          label: "อ้วนมาก / โรคอ้วนระดับ 3",
          color: "#d93025",
          advice: "",
        },
      ],
    },
    {
      id: `q6_${timestamp}`,
      type: "multiple_choice",
      title: "6. สถานะ",
      options: ["1. นักศึกษา", "2. บุคลากร", "3. บุคคลทั่วไป"],
      optionScores: [0, 0, 0],
      optionHasInput: [false, false, false],
      required: true,
      isScored: false,
    },

    // 🟢 ข้อ 7, 8, 9 เพิ่ม optionHasInput: true ในตัวเลือกที่ให้กรอกได้
    {
      id: `q7_${timestamp}`,
      type: "multiple_choice",
      title: "7. อาชีพ",
      options: [
        "1. นักศึกษา",
        "2. รับจ้างทั่วไป",
        "3. รับราชการ/รัฐวิสาหกิจ",
        "4. เกษตร",
        "5. ค้าขาย",
        "6. อื่นๆ",
      ],
      optionScores: [0, 0, 0, 0, 0, 0],
      optionHasInput: [false, false, false, false, false, true],
      required: true,
      isScored: false,
    },
    {
      id: `q8_${timestamp}`,
      type: "multiple_choice",
      title: "8. โรคประจำตัว",
      options: ["ไม่มี", "มี"],
      optionScores: [0, 0],
      optionHasInput: [false, true],
      required: true,
      isScored: false,
    },
    {
      id: `q9_${timestamp}`,
      type: "multiple_choice",
      title: "9. ครอบครัว",
      options: ["ไม่มีโรคประจำตัว", "มีโรคประจำตัว"],
      optionScores: [0, 0],
      optionHasInput: [false, true],
      required: true,
      isScored: false,
    },

    {
      id: `q10_${timestamp}`,
      type: "multiple_choice",
      title: "10. สูบบุหรี่",
      options: ["ไม่เคยสูบเลย", "เคยสูบ/สูบ"],
      optionScores: [0, 0],
      optionHasInput: [false, true],
      required: true,
      isScored: false,
    },
    {
      id: `q11_${timestamp}`,
      type: "multiple_choice",
      title: "11. สุรา",
      options: ["ไม่เคยดื่ม", "เคยดื่ม/ดื่ม"],
      optionScores: [0, 0],
      optionHasInput: [false, true],
      required: true,
      isScored: false,
    },

    // ===============================================
    // ตอนที่ 2: พฤติกรรมสุขภาพ 3 อ.
    // ===============================================
    {
      id: `sec_3a_${timestamp}`,
      type: "section",
      title: "ตอนที่ 2 แบบประเมินพฤติกรรมสุขภาพ 3 อ.",
      text: "โปรดพิจารณาว่าในรอบสัปดาห์ที่ผ่านมา ท่านได้ปฏิบัติกิจกรรมต่อไปนี้บ่อยเพียงใด",
      stepName: "ตอนที่ 2",
      hasDescription: true,
    },
    createGrid(
      "food",
      "1. พฤติกรรมการบริโภคอาหาร",
      "ประเมินการกินอาหารของท่าน",
      [
        "ท่านกินอาหารปรุงสุกและสะอาด บ่อยเพียงใด",
        "ท่านกินอาหารครบ 5 หมู่ อย่างหลากหลาย ในสัดส่วนที่เหมาะสม...",
        "ท่านกินผักผลไม้ รวมกันอย่างน้อยวันละ 5 กำมือ บ่อยเพียงใด",
        "ท่านกินขนมหวาน... บ่อยเพียงใด",
        "ท่านกินอาหารมัน... บ่อยเพียงใด",
        "ท่านกินอาหารเค็ม... บ่อยเพียงใด",
        "ท่านกินอาหารแปรรูป... บ่อยเพียงใด",
        "ท่านดื่มน้ำสะอาด วันละ 6 - 8 แก้ว บ่อยเพียงใด",
      ],
      [
        {
          min: 8,
          max: 15,
          label: "บริโภคอาหารไม่ถูกต้อง",
          color: "#ff1a1a",
          advice: "ควรเริ่มเลือกกินอาหารที่มีประโยชน์และลดของหวาน มัน เค็ม",
        },
        {
          min: 16,
          max: 23,
          label: "บริโภคอาหารถูกต้องเป็นส่วนใหญ่ (ไม่สม่ำเสมอ)",
          color: "#ff9800",
          advice: "พยายามกินอาหารให้ครบ 5 หมู่ และทำให้สม่ำเสมอมากขึ้น",
        },
        {
          min: 24,
          max: 31,
          label: "บริโภคอาหารถูกต้องเป็นส่วนใหญ่ (สม่ำเสมอ)",
          color: "#f1ff2e",
          advice: "รักษาพฤติกรรมการกินที่ดีไว้ และเพิ่มความหลากหลายของอาหาร",
        },
        {
          min: 32,
          max: 40,
          label: "บริโภคอาหารถูกต้องและสม่ำเสมอ",
          color: "#36dd3c",
          advice: "คงพฤติกรรมนี้ต่อไป และสามารถเป็นแบบอย่างให้ผู้อื่นได้",
        },
      ],
      "cell",
      foodRowScores,
    ),

    createGrid(
      "exercise",
      "2. พฤติกรรมการออกกำลังกาย",
      "ประเมินกิจกรรมทางกาย",
      [
        "ท่านลุกขยับร่างกายทุก 2 ชั่วโมง ระหว่างทำงาน บ่อยเพียงใด",
        "ท่านออกกำลังกายจนรู้สึกหัวใจเต้นเร็วขึ้น สะสมวันละ 30 นาที บ่อยเพียงใด",
        "ท่านฝึกสร้างความเข็งแรงของกล้ามเนื้อ บ่อยเพียงใด",
      ],
      [
        {
          min: 3,
          max: 4,
          label: "ออกกำลังกายไม่ถูกต้อง",
          color: "#ff1a1a",
          advice: "ควรเริ่มออกกำลังกายอย่างน้อยสัปดาห์ละ 2–3 ครั้ง",
        },
        {
          min: 5,
          max: 6,
          label: "ออกกำลังกายถูกต้องเป็นส่วนใหญ่ (ไม่สม่ำเสมอ)",
          color: "#ff9800",
          advice: "เพิ่มความสม่ำเสมอในการออกกำลังกายให้มากขึ้น",
        },
        {
          min: 7,
          max: 8,
          label: "ออกกำลังกายถูกต้องเป็นส่วนใหญ่ (สม่ำเสมอ)",
          color: "#f1ff2e",
          advice: "รักษาระดับการออกกำลังกาย และเพิ่มความหลากหลายของกิจกรรม",
        },
        {
          min: 9,
          max: 13,
          label: "ออกกำลังกายถูกต้องและสม่ำเสมอ",
          color: "#36dd3c",
          advice: "คงพฤติกรรมนี้ต่อไปเพื่อสุขภาพที่แข็งแรง",
        },
      ],
      "cell",
      exerciseRowScores,
    ),

    createGrid(
      "emotion",
      "3. พฤติกรรมการจัดการอารมณ์",
      "ประเมินสุขภาพจิต",
      [
        "ท่านสังเกตอารมณ์ของตนเองในแต่ละวันบ่อยเพียงใด",
        "ท่านมีวิธีผ่อนคลายเมื่อรู้สึกเครียด บ่อยเพียงใด",
        "ท่านทำกิจกรรมที่ทำให้จิตใจร่าเริงอยู่เสมอ บ่อยเพียงใด",
        "ท่านสามารถจัดเวลาให้เพียงพอในเรื่องต่างๆ บ่อยเพียงใด",
        "ท่านนอนหลับ วันละ 7 - 8 ชั่วโมง บ่อยเพียงใด",
        "เมื่อเจอสถานการณ์ตึงเครียด ท่านหลีกเลี่ยงได้บ่อยเพียงใด",
      ],
      [
        {
          min: 6,
          max: 11,
          label: "จัดการอารมณ์ไม่ถูกต้อง",
          color: "#ff1a1a",
          advice: "ฝึกควบคุมอารมณ์ หรือพักผ่อนให้เพียงพอ",
        },
        {
          min: 12,
          max: 17,
          label: "จัดการอารมณ์ถูกต้องเป็นส่วนใหญ่ (ไม่สม่ำเสมอ)",
          color: "#ff9800",
          advice: "พยายามจัดการอารมณ์ให้ดีขึ้นอย่างสม่ำเสมอ",
        },
        {
          min: 18,
          max: 23,
          label: "จัดการอารมณ์ถูกต้องเป็นส่วนใหญ่ (สม่ำเสมอ)",
          color: "#f1ff2e",
          advice: "รักษาการควบคุมอารมณ์ และใช้วิธีผ่อนคลายเพิ่มเติม",
        },
        {
          min: 24,
          max: 30,
          label: "จัดการอารมณ์ถูกต้องและสม่ำเสมอ",
          color: "#36dd3c",
          advice: "คงพฤติกรรมนี้ไว้ และช่วยแนะนำผู้อื่นได้",
        },
      ],
      "column",
    ),
  ];
};

export const getTemplateSTI = () => {
  const timestamp = Date.now();

  return [
    {
      id: `sec_sti_${timestamp}`,
      type: "section",
      title: "แบบประเมินคัดกรองความเสี่ยงโรคติดต่อทางเพศสัมพันธ์",
      text: "โปรดระบุข้อมูลให้ชัดเจน เพื่อใช้ประกอบการขอเข้ารับบริการตรวจคัดกรองโรคติดต่อทางเพศสัมพันธ์และใช้ประกอบกับการรักษา ข้อมูลของท่านจะถูกเก็บเป็นความลับสูงสุด",
      hasDescription: true,
    },
    {
      id: `grp_sti_risk_${timestamp}`,
      type: "group",
      title: "แบบสอบถามประวัติและความเสี่ยง",
      text: "กรุณาตอบตามความเป็นจริงเพื่อให้แพทย์ประเมินความเร่งด่วนในการรักษา",
      isScored: true,
      scoringRules: [
        {
          min: 0,
          max: 9,
          label: "ความเสี่ยงต่ำ (ป้องกันและสังเกตอาการ)",
          color: "#10b981",
          advice:
            "ตรวจสุขภาพประจำปี (เช่น ตรวจเลือด HIV, ซิฟิลิส, คัดกรองมะเร็งปากมดลูกในผู้หญิง) และใช้ถุงยางอนามัยอย่างถูกต้องสม่ำเสมอ",
        },
        {
          min: 10,
          max: 19,
          label: "ความเสี่ยงปานกลาง (ควรตรวจคัดกรอง)",
          color: "#f59e0b",
          advice:
            "ควรเข้ารับการตรวจคัดกรอง STDs ตามรอบการตรวจสุขภาพ (ทุก 3-6 เดือน) หากมีอาการผิดปกติเพิ่มเติมโปรดติดต่อเจ้าหน้าที่",
        },
        {
          min: 20,
          max: 100,
          label: "ความเสี่ยงสูงมาก / เร่งด่วน",
          color: "#ef4444",
          advice:
            "ต้องพบแพทย์เพื่อตรวจเลือดและสารคัดหลั่งทันที ไม่ควรซื้อยากินเอง (หากมีความเสี่ยงเช่น ถุงยางแตก/รั่ว หรือถูกล่วงละเมิด ควรรีบติดต่อเพื่อพิจารณารับยาฉุกเฉิน PEP ภายใน 72 ชม.)",
        },
      ],
      subQuestions: [
        {
          id: `sq_sti_1_${timestamp}`,
          type: "multiple_choice",
          title: "ท่านเคยมีเพศสัมพันธ์หรือไม่",
          options: ["เคย", "ไม่เคย"],
          optionScores: [0, 0],
          optionHasInput: [false, false],
          required: true,
          isScored: true,
        },
        {
          id: `sq_sti_2_${timestamp}`,
          type: "multiple_choice",
          title: "คู่นอนของท่านเป็นเพศ",
          options: ["ชาย", "หญิง", "LGBTQIA+", "อื่นๆ"],
          optionScores: [0, 0, 0, 0],
          optionHasInput: [false, false, false, true], // 🟢 'อื่นๆ' ให้กรอกได้
          required: true,
          isScored: true,
        },
        {
          id: `sq_sti_3_${timestamp}`,
          type: "multiple_choice",
          title: "ท่านมีเพศสัมพันธ์กับคู่นอน",
          options: [
            "กับคู่นอนประจำ เท่านั้น",
            "กับคู่นอนไม่ประจำ เท่านั้น",
            "กับคู่นอนประจำ และคู่นอนไม่ประจำ",
            "ไม่มีเพศสัมพันธ์",
          ],
          optionScores: [0, 10, 10, 0],
          optionHasInput: [false, false, false, false],
          required: true,
          isScored: true,
        },
        {
          id: `sq_sti_4_${timestamp}`,
          type: "checkboxes",
          title:
            "ท่านมีเพศสัมพันธ์ครั้งล่าสุดช่องทางใด (เลือกได้มากกว่า 1 ข้อ)",
          options: [
            "ทางช่องคลอดผู้หญิง",
            "ทางปาก (Oral sex)",
            "ทางทวารหนัก (ของผู้หญิง)",
            "ทางทวารหนัก (ของผู้ชาย)",
            "ไม่มีเพศสัมพันธ์",
            "อื่นๆ",
          ],
          optionScores: [0, 0, 0, 0, 0, 0],
          optionHasInput: [false, false, false, false, false, true], // 🟢 'อื่นๆ' ให้กรอกได้
          required: true,
          isScored: true,
        },
        {
          id: `sq_sti_5_${timestamp}`,
          type: "multiple_choice",
          title: "การใช้ถุงยางอนามัย",
          options: [
            "ใช้ถุงยางอนามัยทุกครั้งที่มีเพศสัมพันธ์",
            "ใช้ถุงยางอนามัยเป็นบางครั้ง / ถุงยางแตก-รั่ว",
            "ไม่เคยใช้ถุงยางอนามัยเลย",
            "ไม่มีเพศสัมพันธ์",
          ],
          optionScores: [0, 10, 15, 0],
          optionHasInput: [false, false, false, false],
          required: true,
          isScored: true,
        },
        {
          id: `sq_sti_6_${timestamp}`,
          type: "multiple_choice",
          title: "ผลการตรวจหาเชื้อ HIV ครั้งล่าสุด",
          options: [
            "ไม่เคยตรวจ",
            "เคยตรวจ แต่จำผลการตรวจไม่ได้",
            "เคยตรวจ ผลตรวจ ไม่ติดเชื้อ HIV (ผลเป็นลบ)",
            "เคยตรวจ ผลตรวจ ติดเชื้อ HIV (ผลเป็นบวก)",
            "เคยตรวจ แต่สรุปผลไม่ได้",
          ],
          optionScores: [0, 0, 0, 0, 0],
          optionHasInput: [false, false, false, false, false],
          required: true,
          isScored: true,
        },
        {
          id: `sq_sti_7_${timestamp}`,
          type: "multiple_choice",
          title: "ท่านเคยใช้เข็มฉีดยา หรือฉีดสารเสพติดร่วมกับผู้อื่นหรือไม่",
          options: [
            "เคยใช้เข็มร่วมกับผู้อื่น",
            "ไม่เคยใช้เข็มร่วมกับผู้อื่น",
            "จำไม่ได้",
          ],
          optionScores: [20, 0, 5],
          optionHasInput: [false, false, false],
          required: true,
          isScored: true,
        },
        {
          id: `sq_sti_8_${timestamp}`,
          type: "multiple_choice",
          title:
            "ในระยะ 3 เดือนที่ผ่านมา ท่านมีอาการผิดปกติ เช่น ปัสสาวะแสบขัด ตกขาวมีกลิ่นเหม็น หรือเปลี่ยนเป็นสีคล้ำ สีเขียว มีแผล ตุ่ม หนองที่อวัยวะเพศหรือทวารหนัก หรือไม่",
          options: [
            "เคยมี รักษาหายแล้ว",
            "มีในขณะนี้",
            "ไม่เคยมีอาการเหล่านี้",
          ],
          optionScores: [10, 20, 0],
          optionHasInput: [false, false, false],
          required: true,
          isScored: true,
        },
        {
          id: `sq_sti_9_${timestamp}`,
          type: "dropdown",
          title:
            "กรณีกังวลเรื่องการรับเชื้อ (เช่น ถุงยางแตก/ไม่ได้ป้องกัน) เหตุการณ์เกิดขึ้นมาแล้วกี่ชั่วโมง?",
          options: [
            "ภายใน 48 ชั่วโมง",
            "ภายใน 72 ชั่วโมง",
            "เกิน 72 ชั่วโมงไปแล้ว",
            "ไม่มีเหตุการณ์ดังกล่าว",
          ],
          optionScores: [0, 0, 0, 0],
          optionHasInput: [false, false, false, false],
          required: true,
          isScored: true,
        },
      ],
    },
  ];
};
