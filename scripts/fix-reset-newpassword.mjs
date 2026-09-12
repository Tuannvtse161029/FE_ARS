// Fix the remaining 'New Password' translation
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const viPath = path.join(root, 'src/i18n/dictionaries/vi.ts');
const enPath = path.join(root, 'src/i18n/dictionaries/en.ts');

let vi = fs.readFileSync(viPath, 'utf8');
const pattern = /('reset\.newPassword':\s*)'New Password'/;
if (pattern.test(vi)) {
  vi = vi.replace(pattern, "$1'Mật khẩu mới'");
  fs.writeFileSync(viPath, vi);
  console.log('Fixed: reset.newPassword => Mật khẩu mới');
} else {
  console.log('VI Pattern not found');

  // Maybe VI is correct but EN doesn't have the key. Check.
  const en = fs.readFileSync(enPath, 'utf8');
  if (!/('reset\.newPassword':\s*)/.test(en)) {
    console.log('EN also missing reset.newPassword key');
  } else {
    const enVal = en.match(/('reset\.newPassword':\s*)'([^']*)'/);
    console.log('EN has reset.newPassword =>', enVal && enVal[2]);
  }
}

// Now re-verify the remaining issues
const vi2 = fs.readFileSync(viPath, 'utf8');
const parseDict = (s) => {
  const result = new Map();
  const re = /'([^']+)':\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(s)) !== null) result.set(m[1], m[2]);
  return result;
};
const viMap = parseDict(vi2);
const viChars =
  /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵĂÂĐÊÔƠƯÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/;
const issues = [];
for (const [k, v] of viMap) {
  if (!v || v.length < 3) continue;
  if (!viChars.test(v) && v.split(/\s+/).length >= 2) {
    issues.push({ k, v });
  }
}
console.log('\nRemaining VI values with English words but no VN chars:', issues.length);
issues.forEach((i) => console.log(' ', i.k, '=>', i.v));
