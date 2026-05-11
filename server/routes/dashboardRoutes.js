// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); 

// 🟢 นำเข้าระบบถอดรหัส (สำหรับใช้นับสถิตินักศึกษา/ความเสี่ยง)
const { decrypt } = require('../utils/encryption');
const safeDecrypt = (val) => decrypt(val) || val;

// 1. สรุปข้อมูล Dashboard
router.get('/dashboard/summary', async (req, res) => {
    try {
        const [totalRes] = await db.query("SELECT COUNT(*) as total FROM form_responses");
        const [todayRes] = await db.query("SELECT COUNT(*) as today FROM form_responses WHERE DATE(submitted_at) = CURDATE()");
        res.json({
            total: totalRes[0].total || 0,
            today: todayRes[0].today || 0,
            pending: 0
        });
    } catch (err) {
        console.error("Dashboard Summary Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// 2. ข้อมูลเคสล่าสุด
router.get('/dashboard/recent', async (req, res) => {
    try {
        const { clinic } = req.query; 
        // 🟢 เพิ่ม r.form_id ลงใน SELECT ด้วย! สำคัญมากสำหรับใช้ดึงเกณฑ์คะแนนย่อย
        let sql = `
            SELECT r.id, r.form_id, r.identity_value, r.summary_data, r.submitted_at, r.status, r.risk_level, r.master_case_id, f.title as form_title, f.clinic_type 
            FROM form_responses r 
            LEFT JOIN forms f ON r.form_id = f.id 
            WHERE 1=1
        `;
        const params = [];
        if (clinic && clinic !== 'all') {
            sql += " AND f.clinic_type = ?";
            params.push(clinic);
        }
        sql += " ORDER BY r.submitted_at DESC LIMIT 15";

        const [rows] = await db.query(sql, params);

        const decryptedRows = rows.map(r => {
            if (r.summary_data) {
                try {
                    let summaryStr = safeDecrypt(r.summary_data);
                    let summary = typeof summaryStr === 'string' ? JSON.parse(summaryStr) : summaryStr;
                    if (summary.display_name) summary.display_name = safeDecrypt(summary.display_name);
                    if (summary.phone) summary.phone = safeDecrypt(summary.phone);
                    r.summary_data = summary;
                } catch (e) {}
            }
            return r;
        });
        
        res.json(decryptedRows);
    } catch (err) {
        console.error("Dashboard Recent Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// 3. ดึงการตั้งค่าหน้า Dashboard
router.get('/dashboard-settings/settings', async (req, res) => {
    try {
        const role_id = 1; // Dashboard ส่วนกลางสำหรับ Admin
        const [rows] = await db.query("SELECT * FROM dashboard_settings WHERE role_id = ?", [role_id]);
        res.json(rows[0] || { last_selected_form_id: null, active_charts: "[]" });
    } catch (err) {
        console.error("GET Dashboard Settings Error:", err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดจากฐานข้อมูล" });
    }
});
 
// 4. บันทึกการตั้งค่าหน้า Dashboard
router.post('/dashboard-settings/settings', async (req, res) => {
    try {
        const role_id = 1; 
        const { formId, charts } = req.body;

        const sql = `
            INSERT INTO dashboard_settings (role_id, last_selected_form_id, active_charts) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                last_selected_form_id = VALUES(last_selected_form_id), 
                active_charts = VALUES(active_charts)
        `;
        
        await db.query(sql, [role_id, formId || null, JSON.stringify(charts)]);
        res.json({ message: "บันทึกการตั้งค่า Dashboard สำเร็จ!" });
    } catch (err) {
        console.error("POST Dashboard Settings Error:", err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
});

// 5. ข้อมูลกราฟ (Chart) ดึงคำตอบจริงจาก DB
router.get('/charts/:formId/:questionId', async (req, res) => {
  try {
    const { formId, questionId } = req.params;
    const { startDate, endDate } = req.query;
    
    let sql = `
      SELECT fa.response_id, fa.answer_value, fr.summary_data
      FROM form_answers fa
      JOIN form_responses fr ON fa.response_id = fr.id
      WHERE fa.form_id = ? AND fa.question_id = ?
    `;
    const params = [formId, questionId];

    if (startDate && endDate) {
      sql += ` AND DATE(fr.submitted_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    const [rows] = await db.query(sql, params);
    console.log("📥 Raw Rows from DB (First Row):", rows[0]);
    // ✅ รวมคำตอบต่อ 1 คนก่อน
    const grouped = {};

    rows.forEach(r => {
        // ตรวจสอบว่า summary_data มีค่ามาจริงไหม
      if (!grouped[r.response_id]) {
        console.log(`👤 Response ID: ${r.response_id} | Summary Data:`, r.summary_data ? "Has Data" : "EMPTY");
        // 🟢 จุดที่ 1: ถอดรหัส summary_data ก่อนเก็บลงใน Object
        let decryptedSummary = r.summary_data;
        if (typeof decryptedSummary === 'string' && decryptedSummary !== "") {
          try {
            decryptedSummary = safeDecrypt(decryptedSummary);
          } catch (e) {
            console.error("❌ Decrypt Summary Error:", e.message);
          }
        }

        grouped[r.response_id] = { 
          answers: [], 
          summary: decryptedSummary // เก็บค่าที่ถอดรหัสแล้ว
        };
      }
      let decryptedValue = r.answer_value;
      if (typeof decryptedValue === 'string') {
          decryptedValue = safeDecrypt(decryptedValue);
      }

      let value;
      try {
        // 🟢 ลองแปลงเป็น JSON (เผื่อเป็น Array/Object เช่น Checkbox, Grid)
        value = typeof decryptedValue === "string"
          ? JSON.parse(decryptedValue)
          : decryptedValue;
      } catch {
        value = decryptedValue;
      }

      grouped[r.response_id].answers.push(value);
    });

    const result = Object.values(grouped).map(data => {
      const firstAnswer = data.answers[0];
      let label = "";

      // 1. จัดการข้อมูลที่เป็น Array (เช่น Checkbox)
      if (typeof firstAnswer === "object" && firstAnswer !== null) {
        label = "กลุ่มข้อมูลพฤติกรรม/สรุปผล"; 
      } else {
        label = firstAnswer ? String(firstAnswer).trim() : "ไม่ระบุ";
      }

      return {
        name: label,
        value: 1, 
        summary_data: data.summary 
      };
    });

    // ส่งผลลัพธ์กลับไปเป็น Array ของ Object ที่มี summary_data ติดไปด้วย
    res.json(result);
    
  } catch (err) {
    console.error("Chart API Error:", err);
    res.status(500).json({ message: "error" });
  }
});

// ==========================================
// 6. สรุปสถิติสำหรับ Dashboard (รวมของคลินิก STI)
// ==========================================
router.get('/admin/master-cases/stats', async (req, res) => {
    try {
        const { clinic, form_id } = req.query;
        
        // 🟢 1. ดึง f.questions (โครงสร้างฟอร์ม) มาด้วย เพื่อเอามาเช็ค Type
        let sql = `
            SELECT r.id AS response_id, r.summary_data, r.status AS response_status, r.submitted_at,
                   m.id AS master_id, m.status AS master_status, m.clinical_data,
                   f.questions AS form_questions
            FROM form_responses r
            LEFT JOIN mastercases m ON r.master_case_id = m.id
            LEFT JOIN forms f ON r.form_id = f.id
            WHERE 1=1
        `;
        const params = [];
        if (clinic && clinic !== 'all') {
            sql += " AND f.clinic_type = ?";
            params.push(clinic);
        }
        if (form_id) {
            sql += " AND r.form_id = ?";
            params.push(form_id);
        }

        const [rows] = await db.query(sql, params);

        let stats = {
            totalActive: 0, newToday: 0, closed: 0,
            highRisk: 0, waitingContact: 0, forwardSafeClinic: 0,
            totalStudent: 0, totalGeneral: 0,
            bloodTestNegative: 0, bloodTestPositive: 0,
            prepWithBlood: 0, prepWithoutBlood: 0
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const uniqueCases = {};
        rows.forEach(row => {
            const caseKey = row.master_id ? `master_${row.master_id}` : `resp_${row.response_id}`;
            const currentValidDate = row.submitted_at ? new Date(row.submitted_at).getTime() : 0;
            const existingValidDate = uniqueCases[caseKey]?.submitted_at ? new Date(uniqueCases[caseKey].submitted_at).getTime() : -1;
            
            if (!uniqueCases[caseKey] || currentValidDate > existingValidDate) {
                uniqueCases[caseKey] = row;
            }
        });

        Object.values(uniqueCases).forEach(c => {
            const isClosed = c.master_status === 'Closed' || c.response_status === 'ปิดเคสเรียบร้อย';
            if (isClosed) stats.closed++;
            else stats.totalActive++;

            const caseDate = new Date(c.submitted_at);
            if (caseDate >= today) stats.newToday++;
            
            const statusStr = String(c.response_status || "").trim();
            if (statusStr.includes('รอติดต่อ') || statusStr.includes('รอดำเนินการ')) stats.waitingContact++;
            if (statusStr.includes('Safe') || statusStr.includes('ส่งต่อ')) stats.forwardSafeClinic++;

            if (c.clinical_data) {
                let cData = c.clinical_data;
                try {
                    while (typeof cData === 'string') cData = JSON.parse(cData);
                    const bt = String(cData?.blood_test || "").trim().toLowerCase();
                    const prep = String(cData?.prep || "").trim().toLowerCase();

                    if (bt === 'negative') stats.bloodTestNegative++;
                    if (bt === 'positive') stats.bloodTestPositive++;
                    if (prep === 'prep_with_blood') stats.prepWithBlood++;
                    if (prep === 'prep_without_blood') stats.prepWithoutBlood++;
                } catch(e) { } 
            }

            if (c.summary_data) {
                try {
                    let summaryStr = safeDecrypt(c.summary_data);
                    let summary = typeof summaryStr === 'string' ? JSON.parse(summaryStr) : summaryStr;
                    
                    let foundStatus = false;
                    let targetQuestionTitles = [];

                    // 🟢 2. แกะโครงสร้างฟอร์ม เพื่อหาว่าคำถามข้อไหนที่มี type เป็น 'user_status' หรือ 'faculty'
                    if (c.form_questions) {
                        try {
                            let formQs = typeof c.form_questions === 'string' ? JSON.parse(c.form_questions) : c.form_questions;
                            // 🟢 ดักจับจาก Flag isUserStatus ด้วย!
                            const statusQs = formQs.filter(q => q.type === 'user_status' || q.isUserStatus === true || q.type === 'faculty');
                            targetQuestionTitles = statusQs.map(q => q.title);
                        } catch (e) { }
                    }

                    // 🟢 3. เข้าไปอ่านคำตอบ เฉพาะข้อที่เราดึง Title มาจาก Type ได้เท่านั้น!
                    if (summary.raw_answers && targetQuestionTitles.length > 0) {
                        for (const qTitle of targetQuestionTitles) {
                            const answerValue = summary.raw_answers[qTitle]; // ดึงคำตอบมาตรงๆ
                            if (answerValue) {
                                const ansStr = String(answerValue);
                                if (ansStr.includes("นักศึกษา") || ansStr.includes("สำนักวิชา")) {
                                    stats.totalStudent++;
                                    foundStatus = true;
                                    break;
                                } else if (ansStr.includes("บุคคลทั่วไป") || ansStr.includes("รับจ้าง") || ansStr.includes("ค้าขาย")) {
                                    stats.totalGeneral++;
                                    foundStatus = true;
                                    break;
                                }
                            }
                        }
                    }

                    // 🟢 4. Fallback เผื่อเป็นเคสรุ่นเก่ามากๆ ที่ยังไม่ได้ใช้ระบบ Type ใหม่
                    if (!foundStatus && summary.display_faculty) {
                        const faculty = String(summary.display_faculty);
                        if (faculty.includes("บุคคลทั่วไป") || faculty.includes("รับจ้าง") || faculty.includes("ค้าขาย")) {
                            stats.totalGeneral++;
                        } else if (faculty.includes("นักศึกษา") || faculty.includes("สำนักวิชา")) {
                            stats.totalStudent++;
                        }
                    }

                    const results = summary.score_results || [];
                    const isHighRisk = results.some(res => {
                        const c = res.color?.toLowerCase() || '';
                        return c.includes('d93025') || c.includes('e53935') || c.includes('f44336') ||
                          c.includes('ef4444') || c.includes('dc2626') || c.includes('ff0000') || c.includes('red') ||
                          (res.label && res.label.includes('สูง'));
                    });
                    if (isHighRisk && !isClosed) stats.highRisk++;
                } catch (e) {}
            }
        });

        res.json(stats);
    } catch (error) {
        console.error("Stats API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;