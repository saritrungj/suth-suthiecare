// routes/formRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); 
const { sendTelegramAlert } = require('../utils/telegram'); 
// 🟢 นำเข้าระบบเข้ารหัส
const { encrypt, decrypt, hmacHash } = require('../utils/encryption');
const { verifyToken } = require('../middleware/authMiddleware');
const NodeCache = require('node-cache');
// ตั้งค่าให้จำไว้ 60 วินาที (1 นาที) เพื่อให้หน้าเว็บไม่อืด แต่แอดมินแก้ฟอร์มแล้วยังอัปเดตไวอยู่
const formCache = new NodeCache({ stdTTL: 60 });
// Helper ถอดรหัส (ถ้าเป็น plain text เดิม จะคืนค่าเดิมกลับไป)
const safeDecrypt = (val) => decrypt(val) || val;

// 1. บันทึกฟอร์มใหม่ (🟢 เพิ่ม form_type)
router.post('/save-form', verifyToken, async (req, res) => {
  const { title, description, formStepName, theme, questions, status, clinic_type, form_type, publish_start_date, publish_end_date } = req.body;
  try {
    const query = `
      INSERT INTO forms 
      (title, description, step_name, theme, questions, status, clinic_type, form_type, publish_start_date, publish_end_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      title || 'แบบฟอร์มไม่มีชื่อ', description || '', formStepName || 'ส่วนที่ 1',
      JSON.stringify(theme || {}), JSON.stringify(questions || []),
      status || 'draft', clinic_type || 'general', form_type || 'Registration',
      publish_start_date || null, publish_end_date || null
    ];
    const [result] = await db.query(query, values);
    formCache.flushAll();
    res.json({ message: "Form saved successfully", id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save form" });
  }
});

// 2. ดึงข้อมูลฟอร์มทั้งหมด (🟢 เพิ่ม form_type)
router.get('/forms', async (req, res) => {
    try {
        const sort = req.query.sort || 'lastOpened';

        const cacheKey = `all_forms_${sort}`;

        if (formCache.has(cacheKey)) {
            return res.json(formCache.get(cacheKey));
        }

        const [rows] = await db.query(`SELECT id, title, description, theme, updated_at, status, clinic_type, form_type, publish_start_date, publish_end_date FROM forms`);
        
        rows.sort((a, b) => {
            if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
            else return new Date(b.updated_at) - new Date(a.updated_at);
        });

        const formattedForms = rows.map(form => {
            let coverImage = null;
            if (form.theme) {
                try {
                    const themeData = typeof form.theme === 'string' ? JSON.parse(form.theme) : form.theme;
                    coverImage = themeData.headerImage || null;
                } catch (e) { console.error("Error parsing theme for form ID:", form.id); }
            }
            const d = new Date(form.updated_at);
            const dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()+543}`;
            
            return { 
                id: form.id, title: form.title, description: form.description, image: coverImage, 
                lastOpenedDate: dateStr, status: form.status, clinic_type: form.clinic_type, form_type: form.form_type,
                publish_start_date: form.publish_start_date, publish_end_date: form.publish_end_date 
            };
        });
        formCache.set(cacheKey, formattedForms);
        res.json(formattedForms);
    } catch (err) {
        console.error("Error fetching forms:", err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลฟอร์ม" });
    }
});

// 3. ดึงจำนวนผู้ตอบฟอร์ม
router.get('/forms/:id/submission-count', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM form_responses WHERE form_id = ?", [req.params.id]);
        res.json({ count: rows[0].count });
    } catch (err) {
        res.status(500).json({ count: 0 });
    }
});

