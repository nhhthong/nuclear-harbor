/** Scoped stylesheet for the whole UI (CSS only, no external fonts or images). */
export const UI_CSS = `
.nh-root{position:absolute;inset:0;font-family:"Segoe UI",system-ui,sans-serif;color:#f3e9df;font-size:clamp(11px,1.9vh,20px);text-shadow:0 1px 3px rgba(0,0,0,.85);user-select:none;--acc:#ff8a2a;--acc2:#ffb066;--bad:#ff3d2e;--ok:#3dff8a;--disp:"Bahnschrift","DIN Condensed","Arial Narrow","Segoe UI",sans-serif}
.nh-root *{box-sizing:border-box}
.nh-hidden{display:none!important}
.nh-hud{position:absolute;inset:0;pointer-events:none;animation:nh-in .4s ease-out both}
.nh-hud::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.34),transparent 16%,transparent 80%,rgba(0,0,0,.42))}
.nh-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(255,20,10,.6) 100%);opacity:0;transition:opacity .2s}
.nh-dmg{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0;transition:opacity .6s}
.nh-dmg::after{content:"";position:absolute;left:-13vh;top:-23vh;width:26vh;height:3.4vh;border-radius:50%;background:radial-gradient(ellipse at center,rgba(255,60,40,.95),transparent 70%)}
.nh-dmg.on{opacity:1;transition:none}
.nh-crosshair{position:absolute;left:50%;top:50%;width:3.4vh;height:3.4vh;transform:translate(-50%,-50%);filter:drop-shadow(0 0 2px rgba(0,0,0,.9));background:linear-gradient(#fff,#fff) 50% 0/2px 30% no-repeat,linear-gradient(#fff,#fff) 50% 100%/2px 30% no-repeat,linear-gradient(#fff,#fff) 0 50%/30% 2px no-repeat,linear-gradient(#fff,#fff) 100% 50%/30% 2px no-repeat,radial-gradient(circle,#ffb066 0 1.5px,transparent 2px) 50% 50%/6px 6px no-repeat}
.nh-hit{position:absolute;left:50%;top:50%;width:4.6vh;height:4.6vh;transform:translate(-50%,-50%) scale(1.25);opacity:0;color:#fff;transition:transform .12s ease-out}
.nh-hit::before,.nh-hit::after{content:"";position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;background:linear-gradient(90deg,currentColor 0 30%,transparent 30% 70%,currentColor 70%);filter:drop-shadow(0 0 2px rgba(0,0,0,.9))}
.nh-hit::before{transform:rotate(45deg)}.nh-hit::after{transform:rotate(-45deg)}
.nh-hit.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.nh-hit.body{color:#fff}.nh-hit.critical{color:#ffd23a}.nh-hit.weakpoint{color:#ff3a3a}.nh-hit.armor{color:#8a8f96}
.nh-hit.kill{color:#ff3d2e;transform:translate(-50%,-50%) scale(1.35)}
.nh-small{font-size:.72em;opacity:.82;letter-spacing:.26em;text-transform:uppercase;font-weight:600}
.nh-big{font-family:var(--disp);font-size:3.4em;font-weight:700;letter-spacing:.02em;line-height:.9;font-variant-numeric:tabular-nums}
.nh-sub2{font-family:var(--disp);font-size:1.25em;opacity:.6;font-variant-numeric:tabular-nums;padding-bottom:.12em}
.nh-stat-row{display:flex;align-items:flex-end;gap:.5em}
.nh-stat-head{display:flex;align-items:center;gap:.6em;margin-bottom:.35em}
.nh-glyph{width:1.5vh;height:1.5vh;display:inline-block}
.nh-glyph-hp{background:linear-gradient(var(--ok),var(--ok)) 50% 50%/100% 34% no-repeat,linear-gradient(var(--ok),var(--ok)) 50% 50%/34% 100% no-repeat}
.nh-bl{position:absolute;left:3vh;bottom:3.2vh;width:34vh;padding-left:1.2vh;border-left:3px solid var(--ok)}
.nh-bl.low{border-left-color:var(--bad);animation:nh-pulse .9s ease-in-out infinite}
.nh-bl.low .nh-glyph-hp{filter:hue-rotate(-140deg) saturate(3)}
.nh-bl.low .nh-big{color:#ff8a7a}
@keyframes nh-pulse{50%{opacity:.72}}
.nh-hp-bar{position:relative;height:1.25vh;margin-top:.7vh;background:rgba(10,9,14,.6);transform:skewX(-18deg);overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.14)}
.nh-hp-fill,.nh-hp-ghost{position:absolute;inset:0;transform-origin:left}
.nh-hp-ghost{background:#fff;opacity:.75;transition:transform .7s .28s cubic-bezier(.3,0,.2,1)}
.nh-hp-fill{background:linear-gradient(90deg,#12b85a,#7dffb0);transition:transform .12s;box-shadow:0 0 1.2vh rgba(61,255,138,.5)}
.nh-hp-fill.low{background:linear-gradient(90deg,#b3160c,#ff6a55);box-shadow:0 0 1.2vh rgba(255,61,46,.6)}
.nh-hp-bar::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 2px),rgba(10,9,14,.85) calc(10% - 2px) 10%)}
.nh-br{position:absolute;right:3vh;bottom:3.2vh;width:30vh;padding-right:1.2vh;border-right:3px solid var(--acc);display:flex;flex-direction:column;align-items:flex-end}
.nh-br .nh-stat-row{margin-top:.3em}
.nh-br.low .nh-big{color:#ffb066}
.nh-br.low{border-right-color:var(--bad)}
.nh-br.empty .nh-big{color:var(--bad)}
.nh-mag{position:relative;width:100%;height:1.25vh;margin-top:.7vh;background:rgba(10,9,14,.6);transform:skewX(18deg);overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.14)}
.nh-mag-fill,.nh-reload-fill{position:absolute;inset:0;transform-origin:right}
.nh-mag-fill{background:linear-gradient(270deg,#ff8a2a,#ffd9a0);transition:transform .06s}
.nh-br.low .nh-mag-fill{background:linear-gradient(270deg,#b3160c,#ff6a55)}
.nh-reload-fill{background:#fff;opacity:0;transform:scaleX(0);transform-origin:left}
.nh-mag::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(3.3333% - 1px),rgba(10,9,14,.9) calc(3.3333% - 1px) 3.3333%)}
.nh-reload{color:#ffd23a;min-height:1.3em;margin-top:.4em;animation:nh-blink 1s steps(2) infinite}
.nh-top{position:absolute;top:2.2vh;left:50%;transform:translateX(-50%);text-align:center;min-width:30vh}
.nh-top-label{color:var(--acc2);opacity:.9}
.nh-count{font-family:var(--disp);font-size:3.6em;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.08em;line-height:1;margin-top:.08em}
.nh-top.critical .nh-top-label{color:var(--bad)}
.nh-count.critical{color:#ff4a3a;text-shadow:0 0 2vh rgba(255,61,46,.7);animation:nh-blink 1s steps(2) infinite}
@keyframes nh-blink{50%{opacity:.55}}
.nh-time{height:.45vh;margin:.6vh auto 0;width:100%;background:rgba(255,255,255,.14);overflow:hidden}
.nh-time-fill{height:100%;background:linear-gradient(90deg,#ff3d2e,#ff8a2a 40%,#ffd9a0);transform-origin:left;transition:transform 1s linear}
.nh-relay{display:flex;align-items:center;justify-content:center;gap:.9em;margin-top:.8vh}
.nh-pips{display:flex;gap:.9vh;justify-content:center}
.nh-pip{width:1.7vh;height:1.7vh;transform:rotate(45deg);border:2px solid rgba(255,255,255,.55);background:rgba(10,9,14,.6)}
.nh-pip.activating{border-color:#ffd23a;background:conic-gradient(from -45deg,#ffd23a calc(var(--p,0)*360deg),rgba(10,9,14,.6) 0);box-shadow:0 0 1vh rgba(255,210,58,.7)}
.nh-pip.active{border-color:var(--ok);background:var(--ok);box-shadow:0 0 1.2vh var(--ok)}
.nh-tape{position:absolute;top:17.2vh;left:50%;width:0;height:2.2vh}
.nh-tape::before{content:"";position:absolute;left:-18vh;width:36vh;bottom:0;height:.9vh;background:repeating-linear-gradient(90deg,rgba(255,255,255,.5) 0 1px,transparent 1px 1.5vh);-webkit-mask:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent);mask:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)}
.nh-tape::after{content:"";position:absolute;left:-1px;bottom:-.6vh;width:2px;height:1.9vh;background:var(--acc)}
.nh-tape span{position:absolute;left:-2vh;width:4vh;top:-.6vh;text-align:center;font-size:.62em;letter-spacing:.1em;opacity:0;will-change:transform}
.nh-tape span.major{font-size:.8em;font-weight:700;color:#fff}
.nh-compass{position:absolute;top:19.6vh;left:50%;transform:translateX(-50%);width:36vh;height:2vh}
.nh-marker{position:absolute;left:50%;top:0;width:2vh;text-align:center;font-size:1.5vh;line-height:2vh;color:#ffd23a;margin-left:-1vh;will-change:transform;text-shadow:0 0 1vh rgba(255,210,58,.8)}
.nh-radar{position:absolute;left:3vh;top:3vh;width:19vh;text-align:center}
.nh-radar canvas{width:19vh;height:19vh;display:block;filter:drop-shadow(0 0 1vh rgba(0,0,0,.6))}
.nh-radar-count{font-size:.62em;letter-spacing:.26em;text-transform:uppercase;margin-top:.5vh;opacity:.7}
.nh-radar.hot .nh-radar-count{color:#ff8a7a;opacity:1}
.nh-prompt{position:absolute;left:50%;top:62%;transform:translateX(-50%);text-align:center;font-size:1.05em;letter-spacing:.16em;text-transform:uppercase;padding:.5em 1.4em;background:linear-gradient(90deg,transparent,rgba(10,9,14,.7) 20%,rgba(10,9,14,.7) 80%,transparent)}
.nh-bar{height:.7vh;background:rgba(255,255,255,.14);overflow:hidden;margin-top:.5em}
.nh-fill{height:100%;width:100%;transform-origin:left;transition:transform .15s}
.nh-prompt .nh-bar{width:24vh;margin:.6em auto 0}
.nh-prompt .nh-fill{background:linear-gradient(90deg,#ffd23a,#fff2b0);transform:scaleX(0);box-shadow:0 0 1vh rgba(255,210,58,.7)}
.nh-jump{position:absolute;left:calc(50% + 5.2vh);top:calc(50% + 4.6vh);min-width:3.6vh;padding:.15em .5em;border-left:2px solid rgba(255,255,255,.3);font-family:var(--disp);font-size:1.5vh;font-weight:700;letter-spacing:.1em;color:rgba(255,255,255,.35);text-shadow:none}
.nh-jump::before{content:"JUMP ";font-size:.75em;letter-spacing:.2em;font-weight:400}
.nh-jump.ready{border-left-color:var(--acc);color:#fff4e6}
.nh-toast{position:absolute;left:50%;top:25vh;transform:translate(-50%,-.6vh);font-size:1.1em;letter-spacing:.2em;text-transform:uppercase;font-weight:600;opacity:0;transition:opacity .25s,transform .25s;white-space:nowrap;padding:.5em 2.4em;background:linear-gradient(90deg,transparent,rgba(10,9,14,.72) 18%,rgba(10,9,14,.72) 82%,transparent);border-top:1px solid rgba(255,150,70,.5);border-bottom:1px solid rgba(255,150,70,.5)}
.nh-toast.on{opacity:1;transform:translate(-50%,0)}
.nh-boss{position:absolute;bottom:13vh;left:50%;transform:translateX(-50%);width:62vh;text-align:center}
.nh-boss .nh-small{color:#ff8a7a;letter-spacing:.4em;font-size:.8em}
.nh-boss .nh-bar{height:1.3vh;transform:skewX(-18deg);background:rgba(10,9,14,.65);box-shadow:0 0 0 1px rgba(255,255,255,.16)}
.nh-boss .nh-fill{background:linear-gradient(90deg,#b3160c,#ff5a3a);box-shadow:0 0 1.4vh rgba(255,61,46,.6)}
.nh-boss .nh-fill.locked{background:repeating-linear-gradient(-45deg,#3a3a40 0 .8vh,#2a2a30 .8vh 1.6vh);box-shadow:none}
.nh-wp{display:flex;gap:1.2vh;justify-content:center;margin:.7em 0 .5em}
.nh-wp div{width:9vh;height:.9vh;background:rgba(10,9,14,.65);box-shadow:0 0 0 1px rgba(255,120,100,.5);overflow:hidden;transform:skewX(-18deg)}
.nh-wp div i{display:block;height:100%;background:#ffb066;transform-origin:left}
.nh-wp div.dead{opacity:.3}
.nh-core{font-size:.7em;letter-spacing:.3em;margin-top:.6em;opacity:.85}
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
