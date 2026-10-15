# Shared UI ของ Suthie Care

ชุดกลาง: `app/src/components/ui/index.jsx` · รูปลักษณ์: `app/src/styles/component-system.css` · ค่าร่วม: `app/src/styles/tokens.css`

สีแบรนด์ที่เลือกคือ #FE6E35 ส่วนปุ่มทึบใช้น้ำหนักเข้ม #C45428 เพื่อให้ข้อความขาวมี contrast มากกว่า 4.5:1

## กติกาของทุกหน้าจัดการ

- Sarabun; หัวหน้า 24px; เนื้อหาและ control 0.95rem; คำกำกับ 0.875rem
- ปุ่มและช่องกรอกสูงอย่างน้อย 44px; มุม 10px; พื้นที่ทำงานมุม 14px
- ระยะร่วม 4/8/12/16/20/24/32px จาก tokens
- หัวหน้าไม่มีพื้นการ์ดหรือแถบสีด้านข้าง; ชื่อและคำอธิบายเริ่มต้นที่แนวเดียวกับข้อมูล
- พื้นขาวบน canvas อมอุ่น; การ์ดใช้เส้นขอบบางแทนเงาหนัก
- สีหลักแสดงการกระทำและสิ่งที่เลือก สีความเสี่ยงและสถานะยังใช้ความหมายเดิมพร้อมข้อความกำกับ
- โทรศัพท์ต้องกดและกรอกได้ครบ; ตารางกว้างใช้ scroll region หรือรูปแบบรายการของหน้าที่มีอยู่

## Components

| Component | ใช้กับ | Props สำคัญ |
| --- | --- | --- |
| Button | ปุ่มคำสั่ง | variant: primary / secondary / ghost / danger; size: default / icon; busy; native button props |
| PageHeader | ชื่อหน้าและคำสั่งหลัก | title, description, actions; children สำหรับหัวหน้าที่มี scope หรือ mode switch เฉพาะ |
| FilterBar | รวมการค้นหาและตัวกรอง | children; className สำหรับการจัดขนาดช่องของงานนั้น |
| TextInput / TextArea | ช่องกรอก | native props, ref, required, aria-invalid, aria-describedby |
| DataTable | ตาราง | children, native table props; คง sort, columns และ mobile presentation ของงานเดิม |
| Surface | พื้นที่ทำงาน | as (section/div/aside/article), children, aria-label หรือ aria-labelledby |
| SelectionGroup | กลุ่มแท็บ/มุมมอง | as, children; ใช้ native links/buttons และ aria-current / aria-pressed / aria-selected ตามพฤติกรรมเดิม |
| Badge | สถานะทั่วไป | tone หรือ class สถานะเดิม; ใช้ RiskPill เดิมสำหรับความเสี่ยงทางสุขภาพ |
| EmptyState / EmptyRow | ไม่มีข้อมูล | title, hint, icon; EmptyRow รับจำนวน columns |
| LoadingRows | ตารางกำลังโหลด | columns, rows |
| Dialog | หน้าต่างที่ต้องโฟกัสงาน | title, subtitle, onClose, footer, size; เปิด/ปิดด้วยการ mount/unmount |
| DialogFrame | โครงสำหรับหน้าต่างเฉพาะงานเดิม | as, onClose, dismissible, className, aria-label/aria-labelledby; ใช้ portal และ focus stack เดียวกับ Dialog |

Dialog ใช้ `useDialogFocus` ตัวเดิม: โฟกัสช่องแรก, Tab อยู่ในหน้าต่าง, Escape ปิดหน้าต่างบนสุด และคืนโฟกัสให้ปุ่มเปิด หน้าจอเป็นผู้ตัดสินใจว่าจะอนุญาตปิดระหว่างบันทึกหรือไม่

Dialog ประกอบจาก DialogFrame โดยตรง จึงใช้พฤติกรรมเดียวกันกับหน้าต่างผู้ใช้ แบนเนอร์ เคส กราฟ และการส่งออก เมื่อปุ่มเปิดเป็นรายการเมนูที่ถูกถอดออกจาก DOM จะคืนโฟกัสเข้าหน้าต่างแม่ที่ยังเปิดอยู่ ตั้ง `dismissible={false}` ระหว่างบันทึก และปิดการใช้งานปุ่มยกเลิก/ปุ่มปิดของงานนั้นด้วย

ใช้ `interaction-system.css` สำหรับสถานะ focus, active, disabled, ขนาดช่องกรอกในหน้าต่าง และสี confirmation ดู [กติกาสีและการโต้ตอบ](interface-consistency.md) สำหรับขอบเขต CSS และการทดสอบข้ามหน้า

## ตัวอย่าง

```jsx
import { Button, PageHeader, FilterBar, TextInput, Surface, DataTable } from '../../components/ui';

<PageHeader title="รายการข้อมูล" description="จัดการข้อมูลของหน่วยงานที่เลือก"
  actions={<Button variant="primary" onClick={openEditor}>เพิ่มข้อมูล</Button>} />
<FilterBar>
  <label>ค้นหา<TextInput type="search" value={query} onChange={onSearch} /></label>
</FilterBar>
<Surface aria-label="รายการข้อมูล">
  <DataTable>{/* thead / tbody ของงานนั้น */}</DataTable>
</Surface>
```

ระบุ `type="submit"` ให้ปุ่มส่งฟอร์ม และ `type="button"` ให้ปุ่มคำสั่งอื่น ปุ่มที่ย้ายจาก native button ครั้งนี้รักษาพฤติกรรม submit เดิมไว้

## การย้ายหน้าที่มีอยู่

ย้ายการใช้ซ้ำในหน้าจัดการและส่วนประกอบของเคส/นัดหมายเข้าสู่ primitives โดยเก็บ legacy class ที่ยังใช้จัด layout และอ้างใน integration tests ตัด declarations ด้านรูปลักษณ์ที่ซ้ำใน CSS รายหน้าออก และให้ font-family ของส่วน admin อ้าง token เดียวกัน

`schoolUi` ยังส่งออกชื่อ PageHeader, SchoolModal, EmptyRow และ LoadingRows เดิมเพื่อรักษาการเรียกใช้ แต่ใช้ implementation กลาง

ส่วนเฉพาะงาน เช่น risk pill, step rail ของเคส, ตารางคำตอบ, เครื่องมือสร้างแบบฟอร์ม และปฏิทิน ใช้พฤติกรรมเดิม ไม่บังคับให้มีโครงสร้างเหมือนตารางจัดการทั่วไป หน้าแบบประเมินสาธารณะที่เจ้าของกำหนด theme เองยังใช้ theme นั้น

## การตรวจ

การจัดหน้าและ responsive ใช้กติกาจาก `app/src/styles/layout-system.css` ร่วมกัน ดู [แนวทางจัดหน้าและขนาดหน้าจอ](responsive-layout.md) ก่อนเพิ่มความสูงตาม viewport, ระยะขอบ หรือ breakpoint เฉพาะหน้า

- Build และชุด unit tests เดิม
- `e2e/component-system.spec.js`: ตรวจหน้าจัดการจริงบน desktop/mobile, ขนาดปุ่ม หัวข้อ ฟอนต์ สี และ horizontal overflow พร้อมรายงาน accessibility
- ชุด admin-workspace และ school-management ตรวจการแก้ไขข้อมูล สิทธิ์ การนำเข้า และการใช้งานบนมือถือ
- ภาพและผลตรวจอยู่ใน `outputs/component-unification/`
