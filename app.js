import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

// 1) Paste your Firebase Web App config here. This config is safe to expose; security comes from Auth + Firestore Rules.
const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};
// 2) Replace this after deploying the Cloudflare Worker.
const API_URL = 'https://YOUR-WORKER.workers.dev/api/study';

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
let quizData=[], currentStudy=null, user=null;
let stats={xp:0,sets:0,quizzes:0,perfect:0};
const badges=[['First Steps','Generate your first study set',s=>s.sets>=1],['Quiz Rookie','Complete your first quiz',s=>s.quizzes>=1],['Scholar','Earn 250 XP',s=>s.xp>=250],['Perfect Score','Get 100% on a quiz',s=>s.perfect>=1],['Study Streak','Generate 5 study sets',s=>s.sets>=5]];
const $=s=>document.querySelector(s);

document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
$('#generateBtn').onclick=generateStudy; $('#submitQuizBtn').onclick=submitQuiz;
$('#loginBtn').onclick=login; $('#signupBtn').onclick=signup; $('#googleBtn').onclick=googleLogin; $('#signOutBtn').onclick=()=>signOut(auth);
$('#authBtn').onclick=()=>$('#authCard').scrollIntoView({behavior:'smooth'});

onAuthStateChanged(auth,async u=>{user=u; const signed=!!u; $('#authCard').hidden=signed; $('#profileCard').hidden=!signed; $('#authBtn').hidden=signed; $('#signOutBtn').hidden=!signed;
 if(signed){$('#profileName').textContent=u.displayName||'Student';$('#profileEmail').textContent=u.email||'';await loadStats();await loadHistory();}else{stats={xp:0,sets:0,quizzes:0,perfect:0};$('#history').innerHTML='<small>Sign in to see your synced study history.</small>';renderStats();}
});
async function signup(){try{msg('Creating account…');const c=await createUserWithEmailAndPassword(auth,$('#email').value.trim(),$('#password').value);const name=$('#displayName').value.trim();if(name)await updateProfile(c.user,{displayName:name});await setDoc(doc(db,'users',c.user.uid),{displayName:name||'Student',email:c.user.email,xp:0,sets:0,quizzes:0,perfect:0,createdAt:serverTimestamp()});msg('Account created.');}catch(e){msg(e.message,true)}}
async function login(){try{msg('Signing in…');await signInWithEmailAndPassword(auth,$('#email').value.trim(),$('#password').value);msg('');}catch(e){msg(e.message,true)}}
async function googleLogin(){try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){msg(e.message,true)}}
function msg(t,bad=false){$('#authMessage').textContent=t;$('#authMessage').className=bad?'error':''}
function mode(m){$('#ytbox').hidden=m!=='youtube';$('#filebox').hidden=m!=='file'}
async function loadStats(){const ref=doc(db,'users',user.uid),snap=await getDoc(ref);if(snap.exists())stats={...stats,...snap.data()};else await setDoc(ref,{displayName:user.displayName||'Student',email:user.email||'',...stats,createdAt:serverTimestamp()});renderStats()}
async function saveStats(){if(!user)return;await setDoc(doc(db,'users',user.uid),{displayName:user.displayName||'Student',email:user.email||'',...stats,updatedAt:serverTimestamp()},{merge:true});renderStats()}
async function generateStudy(){if(!user)return alert('Sign in or create an account first.');const url=$('#youtubeUrl').value.trim(),file=$('#file').files[0];if(!url&&!file)return alert('Paste a YouTube URL or choose a file.');const fd=new FormData();if(url)fd.append('youtubeUrl',url);if(file)fd.append('file',file);const btn=$('#generateBtn');btn.disabled=true;btn.textContent='Generating…';try{const token=await user.getIdToken();const r=await fetch(API_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');currentStudy={title:url||file.name,sourceType:url?'youtube':'file',sourceURL:url||'',summary:d.summary};showStudy(d);stats.sets++;stats.xp+=25;await saveStats();}catch(e){alert('Study generation failed: '+e.message)}finally{btn.disabled=false;btn.textContent='Generate Study Set'}}
function showStudy(d){$('#result').hidden=false;$('#summary').textContent=d.summary||'No summary returned.';$('#quizScore').textContent='';quizData=d.quiz||[];$('#quiz').innerHTML=quizData.map((q,i)=>`<div class="question"><b>${i+1}. ${esc(q.question)}</b>${q.options.map((o,j)=>`<label class="option"><input type="radio" name="q${i}" value="${j}"> ${esc(o)}</label>`).join('')}</div>`).join('');$('#result').scrollIntoView({behavior:'smooth'})}
async function submitQuiz(){if(!quizData.length||!user)return;let correct=0;quizData.forEach((q,i)=>{const a=document.querySelector(`input[name=q${i}]:checked`);if(a&&Number(a.value)===q.answer)correct++});const pct=Math.round(correct/quizData.length*100);$('#quizScore').textContent=`${correct}/${quizData.length} · ${pct}%`;document.querySelectorAll('.question').forEach((el,i)=>{if(el.querySelector('.explanation'))return;const q=quizData[i],note=document.createElement('p');note.className='explanation';note.textContent=`Answer: ${q.options[q.answer]}${q.explanation?' — '+q.explanation:''}`;el.appendChild(note)});stats.quizzes++;stats.xp+=correct*10;if(pct===100)stats.perfect++;await saveStats();if(currentStudy){await addDoc(collection(db,'users',user.uid,'studySessions'),{...currentStudy,score:correct,totalQuestions:quizData.length,percent:pct,createdAt:serverTimestamp()});await loadHistory();currentStudy=null;}}
async function loadHistory(){const box=$('#history');try{const s=await getDocs(query(collection(db,'users',user.uid,'studySessions'),orderBy('createdAt','desc'),limit(8)));box.innerHTML=s.empty?'<small>No completed study sessions yet.</small>':s.docs.map(d=>{const x=d.data();return `<div class="history-item"><div><b>${esc(x.title||'Study session')}</b><small>${esc(x.sourceType||'source')}</small></div><strong>${Number.isFinite(x.percent)?x.percent+'%':'—'}</strong></div>`}).join('')}catch{box.innerHTML='<small>History will appear after your first completed quiz.</small>'}}
function renderStats(){const lvl=Math.floor((stats.xp||0)/200)+1;$('#level').textContent=`Level ${lvl} · ${stats.xp||0} XP`;$('#setsStat').textContent=stats.sets||0;$('#quizzesStat').textContent=stats.quizzes||0;$('#achievements').innerHTML=badges.map(b=>`<div class="badge ${b[2](stats)?'':'locked'}"><b>${b[0]}</b><small>${b[1]}</small>${b[2](stats)?'<span class="earned">Unlocked</span>':''}</div>`).join('')}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}renderStats();
