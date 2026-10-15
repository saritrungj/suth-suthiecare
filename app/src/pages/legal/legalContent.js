// เนื้อหาข้อกำหนดการใช้บริการและนโยบายความเป็นส่วนตัว
// แก้เนื้อหาแล้วต้องเปลี่ยน updated ทั้งสองภาษาให้ตรงกัน

const CONTACT = {
  th: {
    organization: "โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี (รพ.มทส.)",
    address: "111 ถ.มหาวิทยาลัย ต.สุรนารี อ.เมือง จ.นครราชสีมา 30000",
    phone: "044-376555",
    website: "https://www.suth.go.th",
  },
  en: {
    organization: "Suranaree University of Technology Hospital (SUTH)",
    address:
      "111 University Avenue, Suranaree, Mueang, Nakhon Ratchasima 30000, Thailand",
    phone: "+66 44 376 555",
    website: "https://www.suth.go.th",
  },
};

const contactSection = (lang) => {
  const c = CONTACT[lang];
  return lang === "th"
    ? {
        id: "contact",
        title: "ช่องทางติดต่อ",
        body: [
          `${c.organization}`,
          `ที่อยู่: ${c.address}`,
          `โทรศัพท์: ${c.phone}`,
          `เว็บไซต์: ${c.website}`,
        ],
      }
    : {
        id: "contact",
        title: "Contact us",
        body: [
          `${c.organization}`,
          `Address: ${c.address}`,
          `Phone: ${c.phone}`,
          `Website: ${c.website}`,
        ],
      };
};

