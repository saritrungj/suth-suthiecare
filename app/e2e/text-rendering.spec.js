import {test,expect} from '@playwright/test';
import {mockPublicApi} from './helpers/api-mocks.js';

test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('i18nextLng','th'));
 await mockPublicApi(page);
});

test('assessment renders encoded formatting, lists and comparison operators without changing answers',async({page})=>{
 const option='**มากกว่า** &gt; 10';
 await page.route('**/api/forms/88',route=>route.fulfill({json:{id:88,title:'**แบบประเมิน** &amp; ตัวอย่าง',description:'ข้อความ &gt; 0',theme:{},login_enforcement:'none',questions:[
  {id:'q1',type:'multiple_choice',title:'คะแนน **&gt;** 10',hasDescription:true,text:'**คำแนะนำ**\n\n- ข้อหนึ่ง\n- ข้อสอง',options:[option,'ไม่เกิน &lt;= 10']},
  {id:'q2',type:'dropdown',title:'เลือกช่วงคะแนน',options:[option,'ไม่เกิน &lt;= 10']},
 ]}}));
 await page.goto('/assessment/88');
 const heading=page.locator('#question-q1 .preview-sec__title');
 await expect(heading).toHaveText('คะแนน > 10');
 await expect(heading.locator('strong')).toHaveText('>');
 await expect(page.locator('#question-q1 .preview-hint strong')).toHaveText('คำแนะนำ');
 await expect(page.locator('#question-q1 .preview-hint li')).toHaveText(['ข้อหนึ่ง','ข้อสอง']);
 const radio=page.getByRole('radio',{name:'มากกว่า > 10',exact:true});
 await radio.check();await expect(radio).toBeChecked();
 await expect(page.locator('#question-q2 option').nth(1)).toHaveText('มากกว่า > 10');
 await expect(page.locator('#question-q2 option').nth(1)).toHaveAttribute('value',option);
 await expect(page.locator('.preview-container')).not.toContainText('**');
 await expect(page.locator('.preview-container')).not.toContainText('&gt;');
});

test('rich rendering strips encoded executable HTML and retains intended formatting',async({page})=>{
 await page.route('**/api/forms/88',route=>route.fulfill({json:{id:88,title:'ทดสอบการแสดงผล',theme:{},login_enforcement:'none',questions:[{id:'q1',type:'short_text',title:'&lt;strong onclick="window.__renderExecuted=1"&gt;หัวข้อ&lt;/strong&gt;',hasDescription:true,text:'&lt;img src=x onerror="window.__renderExecuted=1"&gt; &lt;script&gt;window.__renderExecuted=1&lt;/script&gt; [ลิงก์](javascript:alert(1)) **เนื้อหาปลอดภัย**'}]}}));
 await page.goto('/assessment/88');
 const question=page.locator('#question-q1');
 await expect(question.locator('h3 strong')).toHaveText('หัวข้อ');
 await expect(question.locator('.preview-hint strong')).toHaveText('เนื้อหาปลอดภัย');
 await expect(question.locator('script,img,[onclick],[onerror],a[href^="javascript:"]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__renderExecuted)).toBeUndefined();
 const formatted=await page.evaluate(async()=>{
  const {toDisplayText}=await import('/src/utils/textPresentation.js');
  return ['คะแนน **&gt;** 10','ชื่อ *** โทร 081****123','ค่า < 10 และ > 2'].map(toDisplayText);
 });
 expect(formatted).toEqual(['คะแนน > 10','ชื่อ *** โทร 081****123','ค่า < 10 และ > 2']);
});

test('landing form titles and descriptions contain readable content',async({page})=>{
 await page.route(/\/api\/forms(?:\?.*)?$/,route=>route.fulfill({json:[{id:101,title:'แบบประเมิน **สุขภาพ** &amp; การดูแล',description:'สำหรับคะแนน **&gt;** 10',clinic_type:'general',status:'published'}]}));
 await page.goto('/');
 await page.getByRole('heading',{name:'คลินิกสุขภาพทั่วไป',exact:true}).click();
 await expect(page.getByRole('heading',{name:'แบบประเมิน สุขภาพ & การดูแล',exact:true}).first()).toBeVisible();
 await expect(page.locator('.sut2-card__desc').first()).toHaveText('สำหรับคะแนน > 10');
});
