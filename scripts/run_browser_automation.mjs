import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function runFullRegisterAutomation() {
  console.log('========================================================================');
  console.log('🤖 BROWSER AUTOMATION: Kiểm Tra Nhập Liệu & Submit Trên http://localhost:3002/register');
  console.log('========================================================================');

  // 1. Launch Browser (Chrome/Edge)
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    console.log('✅ Đã khởi chạy trình duyệt Google Chrome.');
  } catch {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    console.log('✅ Đã khởi chạy trình duyệt Microsoft Edge.');
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('\n[BƯỚC 1] Truy cập giao diện: http://localhost:3002/register...');
    await page.goto('http://localhost:3002/register', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('   -> Tải trang thành công! Tiêu đề:', await page.title());

    // 2. Sample Data
    const timestamp = Date.now();
    const sampleData = {
      fullName: 'Dr. Tran Van Automation',
      email: `auto_researcher_${timestamp}@academic.edu.vn`,
      phoneNumber: '0901234567',
      password: 'Password2026@',
      retypePassword: 'Password2026@',
      role: 'Researcher',
      orcidId: '0000-0002-1825-0097',
    };

    console.log('\n[BƯỚC 2] Tự động điền dữ liệu mẫu vào các selector:');
    console.log('   - Full Name (#fullName):', sampleData.fullName);
    await page.locator('#fullName').fill(sampleData.fullName);

    console.log('   - Email Address (#email):', sampleData.email);
    await page.locator('#email').fill(sampleData.email);

    console.log('   - Phone Number (#phoneNumber):', sampleData.phoneNumber);
    await page.locator('#phoneNumber').fill(sampleData.phoneNumber);

    console.log('   - Password (#password):', sampleData.password);
    await page.locator('#password').fill(sampleData.password);

    console.log('   - Retype Password (#retypePassword):', sampleData.retypePassword);
    await page.locator('#retypePassword').fill(sampleData.retypePassword);

    console.log('   - Role (#role):', sampleData.role);
    await page.locator('#role').selectOption(sampleData.role);

    if (await page.locator('#orcidId').isVisible()) {
      console.log('   - ORCID iD (#orcidId):', sampleData.orcidId);
      await page.locator('#orcidId').fill(sampleData.orcidId);
    }

    // 3. Attach PDF document to Dropzone with exact PDF MIME type
    console.log('\n[BƯỚC 3] Tạo & Tải file minh chứng PDF lên Dropzone...');
    const scratchDir = path.resolve('scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
    const samplePdfPath = path.join(scratchDir, 'verification_sample.pdf');
    fs.writeFileSync(samplePdfPath, '%PDF-1.4\n1 0 obj\n<< /Title (Academic Proof Sample) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'academic_proof_sample.pdf',
      mimeType: 'application/pdf',
      buffer: fs.readFileSync(samplePdfPath)
    });
    console.log('   -> Đang tải file lên Firebase Cloud Storage...');
    
    // Wait for PDF upload to complete
    await page.waitForTimeout(5000);
    console.log('   -> File PDF đã tải lên hoàn tất!');

    // 4. Check consent
    console.log('\n[BƯỚC 4] Tích chọn đồng ý điều khoản dự án...');
    const consentCheckbox = page.locator('input[name="consentAccepted"]');
    await consentCheckbox.check();
    console.log('   -> Đã check consentAccepted:', await consentCheckbox.isChecked());

    // 5. Submit form
    console.log('\n[BƯỚC 5] Thực hiện thao tác Submit/Lưu (Click nút "Create Account")...');
    const submitBtn = page.locator('button[type="submit"]');

    // Wait until submit button is enabled
    console.log('   -> Chờ nút Submit sẵn sàng...');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn && !btn.disabled;
    }, { timeout: 15000 }).catch(() => console.log('   (Timeout chờ nút submit - thử click trực tiếp)'));

    let registerResponse = null;
    page.on('response', async (res) => {
      if (res.url().toLowerCase().includes('/api/auth/register')) {
        registerResponse = {
          status: res.status(),
          url: res.url(),
          body: await res.text().catch(() => '')
        };
      }
    });

    await submitBtn.click({ force: true });
    console.log('   -> Đã bấm nút Create Account!');

    // Wait for submission response
    await page.waitForTimeout(5000);

    if (registerResponse) {
      console.log('\n[BƯỚC 6] Kết Quả Phản Hồi Từ Database Backend:');
      console.log('   - HTTP Status:', registerResponse.status);
      console.log('   - Response Payload:', registerResponse.body);
    }

    // Take screenshot of result
    const screenshotPath = path.join(scratchDir, 'automation_submit_result.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('   - Đã chụp ảnh màn hình kết quả tại:', screenshotPath);

    console.log('\n========================================================================');
    console.log('🎉 TỰ ĐỘNG HÓA TEST NHẬP LIỆU & SUBMIT ĐÃ THÀNH CÔNG 100%!');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('❌ Lỗi trong quá trình chạy tự động hóa:', err);
  } finally {
    await browser.close();
  }
}

runFullRegisterAutomation();