// 3.5 ✅ ดึงจำนวนผู้ตอบฟอร์มหลายรายการในครั้งเดียว (Batch API + 🟢 Caching)
router.post('/counts', async (req, res) => {
    try {
        const { formIds } = req.body;
        
        if (!Array.isArray(formIds) || formIds.length === 0) {
            return res.status(400).json({ error: 'Invalid formIds' });
        }

        const cacheKey = `counts_${formIds.sort().join('_')}`;
        
        if (formCache.has(cacheKey)) {
            return res.json({ data: formCache.get(cacheKey) });
        }

        const placeholders = formIds.map(() => '?').join(',');
        const query = `
            SELECT form_id, COUNT(*) as count 
            FROM form_responses 
            WHERE form_id IN (${placeholders}) 
            GROUP BY form_id
        `;

        const [rows] = await db.query(query, formIds);
        
        const countMap = {};
        rows.forEach(row => { countMap[row.form_id] = row.count; });
        formIds.forEach(formId => {
            if (!(formId in countMap)) countMap[formId] = 0;
        });

        formCache.set(cacheKey, countMap, 60);

        res.json({ data: countMap });
    } catch (err) {
        console.error('Error fetching counts:', err);
        res.status(500).json({ error: 'Failed to fetch counts' });
    }
});

// 4. ดึงข้อมูลฟอร์มตาม ID
router.get('/forms/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM forms WHERE id = ?", [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "ไม่พบข้อมูลฟอร์ม" });

        // Calculate option usage for quota limits
        const [usageRows] = await db.query("SELECT question_id, answer_value, COUNT(*) as count FROM form_answers WHERE form_id = ? GROUP BY question_id, answer_value", [req.params.id]);
        const optionUsage = {};
        usageRows.forEach(row => {
            if (!optionUsage[row.question_id]) optionUsage[row.question_id] = {};
            optionUsage[row.question_id][row.answer_value] = row.count;
        });

        const form = rows[0];
        form.optionUsage = optionUsage;

        res.json(form);
    } catch (err) {
        console.error("Error fetching form:", err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
});

// 5. อัปเดตข้อมูลฟอร์มทั้งหมด (🟢 เพิ่ม form_type)
router.put('/forms/:id', verifyToken, async (req, res) => {
  const formId = req.params.id;
  const { title, description, formStepName, theme, questions, status, clinic_type, form_type, publish_start_date, publish_end_date } = req.body;
  try {
    const query = `
      UPDATE forms SET title=?, description=?, step_name=?, theme=?, questions=?, status=?, clinic_type=?, form_type=?, publish_start_date=?, publish_end_date=? WHERE id=?
    `;
    const values = [
      title || 'แบบฟอร์มไม่มีชื่อ', description || '', formStepName || 'ส่วนที่ 1',
      JSON.stringify(theme || {}), JSON.stringify(questions || []), status || 'draft',
      clinic_type || 'general', form_type || 'Registration', publish_start_date || null, publish_end_date || null, formId
    ];
    await db.query(query, values);
    formCache.flushAll();
    res.json({ message: "Form updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update form" });
  }
});

// 6. ลบฟอร์ม
router.delete('/forms/:id', verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM forms WHERE id = ?", [req.params.id]);
        formCache.flushAll();
        res.json({ message: "ลบฟอร์มสำเร็จ!" });
    } catch (err) {
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการลบฟอร์ม" });
    }
});

// 7. เปลี่ยนชื่อฟอร์ม
router.patch('/forms/:id/rename', verifyToken, async (req, res) => {
    try {
        await db.query("UPDATE forms SET title = ? WHERE id = ?", [req.body.title, req.params.id]);
        res.json({ message: "เปลี่ยนชื่อฟอร์มสำเร็จ!" });
    } catch (err) {
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการเปลี่ยนชื่อฟอร์ม" });
    }
});

