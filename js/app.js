(() => {
 const $ = (s) => document.querySelector(s);
 const menu = $('#menu-toggle'), nav = $('#main-nav');
 menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'×':'☰';});
 nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu?.setAttribute('aria-expanded','false');if(menu)menu.textContent='☰';}));
 $('#year').textContent = new Date().getFullYear();
 const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ready = () => window.supabaseReady && window.schoolSupabase;
 async function loadPublic(){
   if(!ready()) return;
   const db=window.schoolSupabase;
   try {
     const {data:settings}=await db.from('ehs_site_settings').select('key,value');
     (settings||[]).forEach(({key,value})=>{const map={school_name_brand:'#school-name-brand',school_motto_brand:'#school-motto-brand',hero_eyebrow:'#hero-eyebrow',hero_title:'#hero-title',hero_description:'#hero-description',about_title:'#about-title',about_text:'#about-text',contact_phone:'#contact-phone',contact_email:'#contact-email',contact_address:'#contact-address'};const el=map[key]?$(map[key]):null;if(el){if(key==='hero_title'&&value.includes('|'))el.innerHTML=esc(value.split('|')[0])+' <em>'+esc(value.split('|').slice(1).join('|'))+'</em>';else el.textContent=value;}});
     const [{data:programs},{data:news},{data:staff},{data:gallery},{data:quotes},{data:faqs}] = await Promise.all([
       db.from('ehs_programs').select('*').eq('published',true).order('display_order'),db.from('ehs_news_events').select('*').eq('published',true).order('event_date',{ascending:true,nullsFirst:false}).limit(6),db.from('ehs_staff').select('*').eq('published',true).order('display_order'),db.from('ehs_gallery').select('*').eq('published',true).order('display_order').limit(8),db.from('ehs_testimonials').select('*').eq('published',true).order('display_order'),db.from('ehs_faqs').select('*').eq('published',true).order('display_order')
     ]);
     if(programs?.length) $('#program-grid').innerHTML=programs.map((p,i)=>`<article class="program-card ${['program-dark','program-purple','program-light'][i%3]}"><span class="program-no">${esc(p.level||'PROGRAMME')}</span><div class="program-symbol">${['◈','✦','✧'][i%3]}</div><h3>${esc(p.title)}</h3><p>${esc(p.description||'')}</p><a href="#contact">Ask about this programme <span>↗</span></a></article>`).join('');
     if(news?.length) $('#news-grid').innerHTML=news.map(n=>`<article class="news-card">${n.image_url?`<img src="${esc(n.image_url)}" alt="${esc(n.title)}">`:''}<div class="news-body"><span class="news-date">${esc(n.event_date||n.category||'SCHOOL UPDATE')}</span><h3>${esc(n.title)}</h3><p>${esc(n.body||'')}</p></div></article>`).join('');
     if(staff?.length) $('#staff-grid').innerHTML=staff.map(s=>`<article class="staff-card">${s.image_url?`<img src="${esc(s.image_url)}" alt="${esc(s.name)}">`:''}<div class="staff-info"><h3>${esc(s.name)}</h3><p>${esc(s.role||'School staff')}</p>${s.bio?`<p class="muted">${esc(s.bio)}</p>`:''}</div></article>`).join('');
     if(gallery?.length) $('#gallery-grid').innerHTML=gallery.map(g=>`<figure class="gallery-item"><img loading="lazy" src="${esc(g.image_url)}" alt="${esc(g.caption||'School campus life')}"><span>${esc(g.caption||'Campus life')}</span></figure>`).join('');
     if(quotes?.length) $('#testimonial-grid').innerHTML=quotes.map(q=>`<article class="testimonial-card"><div class="quote-mark">“</div><blockquote>${esc(q.quote)}</blockquote><strong>${esc(q.person_name)}</strong><small>${esc(q.relationship||'School community')}</small></article>`).join('');
     if(faqs?.length) $('#faq-list').innerHTML=faqs.map(f=>`<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('');
   } catch(e){console.warn('Website content could not be loaded from Supabase. Default content remains visible.',e);}
 }
 $('#contact-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const status = $('#contact-status');if(!ready()){status.textContent='The form is not connected yet. Please contact the school by phone or email.';return;}const f = new FormData(form);status.textContent='Sending…';try{const {error}=await window.schoolSupabase.from('ehs_contact_inquiries').insert({name:f.get('name'),email:f.get('email'),subject:f.get('subject'),message:f.get('message')});if(error)throw error;status.textContent='Thank you. Your enquiry has been sent to the school.';form.reset();}catch(err){console.error(err);status.textContent='We could not send your enquiry. Please try again or contact the school directly.';}});
 loadPublic();
})();
