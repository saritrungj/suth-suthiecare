import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addAgencyMember,
  createAgency,
  createAgencyMaster,
  getAgencyMastersAdmin,
  getUsers,
  getRoles,
  getRolePermissions,
} from "../../services/api";
import { usePermissions } from "../../permissions/PermissionsProvider";
import "./AgencyEntry.css";

export default function AgencyManagement() {
  const { authorization, activeAgency, setActiveAgency, refreshAuthorization } =
    usePermissions();
  const [masters, setMasters] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const company = authorization?.agencies?.find(
    (item) => String(item.id) === String(activeAgency),
  );
  useEffect(() => {
    let active = true;
    if (activeAgency)
      getAgencyMastersAdmin(activeAgency)
        .then(({ data }) => {
          if (active) setMasters(data || []);
        })
        .catch(() => {
          if (active) setMessage("โหลดแบบฟอร์มไม่สำเร็จ");
        });
    getUsers()
      .then(({ data }) => {
        if (active) setUsers(data || []);
      })
      .catch(() => {
        if (active) setMessage("โหลดรายชื่อบัญชีเจ้าหน้าที่ไม่สำเร็จ");
      });
    getRoles()
      .then(async ({ data }) => {
        const items = await Promise.all(
          data.map(async (role) => ({
            ...role,
            permissions: (await getRolePermissions(role.id)).data,
          })),
        );
        if (active)
          setRoles(
            items.filter(
              (role) =>
                role.permissions.length &&
                role.permissions.every((key) =>
                  [
                    "agency_entries.create",
                    "agency_entries.view",
                    "agency_entries.verify",
                  ].includes(key),
                ),
            ),
          );
      })
      .catch(() => {
        if (active) setMessage("โหลดบทบาท Agency ไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, [activeAgency]);

  const submitAgency = async (event) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setSaving(true);
    try {
      const { data } = await createAgency({ name: form.get("name") });
      element.reset();
      setActiveAgency(data.id);
      refreshAuthorization();
      setMessage(`สร้างบริษัทแล้ว · รหัส ${data.code}`);
    } catch (error) {
      setMessage(error.response?.data?.message || "สร้างบริษัทไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const submitCheckup = async (event) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setSaving(true);
    try {
      await createAgencyMaster(activeAgency, {
        name: form.get("name"),
        form_type: "health_checkup",
      });
      element.reset();
      setMasters((await getAgencyMastersAdmin(activeAgency)).data || []);
      setMessage(
        "สร้างแบบฟอร์มตรวจสุขภาพแล้ว เปิดเมนูบันทึกข้อมูลเพื่อนำเข้ารายชื่อได้เลย",
      );
    } catch (error) {
      setMessage(error.response?.data?.message || "สร้างแบบฟอร์มไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const submitMember = async (event) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setSaving(true);
    try {
      await addAgencyMember(activeAgency, {
        user_id: Number(form.get("user_id")),
      });
      setSelectedUser("");
      element.reset();
      setMessage(
        "เพิ่มเจ้าหน้าที่บริษัทแล้ว สามารถเข้าสู่ระบบด้วยบัญชีนี้เพื่อนำเข้ารายชื่อได้",
      );
    } catch (error) {
      setMessage(error.response?.data?.message || "เพิ่มเจ้าหน้าที่ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="agency-page">
      <header className="agency-page-header">
        <div>
          <h1>จัดการบริษัทและแบบฟอร์มตรวจสุขภาพ</h1>
          <p>
            แอดมินสร้างบริษัทและรอบตรวจสุขภาพ
            จากนั้นนำเข้ารายชื่อเองหรือมอบสิทธิ์ให้เจ้าหน้าที่บริษัท
          </p>
        </div>
      </header>
      {message && (
        <p className="agency-notice" role="status">
          {message}
        </p>
      )}
      <section className="agency-workspace agency-management">
        <div className="agency-form">
          <div className="agency-form-heading">
            <h2>สร้าง Agency / บริษัท</h2>
            <p>ระบบสร้างรหัสบริษัทให้อัตโนมัติ</p>
          </div>
          <form className="agency-form-grid" onSubmit={submitAgency}>
            <label className="agency-field-wide">
              ชื่อบริษัท
              <input name="name" required maxLength={255} />
            </label>
            <div className="agency-field-wide agency-form-actions">
              <button disabled={saving}>สร้างบริษัท</button>
            </div>
          </form>
        </div>
        {company ? (
          <>
            <div className="agency-toolbar">
              <strong>บริษัทที่กำลังจัดการ: {company.name}</strong>
              <span>{company.code}</span>
            </div>
            <div className="agency-form">
              <div className="agency-form-heading">
                <h2>แบบฟอร์มของบริษัท</h2>
                <p>เลือกบริษัทอื่นได้จากพื้นที่ทำงานใน Sidebar</p>
              </div>
              {masters.length ? (
                <ul>
                  {masters.map((item) => (
                    <li key={item.id}>
                      {item.name} · {item.code}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  ยังไม่มีรอบตรวจสุขภาพ
                  สร้างแบบฟอร์มด้านล่างเพื่อเริ่มนำเข้ารายชื่อ
                </p>
              )}
              <form className="agency-form-grid" onSubmit={submitCheckup}>
                <label>
                  ประเภทแบบฟอร์ม
                  <input value="ตรวจสุขภาพ (Check up)" readOnly />
                </label>
                <label>
                  ชื่อแบบฟอร์ม / รอบตรวจ
                  <input
                    name="name"
                    placeholder="เช่น ตรวจสุขภาพประจำปี 2569"
                    required
                    maxLength={255}
                  />
                </label>
                <p className="agency-field-wide">
                  มีช่องชื่อ นามสกุล รหัสพนักงาน แผนก เบอร์โทรศัพท์
                  และวันที่ตรวจ พร้อม Template สำหรับนำเข้ารายชื่อ
                </p>
                <div className="agency-field-wide agency-form-actions">
                  <button disabled={saving}>สร้างแบบฟอร์มตรวจสุขภาพ</button>
                </div>
              </form>
              {masters.length > 0 && (
                <p>
                  <Link to="/admin/agency-checkup-forms">
                    จัดการฟิลด์ของแบบฟอร์ม Check up →
                  </Link>
                  <br />
                  <Link to="/admin/agency-entry">
                    ไปบันทึกหรือนำเข้ารายชื่อผู้ตรวจสุขภาพ →
                  </Link>
                </p>
              )}
            </div>
            <div className="agency-form">
              <div className="agency-form-heading">
                <h2>ให้เจ้าหน้าที่บริษัทนำเข้ารายชื่อเอง</h2>
                <p>
                  เลือกบัญชีเจ้าหน้าที่ที่สร้างไว้แล้ว
                  เจ้าหน้าที่จะเห็นเฉพาะบริษัทที่ได้รับสิทธิ์
                  หากแอดมินนำเข้าเองไม่จำเป็นต้องเพิ่มเจ้าหน้าที่
                </p>
              </div>
              <form className="agency-form-grid" onSubmit={submitMember}>
                <label>
                  บัญชีเจ้าหน้าที่
                  <select
                    name="user_id"
                    required
                    value={selectedUser}
                    onChange={(event) => setSelectedUser(event.target.value)}
                  >
                    <option value="">เลือกบัญชีที่มีบทบาท Agency</option>
                    {users
                      .filter(
                        (user) =>
                          user.status === "active" &&
                          Number(user.role_id) !== 1 &&
                          roles.some(
                            (role) => Number(role.id) === Number(user.role_id),
                          ) &&
                          !(user.memberships || []).some(
                            (membership) => membership.status === "active",
                          ),
                      )
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  บทบาทและสิทธิ์ที่ได้รับ
                  <input
                    readOnly
                    value={
                      roles.find(
                        (role) =>
                          Number(role.id) ===
                          Number(
                            users.find(
                              (user) => String(user.id) === selectedUser,
                            )?.role_id,
                          ),
                      )?.name || "เลือกบัญชีเพื่อดูบทบาท"
                    }
                  />
                </label>
                <p className="agency-field-wide">
                  สิทธิ์บันทึก ดู และตรวจสอบข้อมูล อ้างอิงจาก{" "}
                  <Link to="/admin/roles">หน้าบทบาทและสิทธิ์</Link> เท่านั้น
                  บทบาทของบัญชีต้องมีเฉพาะสิทธิ์ Agency
                </p>
                <div className="agency-field-wide agency-form-actions">
                  <button disabled={saving}>เพิ่มเจ้าหน้าที่บริษัท</button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="agency-empty">
            <strong>เริ่มจากสร้างบริษัท</strong>
            <span>จากนั้นสร้างแบบฟอร์มตรวจสุขภาพและนำเข้ารายชื่อพนักงาน</span>
          </div>
        )}
      </section>
    </main>
  );
}
