import DOMPurify from 'dompurify';
import { contentMarkup } from './textPresentation.js';

export function toSafeHtml(value) {
 return DOMPurify.sanitize(contentMarkup(value),{
  ALLOWED_TAGS:['p','br','strong','b','em','i','u','s','del','ol','ul','li','h1','h2','h3','h4','h5','h6','blockquote','span','a','code','pre','table','thead','tbody','tr','th','td','hr','sub','sup'],
  ALLOWED_ATTR:['href','title','target','rel','class','style','colspan','rowspan','scope'],
 });
}
