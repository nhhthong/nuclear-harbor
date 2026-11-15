/** Scoped stylesheet for the whole UI (CSS only, no external fonts or images). */
export const UI_CSS = `
.nh-root{position:absolute;inset:0;font-family:"Segoe UI",system-ui,sans-serif;color:#d8f3ff;font-size:clamp(11px,1.9vh,20px);text-shadow:0 0 4px rgba(0,0,0,.8);user-select:none}
.nh-root *{box-sizing:border-box}
.nh-hidden{display:none!important}
.nh-hud{position:absolute;inset:0;pointer-events:none}
.nh-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(255,0,0,.55) 100%);opacity:0;transition:opacity .2s}
.nh-dmg{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0;transition:opacity .6s}
.nh-dmg::after{content:"";position:absolute;left:-12vh;top:-22vh;width:24vh;height:4vh;border-radius:50%;background:radial-gradient(ellipse at center,rgba(255,40,40,.9),transparent 70%)}
.nh-dmg.on{opacity:1;transition:none}
.nh-crosshair{position:absolute;left:50%;top:50%;width:3vh;height:3vh;transform:translate(-50%,-50%)}
.nh-crosshair::before,.nh-crosshair::after{content:"";position:absolute;background:#e8fbff;box-shadow:0 0 3px #000}
.nh-crosshair::before{left:50%;top:0;width:2px;height:100%;transform:translateX(-50%)}
.nh-crosshair::after{top:50%;left:0;height:2px;width:100%;transform:translateY(-50%)}
.nh-hit{position:absolute;left:50%;top:50%;width:4.4vh;height:4.4vh;transform:translate(-50%,-50%) rotate(45deg);opacity:0;border:2px solid #fff;border-radius:2px;background:transparent}
.nh-hit.on{opacity:1}
.nh-hit.body{border-color:#fff}.nh-hit.critical{border-color:#ffd23a}.nh-hit.weakpoint{border-color:#ff3a3a}.nh-hit.armor{border-color:#8a8f96}
.nh-hit.kill{border-color:#ff5a2a}
.nh-panel{background:rgba(6,16,24,.55);border:1px solid rgba(80,200,255,.35);border-radius:4px;padding:.4em .8em}
.nh-bl{position:absolute;left:2vh;bottom:2vh;width:26vh}
.nh-hp-bar,.nh-bar{height:1.2vh;background:rgba(255,255,255,.12);border:1px solid rgba(80,200,255,.4);overflow:hidden;margin-top:.3em}
.nh-hp-fill,.nh-fill{height:100%;width:100%;background:linear-gradient(90deg,#17c964,#7dffb0);transform-origin:left;transition:transform .15s}
.nh-hp-fill.low{background:linear-gradient(90deg,#d11,#f66)}
.nh-big{font-size:2.6em;font-weight:700;letter-spacing:.04em;line-height:1}
.nh-small{font-size:.8em;opacity:.8;letter-spacing:.1em;text-transform:uppercase}
.nh-br{position:absolute;right:2vh;bottom:2vh;text-align:right;min-width:20vh}
.nh-reload{color:#ffd23a}
.nh-top{position:absolute;top:1.5vh;left:50%;transform:translateX(-50%);text-align:center}
.nh-count{font-size:2.8em;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.06em}
.nh-count.critical{color:#ff3030;animation:nh-blink 1s steps(2) infinite}
@keyframes nh-blink{50%{opacity:.55}}
.nh-pips{display:flex;gap:.6vh;justify-content:center;margin-top:.4em}
.nh-pip{width:2.6vh;height:2.6vh;border-radius:50%;border:2px solid #5ab;background:rgba(0,0,0,.4);position:relative}
.nh-pip.activating{border-color:#ffd23a;background:conic-gradient(#ffd23a calc(var(--p,0)*360deg),rgba(0,0,0,.4) 0)}
.nh-pip.active{border-color:#3dff8a;background:#3dff8a;box-shadow:0 0 8px #3dff8a}
.nh-compass{position:absolute;top:11vh;left:50%;transform:translateX(-50%);width:36vh;height:2.4vh;border-bottom:1px solid rgba(80,200,255,.5);background:linear-gradient(90deg,transparent,rgba(80,200,255,.12),transparent)}
.nh-compass::before{content:"";position:absolute;left:50%;bottom:-.5vh;width:2px;height:1vh;background:#9ef}
.nh-marker{position:absolute;left:50%;top:0;width:2vh;text-align:center;font-size:2vh;line-height:2.2vh;color:#ffd23a;margin-left:-1vh;will-change:transform}
.nh-prompt{position:absolute;left:50%;top:60%;transform:translateX(-50%);text-align:center;font-size:1.3em}
.nh-prompt .nh-bar{width:20vh;margin:.4em auto 0}
.nh-prompt .nh-fill{background:#ffd23a;transform:scaleX(0)}
.nh-jump{position:absolute;left:calc(50% + 6vh);top:calc(50% + 6vh);width:3.4vh;height:3.4vh;border-radius:50%;border:2px solid #5ab;background:conic-gradient(rgba(80,200,255,.25) calc(var(--p,0)*360deg),transparent 0);font-size:1.4vh;display:flex;align-items:center;justify-content:center}
.nh-jump.ready{background:rgba(80,200,255,.6)}
.nh-toast{position:absolute;left:50%;top:18vh;transform:translateX(-50%);font-size:1.3em;opacity:0;transition:opacity .25s;white-space:nowrap}
.nh-toast.on{opacity:1}
.nh-boss{position:absolute;top:15vh;left:50%;transform:translateX(-50%);width:50vh;text-align:center}
.nh-boss .nh-fill{background:linear-gradient(90deg,#c22,#f66)}
.nh-boss .nh-fill.locked{background:#555}
.nh-wp{display:flex;gap:1vh;justify-content:center;margin:.4em 0}
.nh-wp div{width:6vh;height:1.6vh;border:1px solid #f66;background:rgba(255,0,0,.15);overflow:hidden}
.nh-wp div i{display:block;height:100%;background:#f44;transform-origin:left}
.nh-wp div.dead{opacity:.35}
.nh-core{font-size:.85em}
.nh-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2vh;background:radial-gradient(ellipse at center,rgba(14,12,18,.72),rgba(4,4,8,.93));pointer-events:auto;animation:nh-in .35s ease-out both}
@keyframes nh-in{from{opacity:0}to{opacity:1}}
.nh-title{font-family:"Bahnschrift","DIN Condensed","Arial Narrow","Segoe UI",sans-serif;font-stretch:condensed;font-size:3.6em;font-weight:800;letter-spacing:.1em;text-transform:uppercase;text-align:center;color:#fff4e6;text-shadow:0 0 24px rgba(255,140,60,.45),0 2px 0 rgba(0,0,0,.6);line-height:.95}
.nh-sub{letter-spacing:.42em;text-transform:uppercase;margin-bottom:2vh;color:#ffb066;font-weight:600}
.nh-btn{position:relative;min-width:30vh;padding:.75em 1.6em .75em 1.4em;font:inherit;font-size:1.05em;font-weight:600;letter-spacing:.2em;text-transform:uppercase;text-align:left;color:#f3e9df;background:linear-gradient(90deg,rgba(20,18,24,.88),rgba(20,18,24,.5));border:0;border-left:3px solid rgba(255,150,70,.55);clip-path:polygon(0 0,100% 0,100% calc(100% - .7em),calc(100% - .7em) 100%,0 100%);cursor:pointer;text-shadow:none;transition:transform .14s ease-out,background .14s,border-color .14s,color .14s}
.nh-btn::after{content:"";position:absolute;right:1.1em;top:50%;width:.5em;height:.5em;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:translateY(-50%) rotate(45deg);opacity:.35;transition:opacity .14s,right .14s}
.nh-btn:hover,.nh-btn:focus-visible{background:linear-gradient(90deg,#ff8a2a,#ffb347);color:#1a0f06;border-left-color:#fff;transform:translateX(.6em);outline:none}
.nh-btn:hover::after,.nh-btn:focus-visible::after{opacity:1;right:.8em}
.nh-btn:active{transform:translateX(.6em) scale(.98)}
.nh-menu{display:block;background:none;overflow:hidden}
.nh-menu-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(6,5,10,.93) 0,rgba(6,5,10,.78) 26%,rgba(6,5,10,.18) 58%,rgba(6,5,10,.42) 100%),linear-gradient(180deg,rgba(6,5,10,.55),transparent 22%,transparent 70%,rgba(6,5,10,.85))}
.nh-menu-bars{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.022) 0 1px,transparent 1px 3px);mix-blend-mode:overlay}
.nh-menu-bars::before,.nh-menu-bars::after{content:"";position:absolute;left:0;right:0;height:5.5vh;background:#040407}
.nh-menu-bars::before{top:0;border-bottom:1px solid rgba(255,150,70,.35)}
.nh-menu-bars::after{bottom:0;border-top:1px solid rgba(255,150,70,.35)}
.nh-menu-left{position:absolute;left:7vw;top:50%;transform:translateY(-54%);display:flex;flex-direction:column;align-items:flex-start;animation:nh-rise .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes nh-rise{from{opacity:0;transform:translateY(-48%)}to{opacity:1;transform:translateY(-54%)}}
.nh-eyebrow{font-size:.8em;letter-spacing:.34em;text-transform:uppercase;color:#ffb066;padding-left:3.2em;position:relative;margin-bottom:1.2em}
.nh-eyebrow::before{content:"";position:absolute;left:0;top:50%;width:2.4em;height:2px;background:#ff8a2a}
.nh-menu .nh-title{font-size:min(8.2em,11vw);text-align:left;letter-spacing:.04em;background:linear-gradient(180deg,#fff 20%,#ffd9b0 62%,#ff9a4a);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 .06em .5em rgba(255,120,40,.35))}
.nh-menu .nh-sub{font-size:1.5em;letter-spacing:.56em;margin:.5em 0 2.4em .1em;color:#f3e9df;font-weight:300}
.nh-menu .nh-sub::after{content:"";display:block;width:5.5em;height:3px;margin-top:.9em;background:linear-gradient(90deg,#ff8a2a,transparent)}
.nh-nav{display:flex;flex-direction:column;gap:.9vh;counter-reset:nav}
.nh-nav .nh-btn{min-width:38vh;font-size:1.15em;padding-left:3.4em}
.nh-nav .nh-btn::before{counter-increment:nav;content:"0" counter(nav);position:absolute;left:1.1em;top:50%;transform:translateY(-50%);font-size:.7em;letter-spacing:.1em;opacity:.55}
.nh-nav .nh-btn:first-child{background:linear-gradient(90deg,rgba(255,138,42,.32),rgba(20,18,24,.5));border-left-color:#ff8a2a}
.nh-nav .nh-btn:first-child:hover,.nh-nav .nh-btn:first-child:focus-visible{background:linear-gradient(90deg,#ff8a2a,#ffb347)}
.nh-brief{position:absolute;right:5vw;top:50%;transform:translateY(-50%);width:min(44vh,30vw);padding:1.5em 1.6em 1.3em;background:rgba(10,9,14,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);border-top:2px solid #ff8a2a;clip-path:polygon(0 0,100% 0,100% calc(100% - 1.4em),calc(100% - 1.4em) 100%,0 100%);text-shadow:none;animation:nh-in .9s .25s ease-out both}
.nh-brief-head{font-size:.75em;letter-spacing:.32em;text-transform:uppercase;color:#ffb066;margin-bottom:1.2em}
.nh-brief-row{display:grid;grid-template-columns:2.2em 1fr;gap:.2em .6em;margin-bottom:1em}
.nh-brief-row i{font-style:normal;font-weight:700;color:#ff8a2a;font-size:.85em;letter-spacing:.08em;padding-top:.15em}
.nh-brief-row b{display:block;text-transform:uppercase;letter-spacing:.14em;font-size:.9em;color:#fff4e6}
.nh-brief-row span{display:block;font-size:.82em;line-height:1.45;opacity:.72;margin-top:.2em}
.nh-brief-clock{display:flex;align-items:baseline;justify-content:space-between;border-top:1px solid rgba(255,255,255,.12);padding-top:.9em;margin-top:.4em}
.nh-brief-clock span{font-size:.72em;letter-spacing:.24em;text-transform:uppercase;opacity:.7}
.nh-brief-clock b{font-size:1.9em;font-variant-numeric:tabular-nums;letter-spacing:.06em;color:#ff5a3a}
.nh-controls{position:absolute;left:7vw;right:5vw;bottom:8.5vh;display:flex;flex-wrap:wrap;gap:.5em 1.3em;font-size:.78em;text-shadow:none}
.nh-chip{display:inline-flex;align-items:center;gap:.6em;opacity:.85}
.nh-chip b{min-width:2em;padding:.22em .55em;text-align:center;font-weight:700;color:#fff4e6;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.28);border-bottom-width:2px;border-radius:.35em;letter-spacing:.04em}
.nh-chip span{letter-spacing:.1em;text-transform:uppercase;opacity:.75}
.nh-menu-foot{position:absolute;left:7vw;bottom:1.8vh;font-size:.66em;letter-spacing:.24em;text-transform:uppercase;opacity:.45;text-shadow:none}
@media (max-aspect-ratio:5/4){.nh-brief{display:none}}
@media (prefers-reduced-motion:reduce){.nh-screen,.nh-menu-left,.nh-brief{animation:none}.nh-btn{transition:none}}
.nh-settings{gap:.8vh}.nh-settings>.nh-row,.nh-settings>.nh-binds{width:min(76vh,92vw)}.nh-settings>.nh-row{padding:.35em 1em;background:rgba(10,9,14,.55);border-left:2px solid rgba(255,150,70,.4)}.nh-settings .nh-binds .nh-row{padding:.2em 1em}.nh-row input[type=range]{accent-color:#ff8a2a}
.nh-row{display:grid;grid-template-columns:1fr 1.2fr auto;align-items:center;gap:1em;width:100%;padding:.2em 0}
.nh-row input[type=range]{width:100%}
.nh-row select,.nh-key{font:inherit;color:#f3e9df;background:rgba(24,20,26,.9);border:1px solid rgba(255,150,70,.45);padding:.25em .6em}
.nh-key{cursor:pointer;min-width:10vh}
.nh-key.listening{border-color:#ffd23a;color:#ffd23a}
.nh-binds{width:100%;max-height:28vh;overflow:auto;border-top:1px solid rgba(255,150,70,.3);margin-top:1vh;padding-top:.5vh}
.nh-binds .nh-row{grid-template-columns:1fr auto}
.nh-credit{max-width:34em;text-align:center;margin:.5em 0;font-size:1em}
.nh-credit b{color:#ffd23a;font-weight:600}
.nh-credit-note{font-size:.8em;opacity:.7}
.nh-reason{font-size:1.3em;color:#ff7b7b;margin-bottom:2vh;text-align:center}
`;
