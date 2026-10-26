import SearchableSelect from "../../../../components/SearchableSelect";
import { resultImageChoice } from "../../../../utils/resultImageLevel";
import {
  RESULT_LEVEL_TITLES,
  useResultImageLibrary,
} from "../../resultImages/useResultImageLibrary";

// Picture a scoring range shows on the result page. "Automatic" keeps the
// colour-based level picture; the organization manages the pictures on
// the "ภาพผลลัพธ์การประเมิน" page.
export default function RuleImagePicker({ value, color, onChange }) {
  const { assets, levelImage } = useResultImageLibrary();
  const choice = resultImageChoice(value, color);
  const asset = choice.assetId
    ? assets.find((item) => String(item.id) === choice.assetId)
    : null;
  const preview = asset?.image || levelImage(choice.level);
  // A removed library picture shows as automatic until another is chosen.
  const selected = choice.assetId && !asset ? "" : value || "";

  return (
    <label className="sfb-rule-image">
      <img className="sfb-rule-image__thumb" src={preview} alt="" />
      <span className="sfb-scoring-rule-label">ภาพผลลัพธ์</span>
      <SearchableSelect
        className="sfb-rule-image__select"
        aria-label="ภาพผลลัพธ์ของช่วงคะแนนนี้"
        value={selected}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          อัตโนมัติตามสี (
          {RESULT_LEVEL_TITLES[resultImageChoice("", color).level]})
        </option>
        <optgroup label="ภาพตามระดับ">
          {Object.entries(RESULT_LEVEL_TITLES).map(([level, title]) => (
            <option key={level} value={`level:${level}`}>
              {title}
            </option>
          ))}
        </optgroup>
        {assets.length > 0 && (
          <optgroup label="คลังภาพของหน่วยงาน">
            {assets.map((item, index) => (
              <option key={item.id} value={`asset:${item.id}`}>
                {item.filename || `ภาพที่ ${index + 1}`}
              </option>
            ))}
          </optgroup>
        )}
      </SearchableSelect>
    </label>
  );
}