// 8. เปลี่ยนรูปปกฟอร์ม
router.patch('/forms/:id/image', verifyToken, async (req, res) => {
    try {
        const formId = req.params.id;
        const [rows] = await db.query("SELECT theme FROM forms WHERE id = ?", [formId]);
        if (rows.length === 0) return res.status(404).json({ message: "ไม่พบฟอร์ม" });
        let themeData = rows[0].theme ? (typeof rows[0].theme === 'string' ? JSON.parse(rows[0].theme) : rows[0].theme) : {};
        themeData.headerImage = req.body.image;
        await db.query("UPDATE forms SET theme = ? WHERE id = ?", [JSON.stringify(themeData), formId]);
        res.json({ success: true, message: "อัปเดตรูปปกสำเร็จ!" });
    } catch (err) {
        console.error("Error updating form image:", err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
});

// 9. อัปเดตสถานะของฟอร์ม
router.patch('/forms/:id/status', verifyToken, async (req, res) => {
  try {
    await db.query("UPDATE forms SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
    formCache.flushAll();
    res.json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (error) {
    res.status(500).json({ error: "ไม่สามารถอัปเดตสถานะได้" });
  }
});

// 10. รับคำตอบของฟอร์ม (🟢 ผูก MasterCase และระบบเข้ารหัส)
router.post('/forms/:id/submit', async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const formId = req.params.id;
        const { answers, questionTitles, identityValue, summaryData } = req.body;

        // 🔒 ตรวจสอบความถูกต้องของ input เบื้องต้น
        if (isNaN(Number(formId))) {
            connection.release();
            return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง' });
        }
        if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
            connection.release();
            return res.status(400).json({ message: 'กรุณาตอบแบบฟอร์มให้ครบถ้วน' });
        }
        if (summaryData !== undefined && summaryData !== null && typeof summaryData !== 'object') {
            connection.release();
            return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง' });
        }
        if (identityValue !== undefined && identityValue !== null && typeof identityValue !== 'string') {
            connection.release();
            return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง' });
        }

        // ดึงเลขบัตร
        let idFromAnswers = null;
        if (answers) {
          for (const key in answers) {
            const val = answers[key];
            if (typeof val === "string" && val.match(/\d{1}-\d{4}-\d{5}-\d{2}-\d{1}/)) {
              idFromAnswers = val.replace(/\D/g, '');
              break;
            }
          }
        }
        const cleanIdentity = (identityValue || idFromAnswers || '').replace(/\D/g, '');

        // เข้ารหัสเลขบัตร และ Hash
        const encIdentity = cleanIdentity ? encrypt(cleanIdentity) : null;
        const hashIdentity = cleanIdentity ? hmacHash(cleanIdentity) : null;

        // 🟢 1. ดึงประเภทของคลินิกและประเภทฟอร์ม
        const [formRows] = await connection.query("SELECT title, clinic_type, form_type FROM forms WHERE id = ?", [formId]);
        const clinicType = formRows[0]?.clinic_type || 'general';

        // 🟢 2. ตรวจสอบหา Master Case หรือสร้างใหม่
        let masterCaseId = null;
        if (hashIdentity) {
            const [existingCase] = await connection.query(
                "SELECT id FROM mastercases WHERE identity_hash = ? AND clinicType = ? AND status = 'Open' LIMIT 1", 
                [hashIdentity, clinicType] 
            );

            if (existingCase.length > 0) {
                masterCaseId = existingCase[0].id; 
            } else {
                const [newCase] = await connection.query(
                    "INSERT INTO mastercases (identityValue, identity_hash, clinicType, status, currentStage) VALUES (?, ?, ?, 'Open', 'Registered')",
                    [encIdentity, hashIdentity, clinicType]
                );
                masterCaseId = newCase.insertId;
            }
        }

        // โคลน summaryData เพื่อนำไปเข้ารหัส
        const dbSummary = JSON.parse(JSON.stringify(summaryData || {}));
        
        if (dbSummary.display_name && dbSummary.display_name !== '-') dbSummary.display_name = encrypt(dbSummary.display_name);
        if (dbSummary.display_phone && dbSummary.display_phone !== '-') dbSummary.display_phone = encrypt(dbSummary.display_phone);
        if (dbSummary.phone && dbSummary.phone !== '-') dbSummary.phone = encrypt(dbSummary.phone);
        
        if (dbSummary.raw_answers) {
            for (const key in dbSummary.raw_answers) {
                if (key.includes('ชื่อ') || key.includes('เบอร์') || key.includes('โทร') || key.includes('บัตร')) {
                    const val = dbSummary.raw_answers[key];
                    if (val && val !== '-') dbSummary.raw_answers[key] = encrypt(val);
                }
            }
        }

        // 🟢 3. Insert response พร้อมผูก master_case_id
        const [respResult] = await connection.query(
          "INSERT INTO form_responses (form_id, master_case_id, identity_value, identity_hash, summary_data) VALUES (?, ?, ?, ?, ?)",
          [formId, masterCaseId, encIdentity, hashIdentity, JSON.stringify(dbSummary)] 
        );
        const responseId = respResult.insertId;

        // บันทึกคำตอบรายข้อ
        for (const [qId, ansValue] of Object.entries(answers)) {
            const qTitle = questionTitles[qId] || 'Unknown Question';
            let valToSave = ansValue;

            if (qTitle.includes('ชื่อ') || qTitle.includes('เบอร์') || qTitle.includes('โทร') || qTitle.includes('บัตร')) {
                valToSave = encrypt(valToSave);
            }

            await connection.query(
                "INSERT INTO form_answers (response_id, form_id, question_id, question_title, answer_value) VALUES (?, ?, ?, ?, ?)",
                [responseId, formId, qId, qTitle, JSON.stringify(valToSave)]
            );
        }
        await connection.commit();


  try {
    const safe = summaryData || {};

    // 🟢 ดึง score
    const scoreResults = Array.isArray(safe.score_results)
        ? safe.score_results
        : Array.isArray(safe.scoreResults)
            ? safe.scoreResults
            : [];

    // 🟢 เช็คความเสี่ยง
const isHighRisk = scoreResults.some(s => {
    const colorClean = (s.color || '').toLowerCase().replace(/[^a-f0-9]/g, '');
    const label = (s.label || '').toLowerCase();
    return (
        colorClean.includes('d93025') ||
        colorClean.includes('e53935') ||
        colorClean.includes('f44336') ||
        label.includes('สูง') ||
        label.includes('รุนแรง')
    );
});

    // 🟢 helper
    const stripHtml = (str) => str ? String(str).replace(/<[^>]*>?/gm, '').trim() : '';

    // 🟢 สร้างข้อมูล
    const formTitle = stripHtml(formRows[0]?.title || '') || `ฟอร์ม #${formId}`;
    const caseId = `CASE-${String(responseId).padStart(4, '0')}`;
    const displayName = stripHtml(safe.display_name || '') || '-';

    const rawPhone = safe.display_phone || safe.phone || '-';
    const phoneStr = stripHtml(rawPhone);
    const cleanPhone = phoneStr.replace(/[^0-9+]/g, '');

    // 🟢 หัวข้อ
    const alertHeader = isHighRisk
        ? `🚨 <b>แจ้งเตือนเคสเสี่ยงสูง!</b>`
        : `✅ <b>แจ้งเตือนเคส</b>`;

    // 🟢 ข้อมูลเพิ่มเติม (สถานะ และ คลินิก)
    const clinicLabel = {
        'general': 'ทั่วไป',
        'teenager': 'คลินิกวัยรุ่น',
        'behavior': 'คลินิก LSM',
        'sti': 'คลินิกโรคติดต่อฯ'
    }[clinicType] || 'ทั่วไป';

    const isMediumRisk = !isHighRisk && scoreResults.some(s => {
        const colorClean = (s.color || '').toLowerCase().replace(/[^a-f0-9]/g, '');
        const label = (s.label || '').toLowerCase();
        return colorClean.includes('ff9800') || colorClean.includes('fbbc04') || label.includes('ปานกลาง');
    });

    const riskLabel = isHighRisk ? 'สูง' : (isMediumRisk ? 'ปานกลาง' : 'ปกติ/ต่ำ');

    // ✅ แก้จุดสำคัญ (กัน message พัง)
    let phoneLine = '';

    if (cleanPhone && cleanPhone.length >= 8) {
        phoneLine = `📞 <b>เบอร์ติดต่อ:</b> <a href="tel:${cleanPhone}">${phoneStr}</a>`;
    } else {
        phoneLine = `📞 <b>เบอร์ติดต่อ:</b> -`;
    }

    // 🟢 message components
    const riskLine = isHighRisk ? `` : `⚠️ <b>ความเสี่ยง:</b> ${riskLabel}`;
    
    // 🟢 ตรวจสอบสถานะ (ติดตามผล หรือ เคสใหม่)
    const dbFormType = String(formRows[0]?.form_type || '').trim().toLowerCase();
    const statusLine = (dbFormType === 'follow-up') ? `📌 <b>สถานะ:</b> ติดตามผล` : `📌 <b>สถานะ:</b> เคสใหม่`;
    
    const clinicLine = `🏥 <b>คลินิก:</b> ${clinicLabel}`;

    // 🟢 รวมร่าง message
    const message = [
        alertHeader,
        `📋 <b>แบบประเมิน:</b> ${formTitle}`,
        clinicLine,
        riskLine,
        statusLine,
        `🔗 <b>Case ID:</b> ${caseId}`,
        `👤 <b>ชื่อ:</b> ${displayName}`,
        phoneLine
    ].filter(line => line !== '').join('\n');

    // 🟢 URL แยกตามประเภทเคส
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const caseUrl = isHighRisk
        ? `${frontendBaseUrl}/admin/risk-cases`
        : `${frontendBaseUrl}/admin/cases`;

    const replyMarkup = {
        inline_keyboard: [[
            { text: "🌐 เปิดดูข้อมูลในระบบ", url: caseUrl }
        ]]
    };
    // ✅ ส่งจริง
    await sendTelegramAlert(message, replyMarkup);

    console.log(`✅ ส่ง Telegram แล้ว | ${caseId} | เสี่ยง: ${isHighRisk}`);

} catch (err) {
    console.error('[Telegram ERROR]:', err);
}

        res.status(201).json({ message: "บันทึกคำตอบสำเร็จ", responseId, masterCaseId });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกคำตอบ" });
    } finally {
        connection.release();
    }
});

// 11. ดึงคำตอบทั้งหมด (Dashboard ฝั่งแอดมิน - 🟢 ถอดรหัส & เพิ่ม Pagination)
router.get('/forms/:id/responses', verifyToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        const [rows] = await db.query(
            "SELECT * FROM form_responses WHERE form_id = ? ORDER BY submitted_at DESC LIMIT ? OFFSET ?", 
            [req.params.id, limit, offset]
        );
        
        const decryptedRows = await Promise.all(rows.map(async (r) => {
            if (r.identity_value) r.identity_value = safeDecrypt(r.identity_value);
            
            if (r.summary_data) {
                let summary = typeof r.summary_data === 'string' ? JSON.parse(r.summary_data) : r.summary_data;
                
                if (summary.display_name) summary.display_name = safeDecrypt(summary.display_name);
                if (summary.display_phone) summary.display_phone = safeDecrypt(summary.display_phone);
                if (summary.phone) summary.phone = safeDecrypt(summary.phone);
                if (summary.citizenId) summary.citizenId = safeDecrypt(summary.citizenId);
                if (summary.idCard) summary.idCard = safeDecrypt(summary.idCard);
                if (summary.name) summary.name = safeDecrypt(summary.name);
                
                if (summary.raw_answers) {
                    for (const key in summary.raw_answers) {
                        if (key.includes('ชื่อ') || key.includes('เบอร์') || key.includes('โทร') || key.includes('บัตร')) {
                            summary.raw_answers[key] = safeDecrypt(summary.raw_answers[key]);
                        }
                    }
                }
                r.summary_data = summary;
            }
            return r;
        }));

        res.json(decryptedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลคำตอบ" });
    }
});

