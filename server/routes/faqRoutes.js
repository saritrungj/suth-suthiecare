const express = require('express');
const router = express.Router();
const db = require('../config/db'); 

// ==========================================
// SECTION 1: จัดการหมวดหมู่คำถาม (FAQ Categories)
// ==========================================

// 1. POST: สร้างหมวดหมู่คำถามย่อยใหม่ 
router.post('/categories', async (req, res) => {
    const { clinic_id, category_name, display_order, status } = req.body;
    try {
        const query = `INSERT INTO faq_categories (clinic_id, category_name, display_order, status) VALUES (?, ?, ?, ?)`;
        await db.query(query, [clinic_id, category_name, display_order || 0, status || 'published']);
        res.json({ success: true, message: 'สร้างหมวดหมู่คำถามสำเร็จ' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. GET: ดึงหมวดหมู่ย่อยทั้งหมดของคลินิกนั้นๆ
router.get('/categories/:clinic_id', async (req, res) => {
    const { clinic_id } = req.params;
    try {
        const query = `SELECT * FROM faq_categories WHERE clinic_id = ? ORDER BY display_order ASC`;
        const [rows] = await db.query(query, [clinic_id]);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. PATCH: สำหรับอัปเดตชื่อหมวดหมู่ย่อย 
router.patch('/categories/:id', async (req, res) => {
    const { id } = req.params;
    const { category_name, display_order, status } = req.body; 
    try {
        const query = `UPDATE faq_categories SET category_name = ?, display_order = ?, status = ? WHERE id = ?`;
        await db.query(query, [category_name, display_order || 0, status || 'published', id]); 
        res.json({ 
            success: true, 
            message: 'อัปเดตข้อมูลหมวดหมู่ย่อยเรียบร้อยแล้ว' 
        });
    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ 
            success: false, 
            message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์: ' + error.message 
        });
    }
});

// 4. DELETE: สำหรับลบหมวดหมู่ย่อยออกจากระบบ
router.delete('/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `DELETE FROM faq_categories WHERE id = ?`;
        await db.query(query, [id]);
        res.json({ success: true, message: 'ลบหมวดหมู่ย่อยสำเร็จ' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'ไม่สามารถลบหมวดหมู่ย่อยนี้ได้เนื่องจากมีคำถามใช้งานอยู่' });
    }
});


// ==========================================
// SECTION 2: จัดการข้อคำถามและคำตอบ (FAQ Contents)
// ==========================================

// 5. GET: ดึงข้อคำถามทั้งหมดโชว์บนตาราง Admin 
router.get('/faqs', async (req, res) => {
    try {
        const { clinic_id, status, search } = req.query;
        
        let query = `
            SELECT 
                f.id AS faq_id,
                f.question,
                f.answer,
                f.is_homepage,
                f.status,
                f.display_order,
                f.updated_at,
                f.clinic_id,
                f.category_id,
                cat.category_name,
                c.name AS clinic_name
            FROM faqs f
            LEFT JOIN faq_categories cat ON f.category_id = cat.id
            LEFT JOIN clinics c ON f.clinic_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (clinic_id) { 
            query += ` AND f.clinic_id = ?`; 
            params.push(clinic_id); 
        }
        if (status) { 
            query += ` AND f.status = ?`; 
            params.push(status); 
        }
        if (search) { 
            query += ` AND f.question LIKE ?`; 
            params.push(`%${search}%`); 
        }

        query += ` ORDER BY COALESCE(f.clinic_id, 0) ASC, f.display_order ASC`;
        
        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6. POST: เพิ่มข้อคำถามใหม่
router.post('/faqs', async (req, res) => {
    const { category_id, clinic_id, question, answer, is_homepage, status, display_order } = req.body;
    
    try {
        const finalCategoryId = parseInt(category_id) || null;
        const finalClinicId = parseInt(clinic_id) || null;
        const finalQuestion = question ? question.trim() : '';
        const finalAnswer = answer ? answer.trim() : ''; 
        const finalIsHomepage = (is_homepage === 1 || is_homepage === true) ? 1 : 0;
        const finalStatus = status || 'published';
        const finalDisplayOrder = parseInt(display_order) || 0;

        const query = `
            INSERT INTO faqs (category_id, clinic_id, question, answer, is_homepage, status, display_order) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await db.query(query, [
            finalCategoryId, 
            finalClinicId, 
            finalQuestion, 
            finalAnswer, 
            finalIsHomepage, 
            finalStatus, 
            finalDisplayOrder
        ]);

        res.json({ success: true, message: 'บันทึกข้อคำถามสำเร็จ', insertId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดฝั่งฐานข้อมูลหลังบ้าน: ' + error.message });
    }
});

// 7. PUT: แก้ไขข้อมูลข้อคำถาม (🟢 ลบตัวสัญลักษณ์คอมมาค้างจุดที่ทำให้ระบบดับเรียบร้อยค่ะ)
router.put('/faqs/:id', async (req, res) => {
    const { id } = req.params;
    const { category_id, clinic_id, question, answer, is_homepage, status, display_order } = req.body;
    try {
        const finalCategoryId = parseInt(category_id) || null;
        const finalClinicId = parseInt(clinic_id) || null;

        const query = `
            UPDATE faqs 
            SET category_id = ?, clinic_id = ?, question = ?, answer = ?, is_homepage = ?, status = ?, display_order = ? 
            WHERE id = ?
        `;
        await db.query(query, [
            finalCategoryId, 
            finalClinicId,
            question, 
            answer, 
            is_homepage ? 1 : 0, 
            status, 
            display_order, 
            id
        ]);
        res.json({ success: true, message: 'อัปเดตข้อมูลข้อคำถามสำเร็จ' });
    } catch (error) {
        console.error("Error in PUT /faqs:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8. DELETE: ลบข้อคำถามออกจากระบบ
router.delete('/faqs/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `DELETE FROM faqs WHERE id = ?`;
        await db.query(query, [id]);
        res.json({ success: true, message: 'ลบข้อคำถามออกจากระบบแล้ว' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;