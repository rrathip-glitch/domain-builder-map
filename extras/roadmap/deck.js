const P=require('pptxgenjs');const p=new P();p.layout='LAYOUT_WIDE';
const G='24402E',A='2F55D4',T='1B2333',M='5B6472',L='F3F4EF';
const F='Calibri';
function head(s,t,sub){s.background={color:'FFFFFF'};s.addShape(p.ShapeType.rect,{x:0,y:0,w:13.33,h:0.18,fill:{color:G}});
 s.addText(t,{x:0.6,y:0.45,w:12.1,h:0.8,fontFace:F,fontSize:32,bold:true,color:T});
 if(sub)s.addText(sub,{x:0.6,y:1.2,w:12.1,h:0.5,fontFace:F,fontSize:18,color:M});}
function quote(s,x,y,w,q,time){s.addShape(p.ShapeType.rect,{x,y,w:0.07,h:1.0,fill:{color:A}});
 s.addText([{text:'“'+q+'”',options:{fontSize:17,italic:true,color:T,breakLine:true}},{text:time,options:{fontSize:12,color:M}}],{x:x+0.2,y,w:w-0.2,h:1.0,fontFace:F,valign:'middle'});}
function cat(title,sub,did,quotes){const s=p.addSlide();head(s,title,sub);
 s.addText('WHAT I DID',{x:0.6,y:1.95,w:5,h:0.3,fontFace:F,fontSize:13,bold:true,color:G,charSpacing:2});
 s.addText(did.map(d=>({text:d,options:{bullet:true,breakLine:true}})),{x:0.6,y:2.3,w:5.4,h:4.4,fontFace:F,fontSize:19,color:T,valign:'top',paraSpaceAfter:10});
 s.addText('IN MY WORDS',{x:6.5,y:1.95,w:5,h:0.3,fontFace:F,fontSize:13,bold:true,color:G,charSpacing:2});
 quotes.forEach((q,i)=>quote(s,6.5,2.35+i*1.2,6.3,q[0],q[1]));}
// 1 title
let s=p.addSlide();s.background={color:G};
s.addText('How I used AI',{x:0.7,y:1.6,w:12,h:1.1,fontFace:F,fontSize:54,bold:true,color:'FFFFFF'});
s.addText('The Domain builder map and news feed, built in one morning',{x:0.7,y:2.7,w:12,h:0.6,fontFace:F,fontSize:24,color:'DDE5DD'});
[['2h 46m','first prompt to final build'],['10','AI sessions, one orchestrator'],['~200','research agents in parallel'],['56','prompts from me']].forEach((n,i)=>{
 s.addText(n[0],{x:0.7+i*3.1,y:4.4,w:2.9,h:0.9,fontFace:F,fontSize:40,bold:true,color:'FFFFFF'});
 s.addText(n[1],{x:0.7+i*3.1,y:5.25,w:2.9,h:0.5,fontFace:F,fontSize:15,color:'DDE5DD'});});
// 2 approach
s=p.addSlide();head(s,'Four things I did, in order','The AI did the work. I set the brief, the standard and the direction.');
[['1','Brief','Wrote the job down before any work started'],['2','Orchestrate','Ran it as a team, not a chat'],['3','Steer','Managed pace, cost and quality live'],['4','Shape','Used the live product and gave feedback']].forEach((c,i)=>{const x=0.6+i*3.1;
 s.addShape(p.ShapeType.roundRect,{x,y:2.3,w:2.85,h:3.6,fill:{color:L},line:{color:'E2E5DC'},rectRadius:0.1});
 s.addText(c[0],{x:x+0.25,y:2.5,w:1,h:0.8,fontFace:F,fontSize:40,bold:true,color:A});
 s.addText(c[1],{x:x+0.25,y:3.4,w:2.4,h:0.6,fontFace:F,fontSize:26,bold:true,color:T});
 s.addText(c[2],{x:x+0.25,y:4.1,w:2.4,h:1.4,fontFace:F,fontSize:17,color:M,valign:'top'});});
cat('1. Brief','Twenty minutes on the brief before any building',
 ['Had one session only write the brief, and made it question me first','Gave it the meeting transcript as the source of truth','Set the standard: public sources, every inference visibly tagged','Defined relevance as relevance to Domain'],
 [['Ask me at least 10 questions up front so you can help narrow down the prompt.','10:02'],['This meeting was with the CEO and the COO of Domain, so use that context.','10:17'],['Clear tags or colors for where there are inferences.','10:05'],['Score it with Domain’s exact business, competitors, customers and operations in mind.','10:05']]);
cat('2. Orchestrate','One orchestrator, eight specialist sessions, about 200 research agents',
 ['Asked for parallel sessions that talk to each other','Had the method written down as reusable skills','One research agent per builder; fresh agents re-checked the facts','A separate tester used the product like an executive'],
 [['Spawn other sessions and manage them as orchestrator with communication across.','10:26'],['Create skills for population and share best practices.','10:28'],['Make sure there is no redundant work and quality remains number 1 priority.','10:36'],['Keep the iteration loops running with real UX testing feedback.','11:30']]);
cat('3. Steer','Pace, cost and scope, adjusted as the morning moved',
 ['Moved bulk research to a cheaper model; kept the best one for judgement','Kept second passes light so a first version shipped early','Got a live, PIN-protected link in 36 minutes','Held scope and set a hard stop'],
 [['Use Fable as key orchestrator and more Opus for other work.','10:41'],['Keep second pass work light; I can give clear feedback if you ship soon.','10:40'],['Give me the link ASAP so I can start live testing and giving feedback.','10:52'],['Keep scope tight and quality paramount.','11:32']]);
cat('4. Shape','What I heard in the room and saw on screen went straight into the product',
 ['Regional heads became a research pass and an org chart','Same depth, far simpler screens','Set how the By state map works','Sent later ideas to the roadmap, not the build'],
 [['The CEO stressed regional heads, knowing who all the regional heads are.','10:52'],['No long paragraphs unless someone’s clicking in for details.','11:06'],['A click on a state is what changes the content below the map.','11:28'],['That’s for the future roadmap slide.','11:37']]);
// result
s=p.addSlide();head(s,'What came out','Live portal, workbook, feed and roadmap, every fact sourced');
[['100','builders mapped'],['2,105','people, 140 regional heads'],['3,664','facts, 74% Verified'],['545','stories scored for relevance'],['1,299','rows re-checked by fresh agents'],['57 of 57','usability issues fixed']].forEach((n,i)=>{const x=0.6+(i%3)*4.1,y=2.2+Math.floor(i/3)*2.2;
 s.addShape(p.ShapeType.roundRect,{x,y,w:3.85,h:1.9,fill:{color:L},line:{color:'E2E5DC'},rectRadius:0.1});
 s.addText(n[0],{x:x+0.3,y:y+0.2,w:3.3,h:0.9,fontFace:F,fontSize:40,bold:true,color:G});
 s.addText(n[1],{x:x+0.3,y:y+1.1,w:3.3,h:0.5,fontFace:F,fontSize:17,color:M});});
s.addText('Full prompt log available on request (27 pages).',{x:0.6,y:6.75,w:12,h:0.4,fontFace:F,fontSize:14,color:M});
p.writeFile({fileName:'../../exports/How-I-Used-AI-Deck.pptx'}).then(()=>console.log('ok'));
