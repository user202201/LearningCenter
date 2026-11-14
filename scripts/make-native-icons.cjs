// Icons and splash images of the native shells, made from the ONE master drawing assets/icon/icon.svg (run: npm run icons:native; run `npm run icons` first if the master changed).
//   iOS      ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png   1024 x 1024, no alpha (copy of assets/icon/icon-1024.png)
//            ios/App/App/Assets.xcassets/Splash.imageset/*.png                    2732 x 2732, warm background + the icon in the middle
//   Android  res/mipmap-*/ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png (adaptive icon), res/drawable*/splash.png (sizes kept as they are)
// Chromium (playwright) draws the picture, like make-icons.cjs. Nothing here needs the Android SDK or Xcode.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const BG = '#fff4dc';       // splash background (the app's warm paper colour)
const ADAPTIVE_BG = '#ff922b';

const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

(async () => {
  const svg = fs.readFileSync(path.join(ROOT, 'assets/icon/icon.svg'), 'utf8');
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  /** draws the master on a w x h canvas: `scale` of the shorter side, optional background, optional round clip / rounded corners */
  const draw = async (w, h, { scale = 1, bg = null, round = false, radius = 0 } = {}) => {
    const b64 = await page.evaluate(async ([u, w, h, scale, bg, round, radius]) => {
      const img = new Image(); img.src = u; await img.decode();
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
      const s = Math.min(w, h) * scale, x = (w - s) / 2, y = (h - s) / 2;
      g.save();
      if (round) { g.beginPath(); g.arc(w / 2, h / 2, s / 2, 0, Math.PI * 2); g.clip(); }
      else if (radius) { g.beginPath(); g.roundRect(x, y, s, s, s * radius); g.clip(); }
      g.drawImage(img, x, y, s, s); g.restore();
      return c.toDataURL('image/png').split(',')[1];
    }, [uri, w, h, scale, bg, round, radius]);
    return Buffer.from(b64, 'base64');
  };
  const put = (rel, buf) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); console.log('  ' + rel); };

  // iOS
  const iosSet = 'ios/App/App/Assets.xcassets';
  if (fs.existsSync(path.join(ROOT, iosSet))) {
    put(`${iosSet}/AppIcon.appiconset/AppIcon-512@2x.png`, fs.readFileSync(path.join(ROOT, 'assets/icon/icon-1024.png')));
    const splash = await draw(2732, 2732, { scale: 0.22, bg: BG, radius: 0.22 });
    for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) put(`${iosSet}/Splash.imageset/${n}`, splash);
  }
  // Android
  const res = 'android/app/src/main/res';
  if (fs.existsSync(path.join(ROOT, res))) {
    for (const [d, px] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
      put(`${res}/mipmap-${d}/ic_launcher.png`, await draw(px, px, { radius: 0.18 }));
      put(`${res}/mipmap-${d}/ic_launcher_round.png`, await draw(px, px, { round: true }));
      const fg = Math.round(px * 108 / 48);   // adaptive icon: 108 dp canvas, the picture inside the safe middle
      put(`${res}/mipmap-${d}/ic_launcher_foreground.png`, await draw(fg, fg, { scale: 0.62, radius: 0.2 }));
    }
    fs.writeFileSync(path.join(ROOT, res, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ADAPTIVE_BG}</color>\n</resources>\n`);
    for (const dir of fs.readdirSync(path.join(ROOT, res)).filter((x) => x.startsWith('drawable'))) {
      const f = path.join(ROOT, res, dir, 'splash.png');
      if (!fs.existsSync(f)) continue;
      const [w, h] = pngSize(f);
      put(`${res}/${dir}/splash.png`, await draw(w, h, { scale: 0.3, bg: BG, radius: 0.22 }));
    }
  }
  await browser.close();
})();
