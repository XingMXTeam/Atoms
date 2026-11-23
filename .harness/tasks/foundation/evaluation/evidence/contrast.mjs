import fs from 'node:fs';
const metrics = JSON.parse(fs.readFileSync('.harness/tasks/foundation/evaluation/evidence/home-metrics.json','utf8'));

function parseColor(str){
  if (!str) return null;
  const rgb = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) return [+rgb[1],+rgb[2],+rgb[3]];
  const lab = str.match(/lab\(([-0-9.]+)\s+([-0-9.]+)\s+([-0-9.]+)/i);
  if (lab) {
    // approximate lab L* to sRGB luminance via L only for relative ranking is wrong for contrast;
    // convert Lab -> XYZ -> sRGB
    const L = +lab[1], a = +lab[2], b = +lab[3];
    const fy = (L + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;
    const fInv = (t) => {
      const t3 = t*t*t;
      return t3 > 0.008856 ? t3 : (t - 16/116) / 7.787;
    };
    // D65
    let X = 0.95047 * fInv(fx);
    let Y = 1.00000 * fInv(fy);
    let Z = 1.08883 * fInv(fz);
    // XYZ to linear sRGB
    let r =  3.2406*X - 1.5372*Y - 0.4986*Z;
    let g = -0.9689*X + 1.8758*Y + 0.0415*Z;
    let bl=  0.0557*X - 0.2040*Y + 1.0570*Z;
    const comp = (c) => {
      c = Math.min(Math.max(c,0),1);
      return Math.round(255*(c <= 0.0031308 ? 12.92*c : 1.055*Math.pow(c,1/2.4)-0.055));
    };
    return [comp(r),comp(g),comp(bl)];
  }
  return null;
}
function contrast(fg,bg){
  const lin = (c)=>{ const s=c/255; return s<=0.03928? s/12.92 : Math.pow((s+0.055)/1.055,2.4); };
  const L = ([r,g,b]) => 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
  const L1=L(fg), L2=L(bg); const [a,b]= L1>=L2?[L1,L2]:[L2,L1];
  return (a+0.05)/(b+0.05);
}
for (const key of ['desktop-1280','mobile-375']) {
  const m = metrics[key];
  const bg = parseColor(m.bodyBg) || [255,255,255];
  m.contrast = {
    h1: Number(contrast(parseColor(m.h1Color), bg).toFixed(2)),
    eyebrow: Number(contrast(parseColor(m.eyebrowColor), bg).toFixed(2)),
    body: Number(contrast(parseColor(m.bodyColor), bg).toFixed(2)),
    parsed: { bg, h1: parseColor(m.h1Color), eyebrow: parseColor(m.eyebrowColor), body: parseColor(m.bodyColor) }
  };
}
fs.writeFileSync('.harness/tasks/foundation/evaluation/evidence/home-metrics.json', JSON.stringify(metrics,null,2));
console.log(JSON.stringify({desktop: metrics['desktop-1280'].contrast, mobile: metrics['mobile-375'].contrast}, null, 2));
