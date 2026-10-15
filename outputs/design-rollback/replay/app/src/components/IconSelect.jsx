import SearchableSelect from './SearchableSelect';
import { toDisplayText } from '../utils/textPresentation';

/** Adapter for the icon filters used by the dashboard and management pages. */
export default function IconSelect({ icon: Icon, value, options = [], onChange, style, iconStyle, textStyle, className, label }) {
  return <div className={className} style={style}>
    {Icon && <Icon aria-hidden="true" style={iconStyle} />}
    <SearchableSelect aria-label={label || options[0]?.label || 'เลือกรายการ'} value={value} onChange={e => onChange(options.find(o => String(o.value) === e.target.value)?.value ?? e.target.value)} style={{flex:1,minWidth:0,width:'100%',minHeight:44,border:0,background:'transparent',color:'inherit',font:'inherit',cursor:'pointer',...textStyle}}>
      {options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{toDisplayText(o.label)}</option>)}
    </SearchableSelect>
  </div>;
}
