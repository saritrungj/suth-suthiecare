import {useEffect,useRef,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {FiArrowUp} from 'react-icons/fi';
import './AdminScrollToTop.css';

export default function AdminScrollToTop({contentRef}) {
  const {pathname}=useLocation();
  const targetRef=useRef(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    targetRef.current=null;
    setVisible(false);
    const root=contentRef.current;
    const onScroll=event=>{
      const element=event.target;
      if(!(element instanceof HTMLElement)||element.closest('[role="dialog"],textarea,.cw-scroll,.fc-table-scroll,.fc-legend'))return;
      // Listen to each page's actual scroll container, excluding nested lists.
      for(let parent=element.parentElement;parent&&parent!==root;parent=parent.parentElement){
        if(parent.scrollHeight>parent.clientHeight+1&&/auto|scroll/.test(getComputedStyle(parent).overflowY))return;
      }
      targetRef.current=element;
      setVisible(element.scrollTop>320);
    };
    root?.addEventListener('scroll',onScroll,{capture:true,passive:true});
    return()=>root?.removeEventListener('scroll',onScroll,true);
  },[contentRef,pathname]);
  if(!visible)return null;
  return <button type="button" className="admin-scroll-top" aria-label="กลับขึ้นด้านบน" onClick={()=>targetRef.current?.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}><FiArrowUp aria-hidden="true"/><span>ขึ้นด้านบน</span></button>;
}
