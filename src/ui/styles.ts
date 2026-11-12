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
.nh-grapple{position:absolute;left:calc(50% + 6vh);top:calc(50% + 6vh);width:3.4vh;height:3.4vh;border-radius:50%;border:2px solid #5ab;background:conic-gradient(rgba(80,200,255,.25) calc(var(--p,0)*360deg),transparent 0);font-size:1.4vh;display:flex;align-items:center;justify-content:center}
.nh-grapple.ready{background:rgba(80,200,255,.6)}
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
.nh-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4vh;background:radial-gradient(ellipse at center,rgba(8,20,30,.78),rgba(2,6,10,.94));pointer-events:auto}
.nh-title{font-size:3.4em;font-weight:800;letter-spacing:.12em;text-transform:uppercase;text-align:center;color:#8fe6ff;text-shadow:0 0 18px rgba(80,200,255,.6)}
.nh-sub{opacity:.8;letter-spacing:.2em;text-transform:uppercase;margin-bottom:2vh}
.nh-btn{min-width:28vh;padding:.7em 1.4em;font:inherit;font-size:1.1em;letter-spacing:.14em;text-transform:uppercase;color:#d8f3ff;background:rgba(10,40,60,.8);border:1px solid rgba(80,200,255,.6);cursor:pointer;text-shadow:none}
.nh-btn:hover,.nh-btn:focus-visible{background:rgba(40,120,170,.85);outline:2px solid #9ef;outline-offset:2px}
.nh-controls{display:grid;grid-template-columns:auto auto;gap:.2em 1.6em;font-size:.9em;margin-top:2vh;opacity:.9}
.nh-controls b{color:#ffd23a;font-weight:600;text-align:right}
.nh-settings{width:min(70vh,92vw);gap:.8vh}
.nh-row{display:grid;grid-template-columns:1fr 1.2fr auto;align-items:center;gap:1em;width:100%;padding:.2em 0}
.nh-row input[type=range]{width:100%}
.nh-row select,.nh-key{font:inherit;color:#d8f3ff;background:rgba(10,40,60,.9);border:1px solid rgba(80,200,255,.5);padding:.2em .5em}
.nh-key{cursor:pointer;min-width:10vh}
.nh-key.listening{border-color:#ffd23a;color:#ffd23a}
.nh-binds{width:100%;max-height:28vh;overflow:auto;border-top:1px solid rgba(80,200,255,.3);margin-top:1vh;padding-top:.5vh}
.nh-binds .nh-row{grid-template-columns:1fr auto}
.nh-reason{font-size:1.3em;color:#ff7b7b;margin-bottom:2vh;text-align:center}
`;
