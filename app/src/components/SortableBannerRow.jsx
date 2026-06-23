import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { FaEdit, FaTrash, FaGripVertical } from "react-icons/fa";

export default function SortableBannerRow({ banner, onDelete, onEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: banner.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: "relative",
    backgroundColor: isDragging ? "#fffaf7" : "white",
    opacity: isDragging ? 0.8 : 1,
    cursor: isDragging ? "grabbing" : "default",
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {/* 1. คอลัมน์ภาพ - ใช้คลาสเดิมเพื่อให้รองรับ CSS ตารางหลัก */}
      <td className="image-cell">
        <span
          className="drag-handle"
          {...attributes}
          {...listeners}
          title="ลากเพื่อเรียงลำดับ"
        >
          <FaGripVertical />
        </span>

        <img src={banner.image} alt="banner" className="banner-thumb" />
      </td>

      <td className="file-cell">{banner.filename}</td>

      <td className="bn-action-cell">
        <button className="bn-edit-btn" onClick={onEdit} title="แก้ไข">
          <FaEdit />
        </button>

        <button
          className="bn-delete-btn"
          onClick={() => onDelete(banner.id)}
          title="ลบ"
        >
          <FaTrash />
        </button>
      </td>
    </tr>
  );
}
