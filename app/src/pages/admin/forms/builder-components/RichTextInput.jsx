import React, { useState, useRef, useEffect } from "react";
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaListOl,
  FaListUl,
  FaEraser,
} from "react-icons/fa";

const RichTextInput = ({
  value,
  onChange,
  placeholder,
  className,
  tagName = "div",
  showLists = false,
  style,
}) => {
  const elementRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (elementRef.current && elementRef.current.innerHTML !== value) {
      elementRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = (e) => onChange(e.currentTarget.innerHTML);

  // 🟢 เพิ่มตัวล้างขยะดักไว้ตรงนี้ ทำงานทันทีที่คลิกเมาส์ออกจากช่องพิมพ์ (Blur)
  const handleBlur = (e) => {
    let val = e.currentTarget.innerHTML;
    // ลบ <span> และ <font> ที่ Extension ชอบแอบใส่มา (ทะลุทุกการเว้นบรรทัด)
    val = val.replace(/<span[\s\S]*?>/gi, "").replace(/<\/span>/gi, "");
    val = val.replace(/<font[\s\S]*?>/gi, "").replace(/<\/font>/gi, "");

    onChange(val);
    setIsFocused(false);
  };

  const handleFormat = (e, command) => {
    e.preventDefault();
    document.execCommand(command, false, null);
    if (elementRef.current) onChange(elementRef.current.innerHTML);
  };

  const Tag = tagName;
  return (
    <div className={`sfb-rich-text-wrapper ${isFocused ? "sfb-focused" : ""}`}>
      <Tag
        ref={elementRef}
        contentEditable
        className={`sfb-rich-text-input ${className}`}
        style={style}
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur} // 🟢 เปลี่ยนมาเรียกใช้ handleBlur
        placeholder={placeholder}
        suppressContentEditableWarning={true}
      />
      {isFocused && (
        <div className="sfb-inline-format-toolbar">
          <button onMouseDown={(e) => handleFormat(e, "bold")} title="ตัวหนา">
            <FaBold />
          </button>
          <button
            onMouseDown={(e) => handleFormat(e, "italic")}
            title="ตัวเอียง"
          >
            <FaItalic />
          </button>
          <button
            onMouseDown={(e) => handleFormat(e, "underline")}
            title="ขีดเส้นใต้"
          >
            <FaUnderline />
          </button>
          {showLists && (
            <>
              <div className="sfb-toolbar-divider"></div>
              <button
                onMouseDown={(e) => handleFormat(e, "insertOrderedList")}
                title="รายการแบบตัวเลข"
              >
                <FaListOl />
              </button>
              <button
                onMouseDown={(e) => handleFormat(e, "insertUnorderedList")}
                title="รายการแบบจุด"
              >
                <FaListUl />
              </button>
            </>
          )}
          <div className="sfb-toolbar-divider"></div>
          <button
            onMouseDown={(e) => handleFormat(e, "removeFormat")}
            title="ล้างรูปแบบ"
          >
            <FaEraser />
          </button>
        </div>
      )}
    </div>
  );
};

export default RichTextInput;