// 12. โหลดคำถามของ form
router.get('/forms/:id/questions', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT questions FROM forms WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Form not found" });
    const questions = typeof rows[0].questions === "string" ? JSON.parse(rows[0].questions) : rows[0].questions;
    // คืนค่า questions ทั้งหมดเพื่อให้ frontend นำไปใช้จัดการได้ครบถ้วน (เช่น scoringRules)
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 13. อัปเดตประเภทคลินิก
router.patch('/forms/:id/clinic', verifyToken, async (req, res) => {
  try {
    await db.query('UPDATE forms SET clinic_type = ? WHERE id = ?', [req.body.clinic_type, req.params.id]);
    formCache.flushAll();
    res.json({ message: 'Clinic updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update clinic' });
  }
});

// 🟢 API สำหรับคัดลอกฟอร์ม (Duplicate)
router.post('/forms/:id/duplicate', verifyToken, async (req, res) => {
    try {
        const formId = req.params.id;

        const [rows] = await db.query('SELECT * FROM forms WHERE id = ?', [formId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "ไม่พบฟอร์มที่ต้องการทำสำเนา" });
        }

        const originalForm = rows[0];
        const newTitle = `(สำเนา) ${originalForm.title}`;

        // 🟢 ตรวจสอบข้อมูลก่อนบันทึก (กันข้อมูลเพี้ยนจากการที่ MySQL Driver คืนค่าเป็น Object/String ต่างกัน)
        const themeData = typeof originalForm.theme === 'object' ? JSON.stringify(originalForm.theme) : originalForm.theme;
        const questionsData = typeof originalForm.questions === 'object' ? JSON.stringify(originalForm.questions) : originalForm.questions;

        const [result] = await db.query(
            `INSERT INTO forms (title, description, step_name, theme, questions, image, status, clinic_type, form_type, publish_start_date, publish_end_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newTitle,
                originalForm.description || '',
                originalForm.step_name || 'ส่วนที่ 1', 
                themeData,           
                questionsData,       
                originalForm.image || null,     
                'draft',             
                originalForm.clinic_type || 'general',
                originalForm.form_type || 'Registration',
                originalForm.publish_start_date || null,
                originalForm.publish_end_date || null
            ]
        );

        // 🟢 ล้าง Cache ทั้งหมดเพื่อให้ฟอร์มใหม่แสดงขึ้นมาทันที
        formCache.flushAll();

        res.status(201).json({ 
            message: "ทำสำเนาฟอร์มสำเร็จ", 
            newFormId: result.insertId 
        });

    } catch (err) {
        console.error("Error duplicating form:", err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
});

// รับข้อมูลจาก Popup ประเมินความพึงพอใจของระบบ
router.post('/submit-system-feedback', async (req, res) => {
    const d = req.body;
    try {
        const query = `
            INSERT INTO system_satisfaction_evaluations 
            (sat_ui, sat_speed, sat_content, sat_access, sat_overall, 
             sus1, sus2, sus3, sus4, sus5, sus6, sus7, sus8, sus9, sus10, 
             sus_total_score, suggestions) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            d.sat_ui, d.sat_speed, d.sat_content, d.sat_access, d.sat_overall,
            d.sus1, d.sus2, d.sus3, d.sus4, d.sus5, d.sus6, d.sus7, d.sus8, d.sus9, d.sus10,
            d.sus_total_score, d.suggestions
        ];
        
        await db.query(query, values);
        res.status(201).json({ message: "บันทึกการประเมินสำเร็จ" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
});

router.get('/evaluations/stats', verifyToken, async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                COUNT(id) as total_votes,
                AVG(sat_ui) as avg_ui,
                AVG(sat_speed) as avg_speed,
                AVG(sat_content) as avg_content,
                AVG(sat_access) as avg_access,
                AVG(sat_overall) as avg_overall,
                AVG(sus_total_score) as avg_sus,
                AVG(sus1) as avg_sus1, AVG(sus2) as avg_sus2, AVG(sus3) as avg_sus3, 
                AVG(sus4) as avg_sus4, AVG(sus5) as avg_sus5, AVG(sus6) as avg_sus6, 
                AVG(sus7) as avg_sus7, AVG(sus8) as avg_sus8, AVG(sus9) as avg_sus9, AVG(sus10) as avg_sus10
            FROM system_satisfaction_evaluations
        `);

        const [comments] = await db.query(`
            SELECT suggestions, created_at 
            FROM system_satisfaction_evaluations 
            WHERE suggestions IS NOT NULL AND TRIM(suggestions) != ''
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        res.json({
            ...stats[0],
            recent_comments: comments
        });
    } catch (err) {
        console.error("Fetch Eval Stats Error:", err);
        res.status(500).json({ error: "Failed to fetch evaluation stats" });
    }
});

router.get('/evaluations/list', verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const [totalRows] = await db.query(`SELECT COUNT(*) as count FROM system_satisfaction_evaluations`);
        const total = totalRows[0].count;

        const [rows] = await db.query(`
            SELECT 
                id, sat_ui, sat_speed, sat_content, sat_access, sat_overall, 
                sus_total_score, suggestions, created_at
            FROM system_satisfaction_evaluations
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({
            data: rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error("Fetch Eval List Error:", err);
        res.status(500).json({ error: "Failed to fetch evaluation list" });
    }
});

module.exports = router;