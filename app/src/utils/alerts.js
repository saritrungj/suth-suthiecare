import Swal from "sweetalert2";

const brandConfirmColor = "#f47932";
const cancelColor = "#64748b";

export const getErrorMessage = (error, fallback = "กรุณาลองใหม่อีกครั้ง") =>
  error?.response?.data?.message || error?.message || fallback;

export const showSuccessAlert = ({
  title = "บันทึกเรียบร้อยแล้ว",
  text,
  timer = 1600,
} = {}) =>
  Swal.fire({
    icon: "success",
    title,
    text,
    timer,
    timerProgressBar: true,
    showConfirmButton: false,
  });

export const showSuccessToast = (title) =>
  Swal.fire({
    icon: "success",
    title,
    toast: true,
    position: "top-end",
    timer: 1800,
    timerProgressBar: true,
    showConfirmButton: false,
  });

export const showErrorAlert = ({
  error,
  title = "ดำเนินการไม่สำเร็จ",
  text,
  fallback,
} = {}) =>
  Swal.fire({
    icon: "error",
    title,
    text: text || getErrorMessage(error, fallback),
    confirmButtonText: "ตกลง",
    confirmButtonColor: brandConfirmColor,
  });

export const showInfoAlert = ({ title, text }) =>
  Swal.fire({
    icon: "info",
    title,
    text,
    confirmButtonText: "ตกลง",
    confirmButtonColor: brandConfirmColor,
  });

export const confirmAlert = async ({
  title,
  text,
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  danger = false,
} = {}) => {
  const result = await Swal.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: danger,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? "#dc2626" : brandConfirmColor,
    cancelButtonColor,
  });
  return result.isConfirmed;
};
