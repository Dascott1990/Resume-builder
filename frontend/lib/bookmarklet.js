/**
 * bookmarklet.js — the "Tailor for this Job" bookmarklet.
 *
 * Runs entirely inside whatever job board page it's clicked on (LinkedIn,
 * Indeed, a company's own careers page — anywhere), which is a different
 * origin than Noviq with no access to its localStorage or cookies. So the
 * only way to hand the page's text back to Noviq is: POST it to a public
 * capture endpoint (see backend/app/api/capture.py — no auth, single-use,
 * swept after an hour), then open a new Noviq tab with the resulting id in
 * the URL. app/page.js picks that id up on load and fetches the text.
 *
 * Deliberately generic (document.body.innerText, not per-site selectors):
 * every job board's DOM is different and changes without notice, and the
 * AI on the other end is already good at finding the actual posting inside
 * noisy raw text — same trick CV Scan already relies on for resumes.
 */
const API_URL = "https://resume-builder-blfc.onrender.com";
const APP_URL = "https://resume-builder-orpin-theta.vercel.app";

const SOURCE = `(function(){
  var API='${API_URL}';
  var APP='${APP_URL}';
  var text=(document.body.innerText||'').trim();
  if(!text){alert('Noviq: could not read any text on this page.');return;}
  text=text.slice(0,8000);
  fetch(API+'/api/v1/capture/jd',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:text})
  }).then(function(r){return r.json();}).then(function(j){
    if(j&&j.success&&j.data&&j.data.id){
      window.open(APP+'/?jd='+j.data.id,'_blank');
    }else{
      alert('Noviq: could not capture this page. Try again.');
    }
  }).catch(function(){alert('Noviq: could not reach Noviq. Try again.');});
})();`;

// Collapse to one line — a multi-line javascript: URI is technically valid
// but some browsers' bookmark-drag handling gets finicky with embedded
// newlines, and a single line is easier to sanity-check by eye too.
export const BOOKMARKLET_HREF = "javascript:" + SOURCE.replace(/\s+/g, " ").trim();
