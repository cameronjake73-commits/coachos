/**
 * Opening animation shown once per visit (each time the app is opened from the home screen).
 * Pure HTML + CSS so it appears the instant the page arrives, before any JavaScript loads,
 * and removes itself after about 2 seconds. An inline script hides it on later page loads in the same visit.
 */
export const SPLASH_SCRIPT = "try{var k='coachos-splash';if(sessionStorage.getItem(k)){document.documentElement.classList.add('splash-seen')}else{sessionStorage.setItem(k,'1')}}catch(e){}";

export function Splash() {
  return (
    <div id="splash" aria-hidden="true">
      <div className="splash-glow" />
      <div className="splash-mark">
        <svg viewBox="0 0 64 64" width="96" height="96">
          <defs>
            <linearGradient id="splash-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9b7bff" /><stop offset="1" stopColor="#5b34f0" /></linearGradient>
          </defs>
          <path className="splash-outline" d="M32 6 58 56H6Z" fill="none" stroke="#a28cff" strokeWidth="2" strokeLinejoin="round" pathLength={100} />
          <path className="splash-fill" d="M32 6 58 56H6Z" fill="url(#splash-g)" />
          <path className="splash-cut" d="M32 30 44 54H20Z" fill="#0a0b13" />
        </svg>
      </div>
      <div className="splash-word">
        {'COACHOS'.split('').map((ch, i) => <span key={i} style={{ animationDelay: `${0.75 + i * 0.05}s` }}>{ch}</span>)}
      </div>
      <div className="splash-bar"><span /></div>
    </div>
  );
}