const terms = {
  th: {
    title: "ข้อกำหนดและเงื่อนไขการใช้บริการ",
    updated: "ปรับปรุงล่าสุด 7 ตุลาคม 2569",
    intro:
      'ข้อกำหนดนี้ใช้กับการเข้าใช้งาน SUTHie Care - สุดที่แคร์ ("ระบบ") ซึ่งให้บริการโดยโรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี ("โรงพยาบาล" หรือ "เรา") เมื่อท่านใช้งานระบบ ถือว่าท่านได้อ่านและยอมรับข้อกำหนดนี้แล้ว หากไม่ยอมรับ กรุณางดใช้งานระบบ',
    sections: [
      {
        id: "service",
        title: "1. ลักษณะของบริการ",
        body: [
          "ระบบเป็นช่องทางออนไลน์สำหรับทำแบบประเมินสุขภาพ ลงทะเบียนขอรับคำปรึกษา และติดตามผลกับคลินิกหรือหน่วยงานที่ใช้ระบบ",
          "เจ้าหน้าที่ของหน่วยงานใช้ระบบเพื่อคัดกรอง ติดต่อ ติดตาม และบันทึกการดูแลผู้รับบริการตามหน้าที่ที่ได้รับมอบหมาย",
        ],
      },
      {
        id: "not-diagnosis",
        title: "2. ผลประเมินไม่ใช่การวินิจฉัยทางการแพทย์",
        body: [
          "ผลแบบประเมินและคำแนะนำในระบบเป็นการคัดกรองเบื้องต้นเท่านั้น ไม่ใช่การวินิจฉัย การรักษา หรือคำสั่งทางการแพทย์ และไม่ใช้แทนการพบแพทย์หรือบุคลากรทางการแพทย์",
          "ระบบไม่ใช่บริการฉุกเฉิน หากท่านหรือผู้อื่นมีอาการรุนแรง มีความคิดทำร้ายตนเองหรือผู้อื่น หรืออยู่ในภาวะอันตราย ให้โทร 1669 (เจ็บป่วยฉุกเฉิน) หรือ 1323 (สายด่วนสุขภาพจิต) หรือไปโรงพยาบาลที่ใกล้ที่สุดทันที",
        ],
      },
      {
        id: "accounts",
        title: "3. บัญชีผู้ใช้และการเข้าสู่ระบบ",
        body: [
          "ท่านต้องให้ข้อมูลที่ถูกต้อง เป็นปัจจุบัน และเป็นข้อมูลของท่านเอง ห้ามทำแบบประเมินหรือลงทะเบียนในนามผู้อื่นโดยไม่มีอำนาจ",
          "ท่านต้องเก็บรักษารหัสผ่าน รหัสยืนยัน (OTP) และอุปกรณ์ที่ใช้เข้าสู่ระบบไว้เป็นความลับ และแจ้งเราทันทีเมื่อสงสัยว่ามีผู้อื่นเข้าใช้บัญชีของท่าน",
          "บัญชีเจ้าหน้าที่ใช้ได้เฉพาะตามบทบาทและหน่วยงานที่ได้รับสิทธิ์เท่านั้น ห้ามให้ผู้อื่นใช้บัญชีร่วม",
        ],
      },
      {
        id: "acceptable-use",
        title: "4. การใช้งานที่ไม่อนุญาต",
        body: [
          "ห้ามเข้าถึงหรือพยายามเข้าถึงข้อมูลที่ท่านไม่มีสิทธิ์ รวมถึงการหลบเลี่ยงการยืนยันตัวตนหรือการจำกัดสิทธิ์",
          "ห้ามรบกวน ทดสอบเจาะ หรือทำให้ระบบทำงานผิดปกติ เช่น ส่งคำขอจำนวนมากผิดปกติ ใช้โปรแกรมอัตโนมัติ หรืออัปโหลดไฟล์ที่เป็นอันตราย",
          "ห้ามคัดลอก เปิดเผย ส่งออก หรือนำข้อมูลผู้รับบริการไปใช้นอกเหนือจากหน้าที่ที่ได้รับมอบหมาย การส่งออกไฟล์ Excel หรือ PDF ต้องเก็บรักษาตามมาตรฐานความลับของหน่วยงาน",
          "ห้ามใช้ระบบในทางที่ผิดกฎหมาย รวมถึงพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 และพระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์",
        ],
      },
      {
        id: "staff-duties",
        title: "5. หน้าที่ของเจ้าหน้าที่และหน่วยงาน",
        body: [
          "หน่วยงานที่ใช้ระบบรับผิดชอบการกำหนดสิทธิ์ของสมาชิก การแจ้งประกาศความเป็นส่วนตัวในแบบฟอร์ม และการได้รับความยินยอมเมื่อกฎหมายกำหนด",
          "เจ้าหน้าที่ต้องรักษาความลับของผู้รับบริการตามจรรยาบรรณวิชาชีพและระเบียบของหน่วยงาน ระบบบันทึกประวัติการเข้าถึงและการแก้ไขข้อมูลเพื่อการตรวจสอบ",
        ],
      },
      {
        id: "content",
        title: "6. ทรัพย์สินทางปัญญา",
        body: [
          "เนื้อหา แบบประเมิน ภาพ และซอฟต์แวร์ในระบบเป็นของโรงพยาบาลหรือผู้อนุญาตให้ใช้สิทธิ์ ห้ามทำซ้ำหรือดัดแปลงเพื่อการพาณิชย์โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร",
          "แบบประเมินมาตรฐานบางชุดมีผู้พัฒนาเป็นเจ้าของลิขสิทธิ์ และนำมาใช้ตามเงื่อนไขของผู้พัฒนา",
        ],
      },
      {
        id: "availability",
        title: "7. ความพร้อมให้บริการและข้อจำกัดความรับผิด",
        body: [
          "เราพยายามให้ระบบพร้อมใช้งานอย่างต่อเนื่อง แต่อาจหยุดให้บริการชั่วคราวเพื่อบำรุงรักษา ปรับปรุง หรือเหตุสุดวิสัย โดยไม่ต้องแจ้งล่วงหน้า",
          "ภายในขอบเขตที่กฎหมายอนุญาต เราไม่รับผิดต่อความเสียหายที่เกิดจากการใช้หรือไม่สามารถใช้ระบบ ข้อมูลที่ผู้ใช้กรอกไม่ถูกต้อง หรือการตัดสินใจโดยอาศัยผลประเมินเพียงอย่างเดียว",
        ],
      },
      {
        id: "suspension",
        title: "8. การระงับการใช้งาน",
        body: [
          "เราอาจระงับหรือยกเลิกบัญชีหรือการเข้าถึงของผู้ที่ฝ่าฝืนข้อกำหนดนี้ หรือเมื่อจำเป็นเพื่อความปลอดภัยของระบบและข้อมูล",
        ],
      },
      {
        id: "privacy",
        title: "9. ข้อมูลส่วนบุคคล",
        body: [
          "การเก็บ ใช้ และเปิดเผยข้อมูลส่วนบุคคลเป็นไปตามนโยบายความเป็นส่วนตัวของระบบ และประกาศความเป็นส่วนตัวของแต่ละแบบฟอร์ม",
        ],
        link: { to: "/privacy-policy", label: "อ่านนโยบายความเป็นส่วนตัว" },
      },
      {
        id: "changes",
        title: "10. การเปลี่ยนแปลงข้อกำหนดและกฎหมายที่ใช้บังคับ",
        body: [
          "เราอาจปรับปรุงข้อกำหนดนี้เป็นครั้งคราว และจะแสดงวันที่ปรับปรุงล่าสุดไว้ที่หน้านี้ การใช้งานต่อหลังการปรับปรุงถือว่าท่านยอมรับข้อกำหนดฉบับใหม่",
          "ข้อกำหนดนี้อยู่ภายใต้กฎหมายไทย",
        ],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated 7 October 2026",
    intro:
      'These terms apply to your use of SUTHie Care ("the system"), operated by Suranaree University of Technology Hospital ("the hospital", "we"). By using the system you confirm that you have read and accept these terms. If you do not accept them, please do not use the system. The Thai version prevails if the two versions differ.',
    sections: [
      {
        id: "service",
        title: "1. The service",
        body: [
          "The system lets you take health assessments online, register for consultation, and follow up with the clinics and organizations that use it.",
          "Organization staff use the system to screen, contact, follow up, and record care for people within the duties assigned to them.",
        ],
      },
      {
        id: "not-diagnosis",
        title: "2. Assessment results are not a medical diagnosis",
        body: [
          "Assessment results and advice in the system are preliminary screening only. They are not a diagnosis, treatment, or medical instruction and do not replace seeing a doctor or health professional.",
          "The system is not an emergency service. If you or someone else has severe symptoms, thoughts of self-harm or harming others, or is in danger, call 1669 (medical emergency) or 1323 (mental health hotline), or go to the nearest hospital now.",
        ],
      },
      {
        id: "accounts",
        title: "3. Accounts and sign-in",
        body: [
          "Give accurate, current information about yourself. Do not take assessments or register on behalf of someone else without authority.",
          "Keep your password, one-time codes (OTP), and signed-in devices confidential, and tell us at once if you think someone else has used your account.",
          "Staff accounts may only be used within the role and organization they were granted. Do not share accounts.",
        ],
      },
      {
        id: "acceptable-use",
        title: "4. Prohibited use",
        body: [
          "Do not access or try to access data you are not entitled to, including bypassing authentication or permission limits.",
          "Do not disrupt, probe, or overload the system, for example with unusual request volumes, automated tools, or harmful uploads.",
          "Do not copy, disclose, export, or use personal data beyond your assigned duties. Exported Excel or PDF files must be kept under your organization's confidentiality rules.",
          "Do not use the system unlawfully, including in breach of the Thai Personal Data Protection Act B.E. 2562 (2019) and the Computer Crime Act.",
        ],
      },
      {
        id: "staff-duties",
        title: "5. Staff and organization duties",
        body: [
          "Organizations using the system are responsible for member permissions, the privacy notice shown on their forms, and obtaining consent where the law requires it.",
          "Staff must keep people's information confidential under their professional ethics and organization rules. The system logs data access and changes for audit.",
        ],
      },
      {
        id: "content",
        title: "6. Intellectual property",
        body: [
          "Content, assessments, images, and software in the system belong to the hospital or its licensors. Do not reproduce or adapt them commercially without written permission.",
          "Some standard assessment tools are copyrighted by their developers and are used under the developers' terms.",
        ],
      },
      {
        id: "availability",
        title: "7. Availability and limitation of liability",
        body: [
          "We aim to keep the system available but may suspend it temporarily for maintenance, upgrades, or events beyond our control without prior notice.",
          "To the extent permitted by law, we are not liable for loss arising from using or being unable to use the system, inaccurate information entered by users, or decisions based on assessment results alone.",
        ],
      },
      {
        id: "suspension",
        title: "8. Suspension",
        body: [
          "We may suspend or close accounts or access that breach these terms, or when needed to protect the system and its data.",
        ],
      },
      {
        id: "privacy",
        title: "9. Personal data",
        body: [
          "We collect, use, and disclose personal data as described in the privacy policy and the privacy notice of each form.",
        ],
        link: { to: "/privacy-policy", label: "Read the privacy policy" },
      },
      {
        id: "changes",
        title: "10. Changes and governing law",
        body: [
          "We may update these terms from time to time and will show the latest update date on this page. Continuing to use the system after an update means you accept the new terms.",
          "These terms are governed by Thai law.",
        ],
      },
    ],
  },
};

const privacy = {
  th: {
    title: "นโยบายความเป็นส่วนตัว",
    updated: "ปรับปรุงล่าสุด 7 ตุลาคม 2569",
    intro:
      "โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารีให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่าน นโยบายนี้อธิบายว่าระบบ SUTHie Care เก็บข้อมูลใด ใช้เพื่ออะไร เปิดเผยให้ใคร เก็บไว้นานเท่าใด และท่านมีสิทธิอะไรบ้าง ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)",
    sections: [
      {
        id: "controller",
        title: "1. ผู้ควบคุมข้อมูลส่วนบุคคล",
        body: [
          'โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารีเป็นผู้ให้บริการระบบ คลินิกหรือหน่วยงานที่เป็นเจ้าของแบบฟอร์มและดูแลเคสของท่านเป็นผู้ควบคุมข้อมูลที่เก็บผ่านแบบฟอร์มนั้น รายละเอียดเฉพาะของแต่ละแบบฟอร์มแสดงไว้ใน "ประกาศความเป็นส่วนตัว" ก่อนเริ่มทำแบบฟอร์ม',
        ],
      },
      {
        id: "data",
        title: "2. ข้อมูลที่เราเก็บ",
        list: [
          "ข้อมูลระบุตัวตนและติดต่อ: ชื่อ-นามสกุล เพศ วันเกิดหรืออายุ เบอร์โทรศัพท์ อีเมล รหัสนักศึกษาหรือรหัสประจำตัวอื่นที่แบบฟอร์มขอ",
          "เลขประจำตัวประชาชน: เก็บเมื่อท่านยินยอมเท่านั้น เพื่อรวมผลประเมินของบุคคลเดียวกันเข้าแฟ้มเดียว ระบบจัดเก็บแบบเข้ารหัสและใช้ค่าแฮชในการจับคู่ และแสดงแบบปิดบังบางส่วน",
          "ข้อมูลสุขภาพ (ข้อมูลอ่อนไหว): คำตอบแบบประเมิน คะแนน ระดับความเสี่ยง ผลตรวจสุขภาพ และบันทึกการติดต่อติดตามของเจ้าหน้าที่",
          "ข้อมูลบัญชี: ชื่อผู้ใช้ รหัสผ่าน (เก็บแบบแฮช ไม่สามารถถอดกลับได้) และประวัติการยืนยันอีเมล",
          "ข้อมูลที่ได้รับจากหน่วยงานต้นสังกัด: เช่น รายชื่อ ชั้นเรียน หรือแผนกที่สถานศึกษาหรือองค์กรส่งเข้ารับบริการ",
          "ข้อมูลทางเทคนิค: หมายเลข IP ประเภทอุปกรณ์และเบราว์เซอร์ เวลาเข้าใช้ และบันทึกการเข้าถึงข้อมูล (audit log)",
        ],
      },
      {
        id: "purposes",
        title: "3. วัตถุประสงค์และฐานทางกฎหมาย",
        list: [
          "คัดกรองสุขภาพ แจ้งผลประเมิน และส่งต่อให้คลินิกที่เกี่ยวข้องติดต่อและดูแลท่าน (ฐานความยินยอมโดยชัดแจ้งสำหรับข้อมูลสุขภาพ และฐานเวชศาสตร์ป้องกันและการรักษาตามมาตรา 26)",
          "ป้องกันหรือระงับอันตรายต่อชีวิตหรือสุขภาพ เมื่อผลประเมินบ่งชี้ความเสี่ยงสูง (ฐานประโยชน์สำคัญต่อชีวิต)",
          "สร้างและดูแลบัญชี ยืนยันตัวตน และกู้คืนรหัสผ่าน (ฐานสัญญา)",
          "รักษาความปลอดภัยของระบบ ตรวจสอบการเข้าถึง และป้องกันการใช้งานผิดวัตถุประสงค์ (ฐานประโยชน์โดยชอบด้วยกฎหมาย)",
          "จัดทำสถิติและรายงานภาพรวมเพื่อพัฒนาบริการ โดยใช้ข้อมูลที่ไม่ระบุตัวบุคคลเท่าที่ทำได้ (ฐานประโยชน์โดยชอบด้วยกฎหมาย และการวิจัยทางสถิติตามที่กฎหมายกำหนด)",
          "ปฏิบัติตามกฎหมายและคำสั่งของหน่วยงานรัฐที่มีอำนาจ (ฐานหน้าที่ตามกฎหมาย)",
        ],
      },
      {
        id: "minors",
        title: "4. ผู้เยาว์",
        body: [
          "หากผู้รับบริการเป็นผู้เยาว์ ความยินยอมในกรณีที่กฎหมายกำหนดต้องได้รับจากผู้ใช้อำนาจปกครอง เว้นแต่เป็นการกระทำที่ผู้เยาว์ทำได้เองตามกฎหมาย สถานศึกษาหรือหน่วยงานที่ส่งข้อมูลนักเรียนเข้าระบบมีหน้าที่ดูแลให้เป็นไปตามเงื่อนไขนี้",
        ],
      },
      {
        id: "sharing",
        title: "5. การเปิดเผยข้อมูล",
        body: [
          "เราเปิดเผยข้อมูลเท่าที่จำเป็นเท่านั้น และไม่ขายข้อมูลส่วนบุคคลของท่าน",
        ],
        list: [
          "เจ้าหน้าที่ของคลินิกหรือหน่วยงานที่ดูแลท่าน ตามบทบาทและสิทธิ์ที่ได้รับ เช่น ครูเห็นเฉพาะนักเรียนในห้องที่ได้รับมอบหมาย",
          "หน่วยบริการที่รับส่งต่อการดูแล เมื่อมีการส่งต่อเคส",
          "ผู้ให้บริการส่งอีเมล เพื่อส่งรหัสยืนยัน (OTP) และการแจ้งเตือนทางอีเมล",
          "บริการแจ้งเตือนผ่านข้อความ (เช่น Telegram) ของหน่วยงาน ซึ่งส่งเฉพาะรหัสอ้างอิงเคส ไม่ส่งชื่อหรือผลประเมิน",
          "หน่วยงานรัฐหรือผู้มีอำนาจตามกฎหมาย เมื่อมีคำสั่งหรือกฎหมายกำหนด",
        ],
      },
      {
        id: "cookies",
        title: "6. คุกกี้และการจัดเก็บในเบราว์เซอร์",
        body: [
          "ระบบใช้คุกกี้ที่จำเป็นเท่านั้น ได้แก่ คุกกี้เซสชันสำหรับการเข้าสู่ระบบ (HttpOnly ไม่ให้สคริปต์อ่านได้) และคุกกี้อุปกรณ์ที่เชื่อถือได้สำหรับลดการขอรหัสยืนยันซ้ำ",
          "เบราว์เซอร์อาจจัดเก็บการตั้งค่าภาษา สถานะการติดตั้งแอป (PWA) และไฟล์แคชเพื่อให้โหลดเร็วขึ้น ระบบไม่ใช้คุกกี้โฆษณาหรือคุกกี้ติดตามของบุคคลภายนอก",
        ],
      },
      {
        id: "security",
        title: "7. การรักษาความปลอดภัย",
        list: [
          "เข้ารหัสการรับส่งข้อมูลด้วย HTTPS และเข้ารหัสข้อมูลส่วนบุคคลที่สำคัญเมื่อจัดเก็บ",
          "ปิดบังชื่อ เบอร์โทรศัพท์ และเลขประจำตัวประชาชนบนหน้าจอเจ้าหน้าที่ตามความจำเป็น",
          "จำกัดสิทธิ์ตามบทบาทและหน่วยงาน ยืนยันตัวตนเจ้าหน้าที่ด้วยรหัสยืนยันทางอีเมล และบันทึกประวัติการเข้าถึงทุกครั้ง",
          "เก็บไฟล์แนบในพื้นที่ส่วนตัวที่ต้องเข้าสู่ระบบก่อนเปิดดู",
        ],
      },
      {
        id: "retention",
        title: "8. ระยะเวลาการเก็บรักษา",
        body: [
          "เราเก็บข้อมูลเท่าที่จำเป็นต่อวัตถุประสงค์ข้างต้น หรือตามที่กฎหมายและมาตรฐานเวชระเบียนกำหนด แต่ละหน่วยงานกำหนดระยะเวลาเก็บรักษาข้อมูลแต่ละประเภทไว้ในระบบ เมื่อพ้นระยะเวลาแล้ว ข้อมูลจะถูกลบ ทำลาย หรือทำให้ไม่สามารถระบุตัวบุคคลได้",
        ],
      },
      {
        id: "rights",
        title: "9. สิทธิของเจ้าของข้อมูล",
        body: ["ท่านมีสิทธิตามกฎหมายดังนี้"],
        list: [
          "ขอเข้าถึงและขอรับสำเนาข้อมูลของท่าน",
          "ขอแก้ไขข้อมูลให้ถูกต้องและเป็นปัจจุบัน",
          "ขอลบหรือทำลายข้อมูล",
          "ขอจำกัดการใช้ข้อมูล",
          "คัดค้านการเก็บ ใช้ หรือเปิดเผยข้อมูล",
          "ขอรับหรือขอให้โอนข้อมูลในรูปแบบที่อ่านได้ด้วยเครื่อง",
          "ถอนความยินยอมเมื่อใดก็ได้ โดยไม่กระทบการประมวลผลที่ทำไปแล้วก่อนถอน",
          "ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)",
        ],
        after: [
          "ท่านยื่นคำขอได้ผ่านช่องทางติดต่อด้านล่าง เราจะตรวจสอบตัวตนก่อนดำเนินการ และตอบกลับภายใน 30 วันนับจากวันที่ได้รับคำขอ เราอาจปฏิเสธคำขอได้ในกรณีที่กฎหมายอนุญาต เช่น ต้องเก็บข้อมูลไว้ตามหน้าที่ทางกฎหมายหรือเพื่อการรักษา โดยจะแจ้งเหตุผลให้ทราบ",
        ],
      },
      {
        id: "changes",
        title: "10. การเปลี่ยนแปลงนโยบาย",
        body: [
          "เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว และจะแสดงวันที่ปรับปรุงล่าสุดไว้ที่หน้านี้ หากมีการเปลี่ยนแปลงที่สำคัญ เราจะแจ้งให้ทราบผ่านระบบ",
        ],
        link: { to: "/terms", label: "อ่านข้อกำหนดการใช้บริการ" },
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated 7 October 2026",
    intro:
      "Suranaree University of Technology Hospital takes the protection of your personal data seriously. This policy explains what SUTHie Care collects, why, who it is shared with, how long it is kept, and your rights under the Thai Personal Data Protection Act B.E. 2562 (2019) (PDPA). The Thai version prevails if the two versions differ.",
    sections: [
      {
        id: "controller",
        title: "1. Data controller",
        body: [
          'The hospital operates the system. The clinic or organization that owns a form and handles your case is the controller of the data collected through that form. Form-specific details are shown in the "Privacy notice" before you start each form.',
        ],
      },
      {
        id: "data",
        title: "2. Data we collect",
        list: [
          "Identity and contact data: name, sex, date of birth or age, phone number, email, and any student or other ID a form asks for.",
          "National ID number: collected only with your consent, to link assessments of the same person into one file. It is stored encrypted, matched by hash, and shown partly masked.",
          "Health data (sensitive data): assessment answers, scores, risk levels, checkup results, and staff follow-up notes.",
          "Account data: username, password (stored as a one-way hash), and email verification history.",
          "Data from your organization: for example names, classes, or departments that a school or organization submits for service.",
          "Technical data: IP address, device and browser type, access times, and data access logs (audit log).",
        ],
      },
      {
        id: "purposes",
        title: "3. Purposes and legal bases",
        list: [
          "Screen your health, show your results, and let the relevant clinic contact and care for you (explicit consent for health data, and preventive medicine and treatment under Section 26).",
          "Prevent or suppress danger to life or health when results show high risk (vital interest).",
          "Create and maintain accounts, verify identity, and recover passwords (contract).",
          "Secure the system, audit access, and prevent misuse (legitimate interest).",
          "Produce aggregate statistics and reports to improve services, de-identified wherever possible (legitimate interest and statistical research as permitted by law).",
          "Comply with the law and lawful orders of authorities (legal obligation).",
        ],
      },
      {
        id: "minors",
        title: "4. Minors",
        body: [
          "Where the person served is a minor and the law requires consent, consent must come from the parent or guardian unless the minor may act alone under the law. Schools and organizations that submit student data are responsible for meeting this condition.",
        ],
      },
      {
        id: "sharing",
        title: "5. Disclosure",
        body: [
          "We share data only as far as needed, and we never sell your personal data.",
        ],
        list: [
          "Staff of the clinic or organization caring for you, within their role and permissions; for example, a teacher sees only students in assigned classrooms.",
          "Care providers receiving a referral, when your case is referred.",
          "Our email provider, to send one-time codes (OTP) and email notifications.",
          "Organization messaging alerts (such as Telegram), which carry only a case reference number, never names or results.",
          "Authorities, when required by law or lawful order.",
        ],
      },
      {
        id: "cookies",
        title: "6. Cookies and browser storage",
        body: [
          "The system uses only essential cookies: a sign-in session cookie (HttpOnly, unreadable by scripts) and a trusted-device cookie that reduces repeated verification codes.",
          "Your browser may store your language setting, app install (PWA) state, and cached files for faster loading. We use no advertising or third-party tracking cookies.",
        ],
      },
      {
        id: "security",
        title: "7. Security",
        list: [
          "HTTPS for data in transit and encryption of key personal data at rest.",
          "Names, phone numbers, and national IDs are masked on staff screens where full values are not needed.",
          "Role- and organization-based permissions, email verification codes for staff sign-in, and a log of every data access.",
          "Attachments are kept in private storage that requires sign-in to open.",
        ],
      },
      {
        id: "retention",
        title: "8. Retention",
        body: [
          "We keep data only as long as needed for the purposes above, or as required by law and medical record standards. Each organization sets retention periods per data type in the system. After that period, data is deleted, destroyed, or de-identified.",
        ],
      },
      {
        id: "rights",
        title: "9. Your rights",
        body: ["Under the law you have the right to:"],
        list: [
          "access and obtain a copy of your data;",
          "have your data corrected and kept up to date;",
          "have your data erased or destroyed;",
          "restrict processing of your data;",
          "object to collection, use, or disclosure;",
          "receive or transfer your data in a machine-readable format;",
          "withdraw consent at any time, without affecting processing done before withdrawal;",
          "complain to the Personal Data Protection Committee (PDPC).",
        ],
        after: [
          "Submit a request through the contacts below. We verify your identity first and reply within 30 days of receiving the request. We may refuse where the law allows, for example when we must keep data by law or for treatment, and will tell you why.",
        ],
      },
      {
        id: "changes",
        title: "10. Changes to this policy",
        body: [
          "We may update this policy from time to time and will show the latest update date on this page. We will notify you in the system of any significant change.",
        ],
        link: { to: "/terms", label: "Read the terms of service" },
      },
    ],
  },
};

export function getLegalDocument(kind, language = "th") {
  const lang = language.startsWith("en") ? "en" : "th";
  const doc = (kind === "terms" ? terms : privacy)[lang];
  return { ...doc, lang, sections: [...doc.sections, contactSection(lang)] };
}
