/**
 * ARS_FE Test Cases Excel Generator (v3 - Vietnamese QA Standard, Role-based modules)
 *
 * Generates docs/test_cases.xlsx with ~313 test cases in the 10-column format.
 * Module / Feature Name is set based on the parent role directory structure:
 *   src/pages/Researcher/  -> "Researcher"
 *   src/pages/Reviewer/    -> "Reviewer"
 *   src/pages/Lecturer/    -> "Lecturer"
 *   src/pages/GraduateStudent/ -> "GraduateStudent"
 *   src/pages/Admin/       -> "Admin"
 *   cross-role (Login, Register, ResetPassword, Forum, Dashboard, Profile) -> "Shared"
 *
 * Format:
 *   1. Test Case ID (TC_001)
 *   2. Module / Feature Name (role-based)
 *   3. Test Title
 *   4. Pre-conditions
 *   5. Test Steps (numbered)
 *   6. Test Data
 *   7. Expected Result
 *   8. Priority (High/Medium/Low)
 *   9. Type (Positive/Negative/Boundary/Integration)
 *   10. Status (default: Untested)
 *
 * Run: node generate-test-cases.cjs
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ============================================================================
// Test cases
// ============================================================================

const TEST_CASES = [];

// Helper to push a test case
function tc(module, title, preconditions, steps, data, expected, priority, type) {
  TEST_CASES.push({ module, title, preconditions, steps, data, expected, priority, type });
}

// ----------------------------------------------------------------------------
// AUTH MODULE (cross-role, public) — src/pages/Login, Register, ResetPassword
// ----------------------------------------------------------------------------
const a = 'Auth';

tc(a, 'Login - valid email and password', 'User is on /login; backend login endpoint is up', '1. Navigate to /login\n2. Enter email "test@example.com"\n3. Enter password "Password123"\n4. Click "Sign in"', 'email: test@example.com, password: Password123', 'User is authenticated and redirected to /forum (or /admin if role is admin)', 'High', 'Positive');
tc(a, 'Login - empty email', 'User is on /login', '1. Leave email blank\n2. Enter password\n3. Click "Sign in"', 'email: ""', 'Form shows error: "Username is required"', 'High', 'Negative');
tc(a, 'Login - empty password', 'User is on /login', '1. Enter email\n2. Leave password blank\n3. Click "Sign in"', 'password: ""', 'Form shows error: "Password is required"', 'High', 'Negative');
tc(a, 'Login - both fields empty', 'User is on /login', '1. Leave email and password blank\n2. Click "Sign in"', 'email: "", password: ""', 'Both field errors are displayed; submit blocked', 'High', 'Negative');
tc(a, 'Login - username minimum length boundary (2 chars)', 'User is on /login', '1. Enter "ab" in email\n2. Click "Sign in"', 'email: "ab" (2 chars)', 'Error: "Username must be at least 3 characters"', 'Medium', 'Boundary');
tc(a, 'Login - username minimum length boundary (3 chars)', 'User is on /login', '1. Enter "abc" in email\n2. Enter password\n3. Click "Sign in"', 'email: "abc" (3 chars)', 'Username validation passes (password check proceeds)', 'Medium', 'Boundary');
tc(a, 'Login - username maximum length boundary (50 chars)', 'User is on /login', '1. Enter 50-char email\n2. Click "Sign in"', 'email: "a" * 50', 'Username validation passes', 'Medium', 'Boundary');
tc(a, 'Login - username maximum length boundary (51 chars)', 'User is on /login', '1. Enter 51-char email\n2. Click "Sign in"', 'email: "a" * 51', 'Error: "Username must be at most 50 characters"', 'Medium', 'Boundary');
tc(a, 'Login - password minimum length boundary (5 chars)', 'User is on /login', '1. Enter email\n2. Enter "abcde" (5 chars)\n3. Click "Sign in"', 'password: "abcde"', 'Error: "Password must be at least 6 characters"', 'Medium', 'Boundary');
tc(a, 'Login - password minimum length boundary (6 chars)', 'User is on /login', '1. Enter email\n2. Enter 6 chars\n3. Click "Sign in"', 'password: "abc123"', 'Password validation passes', 'Medium', 'Boundary');
tc(a, 'Login - invalid email format', 'User is on /login', '1. Enter "notanemail"\n2. Enter password\n3. Click "Sign in"', 'email: "notanemail"', 'Submitted to BE; if BE rejects, error toast appears', 'Medium', 'Negative');
tc(a, 'Login - wrong password', 'User is on /login; valid email exists in DB', '1. Enter valid email\n2. Enter wrong password\n3. Click "Sign in"', 'email: test@example.com, password: WrongPass', 'BE returns 401; error message shown', 'High', 'Negative');
tc(a, 'Login - remember me ON', 'User is on /login', '1. Enter credentials\n2. Check "Remember me"\n3. Click "Sign in"', 'rememberMe: true', 'Auth data is stored in localStorage and persists after browser restart', 'High', 'Positive');
tc(a, 'Login - remember me OFF', 'User is on /login', '1. Enter credentials\n2. Uncheck "Remember me"\n3. Click "Sign in"', 'rememberMe: false', 'Auth data is stored in sessionStorage and is cleared on tab close', 'High', 'Positive');
tc(a, 'Login - show/hide password toggle', 'User is on /login', '1. Click eye icon next to password field', 'no input data', 'Password type toggles between password and text', 'Low', 'Positive');
tc(a, 'Login - disabled state during loading', 'User is on /login', '1. Click "Sign in"', 'valid credentials', 'Inputs and button are disabled while the request is in flight', 'Medium', 'Positive');
tc(a, 'Login - Google SSO stub', 'User is on /login', '1. Click "Continue with Google"', 'no input data', 'Console logs stub message; no navigation', 'Low', 'Negative');
tc(a, 'Login - SQL injection in email', 'User is on /login', '1. Enter SQL injection payload\n2. Click "Sign in"', 'email: "admin\' OR 1=1--"', 'Yip schema passes; BE returns 401 or generic error', 'Low', 'Negative');
tc(a, 'Login - XSS in email field', 'User is on /login', '1. Enter XSS payload\n2. Click "Sign in"', 'email: "<script>alert(1)</script>"', 'Output is sanitized; no script execution', 'Low', 'Negative');
tc(a, 'Login - admin role redirect', 'User is on /login; backend confirms admin role', '1. Login with admin credentials', 'admin credentials', 'User redirected to /admin (not /forum)', 'High', 'Integration');

// Register
tc(a, 'Register - valid input', 'User is on /register', '1. Fill all required fields with valid data\n2. Upload PDF verification\n3. Click "Submit"', 'fullName: "John Doe", email: "john@example.com", phone: "+1234567890", password: "Pass1234", role: "Researcher", pdfUrl: "https://...", orcidId: "0000-0002-1825-0097"', 'Account created; redirected to login or success modal', 'High', 'Positive');
tc(a, 'Register - fullName minimum length (1 char)', 'User is on /register', '1. Enter "A" in fullName\n2. Submit', 'fullName: "A"', 'Error: "Full name must be at least 2 characters"', 'Medium', 'Boundary');
tc(a, 'Register - fullName minimum length (2 chars)', 'User is on /register', '1. Enter "Ab" in fullName\n2. Submit', 'fullName: "Ab"', 'fullName validation passes', 'Medium', 'Boundary');
tc(a, 'Register - fullName maximum length (100 chars)', 'User is on /register', '1. Enter 100-char fullName\n2. Submit', 'fullName: "a" * 100', 'Full name validation passes', 'Medium', 'Boundary');
tc(a, 'Register - fullName maximum length (101 chars)', 'User is on /register', '1. Enter 101-char fullName\n2. Submit', 'fullName: "a" * 101', 'Error: "Full name must be at most 100 characters"', 'Medium', 'Boundary');
tc(a, 'Register - invalid email format', 'User is on /register', '1. Enter "notanemail"\n2. Submit', 'email: "notanemail"', 'Error: "Invalid email format"', 'High', 'Negative');
tc(a, 'Register - email empty', 'User is on /register', '1. Leave email blank\n2. Submit', 'email: ""', 'Error: "Email is required"', 'High', 'Negative');
tc(a, 'Register - phone minimum length (7 chars)', 'User is on /register', '1. Enter "1234567" (7 chars)\n2. Submit', 'phone: "1234567"', 'Error: "Invalid phone number format"', 'Medium', 'Boundary');
tc(a, 'Register - phone minimum length (8 chars)', 'User is on /register', '1. Enter "12345678"\n2. Submit', 'phone: "12345678"', 'Phone validation passes', 'Medium', 'Boundary');
tc(a, 'Register - phone maximum length (20 chars)', 'User is on /register', '1. Enter 20-char phone\n2. Submit', 'phone: "12345678901234567890"', 'Phone validation passes', 'Medium', 'Boundary');
tc(a, 'Register - phone maximum length (21 chars)', 'User is on /register', '1. Enter 21-char phone\n2. Submit', 'phone: "123456789012345678901"', 'Error: "Invalid phone number format"', 'Medium', 'Boundary');
tc(a, 'Register - phone with + sign', 'User is on /register', '1. Enter "+1234567890"\n2. Submit', 'phone: "+1234567890"', 'Phone validation passes', 'Medium', 'Positive');
tc(a, 'Register - phone with parentheses', 'User is on /register', '1. Enter "(123) 456-7890"\n2. Submit', 'phone: "(123) 456-7890"', 'Phone validation passes', 'Medium', 'Positive');
tc(a, 'Register - phone with letters (invalid)', 'User is on /register', '1. Enter "abc1234567"\n2. Submit', 'phone: "abc1234567"', 'Error: "Invalid phone number format"', 'Medium', 'Negative');
tc(a, 'Register - password minimum length (7 chars)', 'User is on /register', '1. Enter "Pass123" (7 chars)\n2. Submit', 'password: "Pass123"', 'Error: "Password must be at least 8 characters"', 'Medium', 'Boundary');
tc(a, 'Register - password minimum length (8 chars)', 'User is on /register', '1. Enter "Pass1234" (8 chars)\n2. Submit', 'password: "Pass1234"', 'Password length validation passes', 'Medium', 'Boundary');
tc(a, 'Register - password without uppercase', 'User is on /register', '1. Enter "password1"\n2. Submit', 'password: "password1"', 'Error: "Password must contain at least one uppercase letter"', 'High', 'Negative');
tc(a, 'Register - password without number', 'User is on /register', '1. Enter "Password"\n2. Submit', 'password: "Password"', 'Error: "Password must contain at least one number"', 'High', 'Negative');
tc(a, 'Register - password valid (uppercase + number + 8+ chars)', 'User is on /register', '1. Enter "Password1" (10 chars)\n2. Submit', 'password: "Password1"', 'Password validation passes', 'High', 'Positive');
tc(a, 'Register - retypePassword mismatch', 'User is on /register', '1. Enter password "Password1"\n2. Enter retypePassword "Password2"\n3. Submit', 'retypePassword: "Password2"', 'Error: "Passwords must match"', 'High', 'Negative');
tc(a, 'Register - retypePassword match', 'User is on /register', '1. Enter password "Password1"\n2. Enter retypePassword "Password1"\n3. Submit', 'retypePassword: "Password1"', 'Retype validation passes', 'High', 'Positive');
tc(a, 'Register - role not selected', 'User is on /register', '1. Leave role dropdown empty\n2. Submit', 'role: ""', 'Error: "Role is required"', 'High', 'Negative');
tc(a, 'Register - role invalid value', 'User is on /register', '1. Manually select invalid role\n2. Submit', 'role: "InvalidRole"', 'Error: "Invalid role"', 'High', 'Negative');
tc(a, 'Register - PDF verification missing', 'User is on /register', '1. Fill all fields\n2. Skip PDF upload\n3. Submit', 'pdfUrl: ""', 'Error: "Verification document is required"', 'High', 'Negative');
tc(a, 'Register - ORCID valid format', 'User is on /register', '1. Enter valid ORCID\n2. Submit', 'orcidId: "0000-0002-1825-0097"', 'ORCID validation passes', 'Medium', 'Positive');
tc(a, 'Register - ORCID invalid format (missing X digit)', 'User is on /register', '1. Enter "0000-0002-1825-0099"\n2. Submit', 'orcidId: "0000-0002-1825-0099"', 'Error: "Invalid ORCID ID format"', 'Medium', 'Negative');
tc(a, 'Register - ORCID with X as last digit', 'User is on /register', '1. Enter "0000-0002-1825-009X"\n2. Submit', 'orcidId: "0000-0002-1825-009X"', 'ORCID validation passes', 'Low', 'Positive');
tc(a, 'Register - duplicate email', 'User is on /register; email already exists in DB', '1. Fill form with existing email\n2. Submit', 'email: "duplicate@example.com"', 'BE returns 400/409; error toast appears', 'High', 'Negative');
tc(a, 'Register - role dropdown options', 'User is on /register', '1. Click role dropdown', 'no input data', 'Shows: Researcher, Reviewer, Lecturer, Graduate Student', 'Medium', 'Positive');

// Forgot Password
tc(a, 'Forgot Password - valid email', 'User is on /forgot-password; mock service running', '1. Enter "user@example.com"\n2. Click "Send Code"', 'email: "user@example.com"', 'OTP screen is shown with the email in state', 'High', 'Positive');
tc(a, 'Forgot Password - invalid email', 'User is on /forgot-password', '1. Enter "notanemail"\n2. Click "Send Code"', 'email: "notanemail"', 'Error: "Invalid email format"', 'High', 'Negative');
tc(a, 'Forgot Password - empty email', 'User is on /forgot-password', '1. Click "Send Code" without entering email', 'email: ""', 'Error: "Email is required"', 'High', 'Negative');
tc(a, 'Forgot Password - mock API delay', 'User is on /forgot-password', '1. Submit valid email', 'email: "user@example.com"', 'Loading state shown for ~800ms then navigation', 'Low', 'Positive');

// Verify OTP
tc(a, 'Verify OTP - enter 6 valid digits', 'User is on /forgot-password/verify with email in state', '1. Enter 6 digits one by one', 'otp: "123456"', 'Auto-submits; navigates to /reset-password with resetToken', 'High', 'Positive');
tc(a, 'Verify OTP - non-digit chars stripped', 'User is on /forgot-password/verify', '1. Try to type "abc123"', 'otp: "abc123"', 'Non-digit chars stripped; only "123" remains', 'Medium', 'Negative');
tc(a, 'Verify OTP - paste 6-digit code', 'User is on /forgot-password/verify', '1. Paste "123456" into first box', 'otp: "123456"', 'Paste fills all 6 boxes', 'Medium', 'Positive');
tc(a, 'Verify OTP - backspace navigation', 'User is on /reset-password/verify', '1. Enter 3 digits\n2. Press backspace from box 3', 'otp: "12|"', 'Caret moves to box 2 and clears it', 'Low', 'Positive');
tc(a, 'Verify OTP - arrow key navigation', 'User is on /forgot-password/verify', '1. Press arrow keys in input boxes', 'no input data', 'Caret moves between boxes', 'Low', 'Positive');
tc(a, 'Verify OTP - less than 6 digits', 'User is on /forgot-password/verify', '1. Enter only 5 digits', 'otp: "12345"', 'Submit button is disabled or error shown', 'High', 'Negative');
tc(a, 'Verify OTP - 6-digit boundary valid (000000)', 'User is on /forgot-password/verify', '1. Enter "000000"', 'otp: "000000"', 'OTP validation passes (regex /^\d{6}$/)', 'Medium', 'Boundary');
tc(a, 'Verify OTP - 7 digits blocked', 'User is on /forgot-password/verify', '1. Try to enter 7 digits', 'otp: "1234567"', '7th digit is rejected', 'Medium', 'Boundary');
tc(a, 'Verify OTP - no email in state redirect', 'User navigates directly to /forgot-password/verify', '1. Load page without email in state', 'no input data', 'Redirects back to /forgot-password', 'Medium', 'Negative');
tc(a, 'Verify OTP - resend cooldown 60s', 'User is on /forgot-password/verify', '1. Click "Resend code"', 'no input data', 'Button disabled for 60 seconds with countdown', 'Low', 'Positive');
tc(a, 'Verify OTP - resend after cooldown', 'User is on /forgot-password/verify; 60s elapsed', '1. Click "Resend code"', 'no input data', 'New OTP request is sent', 'Low', 'Positive');
tc(a, 'Verify OTP - wrong OTP code', 'User is on /forgot-password/verify', '1. Enter "000000" (wrong code)', 'otp: "000000"', 'Error message displayed; remains on page', 'High', 'Negative');

// Reset Password
tc(a, 'Reset Password - valid new password', 'User is on /reset-password with resetToken in state', '1. Enter new password "Pass1234"\n2. Enter confirm password "Pass1234"\n3. Click "Reset"', 'newPassword: "Pass1234", confirmPassword: "Pass1234"', 'Password reset; navigated to /login', 'High', 'Positive');
tc(a, 'Reset Password - no resetToken redirect', 'User navigates directly to /reset-password', '1. Load page without resetToken', 'no input data', 'Redirects to /login', 'Medium', 'Negative');
tc(a, 'Reset Password - new password without uppercase', 'User is on /reset-password', '1. Enter "pass1234"\n2. Submit', 'newPassword: "pass1234"', 'Error: "Password must contain at least one uppercase letter"', 'High', 'Negative');
tc(a, 'Reset Password - new password without number', 'User is on /reset-password', '1. Enter "Password"\n2. Submit', 'newPassword: "Password"', 'Error: "Password must contain at least one number"', 'High', 'Negative');
tc(a, 'Reset Password - new password 7 chars', 'User is on /reset-password', '1. Enter "Pass123" (7 chars)\n2. Submit', 'newPassword: "Pass123"', 'Error: "Password must be at least 8 characters"', 'Medium', 'Boundary');
tc(a, 'Reset Password - new password 8 chars', 'User is on /reset-password', '1. Enter "Pass1234" (8 chars)\n2. Submit', 'newPassword: "Pass1234"', 'Password length validation passes', 'Medium', 'Boundary');
tc(a, 'Reset Password - confirm mismatch', 'User is on /reset-password', '1. Enter new "Pass1234"\n2. Enter confirm "Pass5678"\n3. Submit', 'confirmPassword: "Pass5678"', 'Error: "Passwords must match"', 'High', 'Negative');
tc(a, 'Reset Password - confirm match', 'User is on /reset-password', '1. Enter new "Pass1234"\n2. Enter confirm "Pass1234"\n3. Submit', 'confirmPassword: "Pass1234"', 'Confirm validation passes', 'High', 'Positive');
tc(a, 'Reset Password - show/hide new password toggle', 'User is on /reset-password', '1. Click eye icon', 'no input data', 'Password field type toggles', 'Low', 'Positive');

// ----------------------------------------------------------------------------
// PAPERS MODULE (cross-role: Researcher submits, Reviewer evaluates) — src/pages/Papers
// ----------------------------------------------------------------------------
const p = 'Papers';
tc(p, 'Papers - list all papers', 'User is on /papers; authenticated', '1. Navigate to /papers', 'no input data', 'All papers are loaded and displayed', 'High', 'Positive');
tc(p, 'Papers - filter by status=Waiting', 'User is on /papers', '1. Click "Waiting" tab', 'no input data', 'Only papers with status "Waiting" are shown', 'High', 'Positive');
tc(p, 'Papers - filter by status=Accepted', 'User is on /papers', '1. Click "Accepted" tab', 'no input data', 'Only accepted papers are shown', 'High', 'Positive');
tc(p, 'Papers - filter by status=Rejected', 'User is on /papers', '1. Click "Rejected" tab', 'no input data', 'Only rejected papers are shown', 'High', 'Positive');
tc(p, 'Papers - filter by status=Draft', 'User is on /papers', '1. Click "Draft" tab', 'no input data', 'Only draft papers are shown', 'High', 'Positive');
tc(p, 'Papers - empty list', 'User is on /papers; no papers exist', '1. Load page', 'no input data', 'Empty state message is displayed', 'Medium', 'Negative');
tc(p, 'Papers - upload PDF file', 'User is on /papers; clicking "Upload Paper"', '1. Click "Upload Paper"\n2. Select valid PDF (<10MB)', 'file: "paper.pdf" (<10MB)', 'File accepted; preview shown', 'High', 'Positive');
tc(p, 'Papers - upload non-PDF file', 'User is on /papers', '1. Click "Upload Paper"\n2. Select "image.jpg"', 'file: "image.jpg"', 'Error: file type not allowed', 'High', 'Negative');
tc(p, 'Papers - upload 10MB PDF boundary', 'User is on /papers', '1. Upload PDF exactly 10MB', 'file: "paper.pdf" (10MB)', 'File accepted', 'Medium', 'Boundary');
tc(p, 'Papers - upload 10MB + 1 byte PDF', 'User is on /papers', '1. Upload PDF > 10MB', 'file: "paper.pdf" (10MB + 1byte)', 'Error: file size exceeds 10MB limit', 'Medium', 'Boundary');
tc(p, 'Papers - create paper - missing title', 'User is on /papers; uploaded file', '1. Leave title blank\n2. Click "Confirm & Submit"', 'title: ""', 'Error: "Title is required"', 'High', 'Negative');
tc(p, 'Papers - create paper - missing abstract', 'User is on /papers', '1. Enter title\n2. Leave abstract blank\n3. Submit', 'abstract: ""', 'Error: "Abstract is required"', 'High', 'Negative');
tc(p, 'Papers - create paper - no fields selected', 'User is on /papers', '1. Fill title and abstract\n2. Do not select fields\n3. Submit', 'selectedFields: []', 'Error: "At least one field must be selected"', 'High', 'Negative');
tc(p, 'Papers - abstract word limit 500', 'User is on /papers', '1. Enter exactly 500 words in abstract', 'abstract: 500 words', 'Abstract accepted', 'Medium', 'Boundary');
tc(p, 'Papers - abstract word limit 501', 'User is on /papers', '1. Enter 501 words in abstract', 'abstract: 501 words', 'Error: "Abstract exceeds 500 words"', 'Medium', 'Boundary');
tc(p, 'Papers - create paper - valid data', 'User is on /papers', '1. Fill title, abstract, select fields\n2. Submit', 'title: "Quantum Research", abstract: "valid", fields: ["Physics"]', 'Paper created; success toast; listed in "Waiting"', 'High', 'Positive');
tc(p, 'Papers - edit paper', 'User is on /papers; created paper', '1. Click "Edit" on a paper\n2. Modify title\n3. Click "Save"', 'title: "Updated Title"', 'Paper updated; reflected in list', 'High', 'Positive');
tc(p, 'Papers - delete paper with confirmation', 'User is on /papers; created paper', '1. Click "Delete" on paper\n2. Confirm in dialog', 'paperId: 123', 'Paper removed; success toast', 'High', 'Positive');
tc(p, 'Papers - delete paper cancel', 'User is on /papers', '1. Click "Delete" on paper\n2. Cancel in dialog', 'no input data', 'Paper remains; no change', 'Medium', 'Negative');
tc(p, 'Papers - upload preview phase', 'User is on /papers', '1. Upload PDF\n2. View preview', 'file: "paper.pdf"', 'Preview frame shows PDF content', 'Medium', 'Positive');
tc(p, 'Papers - preview to confirm to delete flow', 'User is on /papers', '1. Upload PDF\n2. Click "Confirm"\n3. Click "Delete"', 'no input data', 'All phases work; file removed', 'Low', 'Integration');
tc(p, 'Papers - Firebase upload path', 'User is on /papers', '1. Upload PDF', 'file: "paper.pdf"', 'File uploaded to Firebase at "papers/{timestamp}_{filename}"', 'Medium', 'Integration');
tc(p, 'Papers - auto-dismiss toast', 'User is on /papers', '1. Trigger any success action', 'no input data', 'Toast disappears after 2 seconds', 'Low', 'Positive');
tc(p, 'Papers - 401 response from BE', 'User is on /papers; token expired', '1. Load page', 'expired token', 'Redirects to /login (axios interceptor)', 'High', 'Integration');
tc(p, 'Papers - pagination', 'User is on /papers; many papers', '1. Click next page', 'pageNumber: 2', 'Second page of papers loaded', 'Medium', 'Positive');
tc(p, 'Papers - search by title', 'User is on /papers', '1. Enter search query', 'query: "Quantum"', 'Filtered papers matching title', 'Medium', 'Positive');
tc(p, 'Papers - error loading papers', 'User is on /papers; BE down', '1. Load page', 'no input data', 'Error toast shown; retry option', 'High', 'Negative');
tc(p, 'Papers - loading state', 'User is on /papers; BE slow', '1. Load page', 'no input data', 'Loading spinner shown', 'Medium', 'Positive');
tc(p, 'Papers - upload progress', 'User is on /papers', '1. Upload large PDF', 'file: "paper.pdf" (5MB)', 'Progress bar updates during upload', 'Low', 'Positive');

// ----------------------------------------------------------------------------
// RESEARCHER MODULE — src/pages/Researcher (DiscoverReviewers)
// ----------------------------------------------------------------------------
const rsch = 'Researcher';
tc(rsch, 'Discover Reviewers - load list', 'User is on /reviewers', '1. Navigate to /reviewers', 'no input data', 'List of reviewers loaded from /api/ProfessionalProfile', 'High', 'Positive');
tc(rsch, 'Discover Reviewers - empty list', 'User is on /reviewers; no reviewers', '1. Load page', 'no input data', 'Empty state shown', 'Medium', 'Negative');
tc(rsch, 'Discover Reviewers - switch to Requests tab', 'User is on /reviewers', '1. Click "Requests" tab', 'no input data', 'My review requests are shown', 'High', 'Positive');
tc(rsch, 'Discover Reviewers - send request to reviewer', 'User is on /reviewers; sufficient wallet', '1. Select paper\n2. Select reviewer\n3. Accept policy\n4. Click "Send Request"', 'paperId: 1, reviewerId: 2, fee: 250000', 'Request created; wallet deducted; success toast', 'High', 'Positive');
tc(rsch, 'Discover Reviewers - no paper selected', 'User is on /reviewers', '1. Click "Send Request" without selecting paper', 'selectedPaperId: null', 'Error: "Please select a paper"', 'High', 'Negative');
tc(rsch, 'Discover Reviewers - insufficient wallet', 'User is on /reviewers; wallet=0', '1. Select paper and reviewer\n2. Click "Send Request"', 'walletBalance: 0, fee: 250000', 'Disabled button; "Add Fund to Wallet" CTA shown', 'High', 'Negative');
tc(rsch, 'Discover Reviewers - wallet exactly matches fee', 'User is on /reviewers; wallet=250000', '1. Send request with fee=250000', 'walletBalance: 250000, fee: 250000', 'Request succeeds; wallet becomes 0', 'Medium', 'Boundary');
tc(rsch, 'Discover Reviewers - policy not accepted', 'User is on /reviewers', '1. Select paper and reviewer\n2. Do not check policy\n3. Click "Send Request"', 'acceptedPolicy: false', 'Send button disabled; tooltip shown', 'High', 'Negative');
tc(rsch, 'Discover Reviewers - fee calculation', 'User is on /reviewers', '1. View reviewer card', 'reviewerFee: 225000', 'Shown: total fee = 225000 + 25000 = 250000', 'High', 'Positive');
tc(rsch, 'Discover Reviewers - notes maxLength 500', 'User is on /reviewers', '1. Enter 500 chars in notes', 'notes: "a" * 500', 'Notes accepted', 'Medium', 'Boundary');
tc(rsch, 'Discover Reviewers - notes maxLength 501', 'User is on /reviewers', '1. Enter 501 chars in notes', 'notes: "a" * 501', 'Character limit enforced; input blocked', 'Medium', 'Boundary');
tc(rsch, 'Discover Reviewers - refresh button', 'User is on /reviewers', '1. Click "Refresh"', 'no input data', 'List reloaded from API', 'Medium', 'Positive');
tc(rsch, 'Discover Reviewers - duplicate request', 'User is on /reviewers; already has request', '1. Send same request again', 'paperId: 1, reviewerId: 2', 'BE returns 400; error toast shown', 'Medium', 'Negative');
tc(rsch, 'Discover Reviewers - shortfall display', 'User is on /reviewers; wallet=100000', '1. View "Add Fund" button', 'walletBalance: 100000, fee: 250000', 'Shortfall displayed: "You need 150,000 more"', 'Medium', 'Positive');
tc(rsch, 'Discover Reviewers - TopUpModal opens', 'User is on /reviewers; insufficient wallet', '1. Click "Add Fund to Wallet"', 'no input data', 'TopUpModal opens with isOpen=true', 'High', 'Positive');
tc(rsch, 'Discover Reviewers - onSuccess callback', 'User is on /reviewers; TopUpModal open', '1. Call onSuccess(500000)', 'amount: 500000', 'Modal closes; wallet updated to 500000', 'High', 'Integration');
tc(rsch, 'Discover Reviewers - 3 seeded reviewers', 'User is on /reviewers', '1. Load page', 'no input data', '3 reviewers shown (Dr. Nguyen, Dr. Tran, Dr. Le)', 'Medium', 'Positive');
tc(rsch, 'Discover Reviewers - filter by ORCID', 'User is on /reviewers', '1. Sort/filter by ORCID presence', 'no input data', 'Reviewers with ORCID shown first', 'Low', 'Positive');
tc(rsch, 'Discover Reviewers - request pending state', 'User is on /reviewers; requests tab', '1. View request list', 'status: "Pending"', 'Badge "Pending" displayed', 'Medium', 'Positive');
tc(rsch, 'Discover Reviewers - request accepted', 'User is on /reviewers; requests tab', '1. View request', 'status: "Accepted"', 'Badge "Accepted" displayed', 'Medium', 'Positive');
tc(rsch, 'Discover Reviewers - network error', 'User is on /reviewers; BE down', '1. Load page', 'no input data', 'Error toast shown', 'High', 'Negative');
tc(rsch, 'Discover Reviewers - request after deletion', 'User is on /reviewers; previous request was deleted', '1. Send same request again', 'no input data', 'Request succeeds', 'Medium', 'Integration');
tc(rsch, 'Discover Reviewers - wallet audit in localStorage', 'User is on /reviewers', '1. Send request', 'walletBalance: 500000, fee: 250000', 'ars_wallet in localStorage updated to 250000', 'Medium', 'Integration');
tc(rsch, 'Discover Reviewers - custom fee input', 'User is on /reviewers', '1. Enter custom fee', 'fee: 300000', 'Custom fee used instead of calculated', 'Medium', 'Positive');
tc(rsch, 'Discover Reviewers - deadline selection', 'User is on /reviewers', '1. Select deadline date', 'deadline: "2026-12-31"', 'Deadline saved with request', 'Medium', 'Positive');
tc(rsch, 'Discover Reviewers - empty notes', 'User is on /reviewers', '1. Leave notes blank\n2. Submit', 'notes: ""', 'Request succeeds (notes optional)', 'Medium', 'Positive');

// ----------------------------------------------------------------------------
// REVIEWER MODULE — src/pages/Reviewer (EvaluationDesk, AssignedReviews, EarningsWallet)
// ----------------------------------------------------------------------------
const rev = 'Reviewer';
tc(rev, 'Assigned Reviews - load pending tasks', 'User is on /review-tasks', '1. Click "Pending" tab', 'no input data', 'Pending review requests shown', 'High', 'Positive');
tc(rev, 'Assigned Reviews - load in-progress tasks', 'User is on /review-tasks', '1. Click "In Progress" tab', 'no input data', 'In-progress tasks shown', 'High', 'Positive');
tc(rev, 'Assigned Reviews - load completed tasks', 'User is on /review-tasks', '1. Click "Completed" tab', 'no input data', 'Completed tasks shown', 'High', 'Positive');
tc(rev, 'Assigned Reviews - filter by current user', 'User is on /review-tasks', '1. Load page', 'currentUserId: 5', 'Only tasks where reviewerId=5 are shown', 'High', 'Integration');
tc(rev, 'Assigned Reviews - deadline warning (1 day)', 'User is on /review-tasks; task with deadline tomorrow', '1. View task list', 'deadline: tomorrow', 'Deadline displayed in orange tone', 'Medium', 'Positive');
tc(rev, 'Assigned Reviews - deadline no deadline', 'User is on /review-tasks; task without deadline', '1. View task list', 'deadline: null', 'Display: "No deadline set"', 'Medium', 'Negative');
tc(rev, 'Assigned Reviews - status normalization', 'User is on /review-tasks', '1. Load page', 'status: "in-progress" or "in progress" or "inprogress"', 'All variants map to "inprogress" tab', 'Medium', 'Integration');
tc(rev, 'Assigned Reviews - status "completed" variants', 'User is on /review-tasks', '1. Load page', 'status: "completed" or "complete" or "done"', 'All variants map to "completed" tab', 'Medium', 'Integration');
tc(rev, 'Evaluation - pre-fill from existing', 'User is on /evaluation; existing draft', '1. Load page', 'existing evaluation: { originality: 4, ... }', 'Form pre-filled with existing values', 'High', 'Positive');
tc(rev, 'Evaluation - score 1-5 for each criterion', 'User is on /evaluation', '1. Enter scores 1-5 for all 5 criteria\n2. Add notes\n3. Submit', 'originality: 4, literature: 5, methodology: 3, results: 4, formatting: 5', 'Evaluation saved; status updated to Completed', 'High', 'Positive');
tc(rev, 'Evaluation - score 0 invalid', 'User is on /evaluation', '1. Enter score 0', 'originality: 0', 'Error: "Score must be between 1 and 5"', 'High', 'Negative');
tc(rev, 'Evaluation - score 6 invalid', 'User is on /evaluation', '1. Enter score 6', 'originality: 6', 'Error: "Score must be between 1 and 5"', 'High', 'Negative');
tc(rev, 'Evaluation - final decision Accept', 'User is on /evaluation', '1. Select "Accept"\n2. Submit', 'finalDecision: "Accept"', 'ReviewRequest status updated to "Completed"', 'High', 'Positive');
tc(rev, 'Evaluation - final decision Minor Revision', 'User is on /evaluation', '1. Select "Minor Revision"\n2. Submit', 'finalDecision: "Minor Revision"', 'Decision saved', 'Medium', 'Positive');
tc(rev, 'Evaluation - final decision Major Revision', 'User is on /evaluation', '1. Select "Major Revision"\n2. Submit', 'finalDecision: "Major Revision"', 'Decision saved', 'Medium', 'Positive');
tc(rev, 'Evaluation - final decision Reject', 'User is on /evaluation', '1. Select "Reject"\n2. Submit', 'finalDecision: "Reject"', 'Decision saved', 'High', 'Positive');
tc(rev, 'Evaluation - missing general comments', 'User is on /evaluation', '1. Leave generalComments blank\n2. Submit', 'generalComments: ""', 'Error: "General comments required"', 'High', 'Negative');
tc(rev, 'Evaluation - save draft', 'User is on /evaluation', '1. Fill partial form\n2. Click "Save Draft"', 'partial data', 'Draft saved; can resume later', 'Medium', 'Positive');
tc(rev, 'Evaluation - submit final feedback', 'User is on /evaluation', '1. Fill complete form\n2. Click "Submit Final Feedback"', 'complete evaluation', 'Evaluation submitted; cannot edit', 'High', 'Positive');
tc(rev, 'Evaluation - no paper data', 'User is on /evaluation; paperId missing', '1. Load page', 'paperId: null', 'Error state shown', 'High', 'Negative');
tc(rev, 'Evaluation - API error on submit', 'User is on /evaluation; BE down', '1. Submit form', 'no input data', 'Error toast; form remains editable', 'High', 'Negative');
tc(rev, 'Evaluation - PDF viewer renders', 'User is on /evaluation', '1. Load page', 'pdfUrl: "https://firebasestorage..."', 'PDF viewer displays paper', 'High', 'Integration');
tc(rev, 'Evaluation - PDF viewer scale min 0.5', 'User is on /evaluation', '1. Zoom out repeatedly', 'no input data', 'Scale clamped at 0.5', 'Medium', 'Boundary');
tc(rev, 'Evaluation - PDF viewer scale max 3.0', 'User is on /evaluation', '1. Zoom in repeatedly', 'no input data', 'Scale clamped at 3.0', 'Medium', 'Boundary');
tc(rev, 'Evaluation - PDF viewer navigation', 'User is on /evaluation', '1. Press arrow keys', 'no input data', 'Page changes left/right', 'Low', 'Positive');
tc(rev, 'Evaluation - PDF viewer invalid page', 'User is on /evaluation', '1. Type 999 in page input', 'page: 999', 'Page clamped to totalPages', 'Medium', 'Negative');
tc(rev, 'Evaluation - PDF viewer negative page', 'User is on /evaluation', '1. Type -1 in page input', 'page: -1', 'Page clamped to 1', 'Medium', 'Negative');
tc(rev, 'Evaluation - PDF viewer Firebase URL detection', 'User is on /evaluation', '1. Load with Firebase URL', 'url: "https://firebasestorage.googleapis.com/..."', 'PDF loads correctly', 'Medium', 'Integration');
tc(rev, 'Evaluation - scorecard modal opens', 'User is on /evaluation', '1. Click "Scorecard" button', 'no input data', 'ScorecardModal opens with rubric', 'Medium', 'Positive');
tc(rev, 'Evaluation - update existing evaluation', 'User is on /evaluation; existing draft', '1. Modify scores\n2. Click "Update"', 'modified scores', 'Existing evaluation updated', 'High', 'Positive');

// Earnings Wallet (Reviewer)
tc(rev, 'Wallet - load default balance', 'User is on /earnings-wallet; no data', '1. Load page', 'no input data', 'Balance: 4,200,000 VND; Pending: 500,000', 'High', 'Positive');
tc(rev, 'Wallet - load saved balance', 'User is on /earnings-wallet; ars_reviewer_balance set', '1. Load page', 'ars_reviewer_balance: 5000000', 'Balance shows 5,000,000 VND', 'High', 'Positive');
tc(rev, 'Wallet - open withdraw modal', 'User is on /earnings-wallet', '1. Click "Withdraw"', 'no input data', 'Withdraw modal opens', 'High', 'Positive');
tc(rev, 'Wallet - withdraw amount zero', 'User is on /earnings-wallet', '1. Enter amount 0\n2. Submit', 'amount: 0', 'Error: "Amount must be greater than 0"', 'High', 'Negative');
tc(rev, 'Wallet - withdraw negative amount', 'User is on /earnings-wallet', '1. Enter -1000\n2. Submit', 'amount: -1000', 'Error: "Invalid amount"', 'High', 'Negative');
tc(rev, 'Wallet - withdraw amount > balance', 'User is on /earnings-wallet', '1. Enter 5000000 (balance=4200000)\n2. Submit', 'amount: 5000000', 'Error: "Amount exceeds available balance"', 'High', 'Negative');
tc(rev, 'Wallet - withdraw amount = balance', 'User is on /earnings-wallet', '1. Enter 4200000\n2. Submit', 'amount: 4200000, balance: 4200000', 'Withdraw succeeds; balance becomes 0', 'Medium', 'Boundary');
tc(rev, 'Wallet - withdraw with valid account', 'User is on /earnings-wallet', '1. Select bank\n2. Enter account 101299482103\n3. Enter amount 100000\n4. Submit', 'accountNumber: "101299482103", amount: 100000', 'Withdraw succeeds; balance updated', 'High', 'Positive');
tc(rev, 'Wallet - withdraw invalid account', 'User is on /earnings-wallet', '1. Enter account "123456789"\n2. Submit', 'accountNumber: "123456789"', 'Error: "Account verification failed"', 'High', 'Negative');
tc(rev, 'Wallet - bank selection', 'User is on /earnings-wallet', '1. Open bank dropdown', 'no input data', '3 banks listed', 'Medium', 'Positive');
tc(rev, 'Wallet - no bank selected', 'User is on /earnings-wallet', '1. Do not select bank\n2. Submit', 'targetBank: null', 'Error: "Please select a bank"', 'High', 'Negative');
tc(rev, 'Wallet - empty account number', 'User is on /earnings-wallet', '1. Leave account blank\n2. Submit', 'accountNumber: ""', 'Error: "Account number required"', 'High', 'Negative');
tc(rev, 'Wallet - withdrawal reason modal', 'User is on /earnings-wallet', '1. Trigger rejection flow', 'no input data', 'Rejection reason modal opens', 'Medium', 'Positive');
tc(rev, 'Wallet - balance update on submit', 'User is on /earnings-wallet', '1. Submit withdrawal', 'oldBalance: 4200000, amount: 100000', 'ars_reviewer_balance=4100000, ars_wallet updated, wallet-update event dispatched', 'High', 'Integration');
tc(rev, 'Wallet - pending holds display', 'User is on /earnings-wallet', '1. Load page', 'pendingHolds: 500000', 'Pending holds displayed: 500,000 VND', 'Medium', 'Positive');
tc(rev, 'Wallet - narrative field', 'User is on /earnings-wallet', '1. Enter narrative', 'narrative: "Monthly salary"', 'Narrative saved with withdrawal', 'Low', 'Positive');
tc(rev, 'Wallet - amount input type=number', 'User is on /earnings-wallet', '1. View amount field', 'no input data', 'Input type is "number"; max=unlockedBalance', 'Medium', 'Positive');
tc(rev, 'Wallet - insufficient funds messaging', 'User is on /earnings-wallet; balance=0', '1. Load page', 'balance: 0', 'Message: "No funds available"', 'Medium', 'Negative');
tc(rev, 'Wallet - both storages updated', 'User is on /earnings-wallet', '1. Withdraw', 'amount: 100000', 'Both ars_reviewer_balance and ars_wallet updated; wallet-update event fires', 'Medium', 'Integration');
tc(rev, 'Wallet - max attribute equals balance', 'User is on /earnings-wallet; balance=4200000', '1. View amount field', 'no input data', 'max attribute = 4200000', 'Medium', 'Boundary');

// ----------------------------------------------------------------------------
// LECTURER MODULE — src/pages/Lecturer (ResearchGroup, ConfigureMilestones, SeminarWorkspace)
// ----------------------------------------------------------------------------
const l = 'Lecturer';
tc(l, 'Research Group - create group empty name', 'User is on /research-group', '1. Click "Create Group"\n2. Leave name blank\n3. Submit', 'groupName: ""', 'Error: "Group name required"', 'High', 'Negative');
tc(l, 'Research Group - create group valid', 'User is on /research-group', '1. Enter name, topic, desc\n2. Submit', 'groupName: "AI Research", groupTopic: "ML", groupDesc: "x"', 'Group created; appears in list', 'High', 'Positive');
tc(l, 'Research Group - add member email', 'User is on /research-group', '1. Enter email\n2. Press Enter', 'email: "member@example.com"', 'Email added to groupEmails array', 'Medium', 'Positive');
tc(l, 'Research Group - duplicate email blocked', 'User is on /research-group', '1. Add email "x@y.com"\n2. Add same email again', 'email: "x@y.com"', 'Duplicate rejected; not added twice', 'Medium', 'Negative');
tc(l, 'Research Group - invalid email', 'User is on /research-group', '1. Enter "notanemail"\n2. Press Enter', 'email: "notanemail"', 'Error: "Invalid email format"', 'Medium', 'Negative');
tc(l, 'Research Group - remove member', 'User is on /research-group', '1. Click X on email', 'email: "x@y.com"', 'Email removed from groupEmails', 'Medium', 'Positive');
tc(l, 'Research Group - create topic', 'User is on /research-group', '1. Click "Add Topic"\n2. Fill topic form\n3. Submit', 'topicName: "ML Research", topicDesc: "x"', 'Topic created and linked to group', 'High', 'Positive');
tc(l, 'Research Group - topic empty name', 'User is on /research-group', '1. Click "Add Topic"\n2. Leave topicName blank\n3. Submit', 'topicName: ""', 'Error: "Topic name required"', 'High', 'Negative');
tc(l, 'Research Group - assign topic to groups', 'User is on /research-group', '1. Click "Assign" on topic\n2. Check groups\n3. Submit', 'groups: [1, 2]', 'Topic assigned to selected groups', 'High', 'Positive');
tc(l, 'Research Group - assign with no groups', 'User is on /research-group', '1. Click "Assign" on topic\n2. Do not check any group\n3. Submit', 'selectedGroups: []', 'Defaults to "Unassigned"', 'Medium', 'Negative');
tc(l, 'Research Group - attach materials', 'User is on /research-group', '1. Click "Add Topic"\n2. Add materials\n3. Submit', 'attachedMaterials: ["resource.pdf"]', 'Materials attached to topic', 'Medium', 'Positive');
tc(l, 'Configure Milestones - select phase', 'User is on /configure-milestones', '1. Click phase dropdown', 'no input data', '4 phases shown', 'Medium', 'Positive');
tc(l, 'Configure Milestones - empty description', 'User is on /configure-milestones', '1. Leave description blank\n2. Click "Publish"', 'description: ""', 'Error: "Description required"', 'High', 'Negative');
tc(l, 'Configure Milestones - description 8000 chars', 'User is on /configure-milestones', '1. Enter 8000 chars', 'description: "a" * 8000', 'Description accepted', 'Medium', 'Boundary');
tc(l, 'Configure Milestones - description 8001 chars', 'User is on /configure-milestones', '1. Enter 8001 chars', 'description: "a" * 8001', 'Character limit enforced', 'Medium', 'Boundary');
tc(l, 'Configure Milestones - due date empty', 'User is on /configure-milestones', '1. Leave dueDate blank\n2. Publish', 'dueDate: ""', 'Error: "Due date required"', 'High', 'Negative');
tc(l, 'Configure Milestones - add file', 'User is on /configure-milestones', '1. Click "Add File"\n2. Use prompt() input', 'fileName: "milestone.pdf"', 'File added to uploadedFiles', 'Medium', 'Positive');
tc(l, 'Configure Milestones - publish valid', 'User is on /configure-milestones', '1. Fill all fields\n2. Click "Publish"', 'phase: "Phase 1", desc: "x", dueDate: "2026-12-31"', 'Milestone published', 'High', 'Positive');
tc(l, 'Seminar Workspace - create seminar', 'User is on /seminar-workspace', '1. Click "New Seminar"\n2. Fill form\n3. Submit', 'seminarName: "AI Talk", dateTime: "2026-12-01T10:00", details: "x"', 'Seminar created with generated Meet link', 'High', 'Positive');
tc(l, 'Seminar Workspace - empty seminar name', 'User is on /seminar-workspace', '1. Leave seminarName blank\n2. Submit', 'seminarName: ""', 'Error: "Seminar name required"', 'High', 'Negative');
tc(l, 'Seminar Workspace - add guest email', 'User is on /seminar-workspace', '1. Enter guest email\n2. Press Enter', 'guestEmail: "guest@example.com"', 'Email added to guestEmails', 'Medium', 'Positive');
tc(l, 'Seminar Workspace - send reminder', 'User is on /seminar-workspace', '1. Check "Send reminder"\n2. Submit', 'sendReminder: true', 'Reminder scheduled', 'Medium', 'Positive');
tc(l, 'Seminar Workspace - drafts tab empty', 'User is on /seminar-workspace', '1. Click "Drafts" tab', 'no input data', 'Empty state shown (hardcoded)', 'Low', 'Negative');
tc(l, 'Seminar Workspace - AI summarizer step 1', 'User is on /seminar-workspace', '1. Click "AI Summarize"\n2. Upload file', 'file: "notes.pdf"', 'Step 1 shows upload', 'Medium', 'Positive');
tc(l, 'Seminar Workspace - AI summarizer step 2', 'User is on /seminar-workspace', '1. Click "AI Summarize"\n2. Upload then process', 'processed file', 'Step 2 shows summary', 'Medium', 'Positive');

// ----------------------------------------------------------------------------
// GRADUATE STUDENT MODULE — src/pages/GraduateStudent (SubmitReport, StudentResearchGroups)
// ----------------------------------------------------------------------------
const gs = 'GraduateStudent';
tc(gs, 'Student Research Groups - load list', 'User is on /student/research-groups', '1. Load page', 'no input data', 'Groups list displayed', 'High', 'Positive');
tc(gs, 'Student Research Groups - search', 'User is on /student/research-groups', '1. Enter search text', 'searchText: "AI"', 'Filtered groups shown', 'Medium', 'Positive');
tc(gs, 'Student Research Groups - filter status', 'User is on /student/research-groups', '1. Select status filter', 'statusFilter: "Active"', 'Groups filtered by status', 'Medium', 'Positive');
tc(gs, 'Student Research Groups - switch to workspace', 'User is on /student/research-groups', '1. Click "Open" on group', 'groupId: 1', 'viewMode = "workspace"', 'Medium', 'Positive');
tc(gs, 'Submit Report - file required', 'User is on /submit-report', '1. Click "Submit" without file', 'file: null', 'Error: "File required"', 'High', 'Negative');
tc(gs, 'Submit Report - upload PDF', 'User is on /submit-report', '1. Upload PDF', 'file: "report.pdf"', 'File accepted', 'High', 'Positive');
tc(gs, 'Submit Report - upload DOCX', 'User is on /submit-report', '1. Upload DOCX', 'file: "report.docx"', 'File accepted', 'Medium', 'Positive');
tc(gs, 'Submit Report - upload non-PDF/DOCX', 'User is on /submit-report', '1. Upload image', 'file: "image.jpg"', 'Error: "Unsupported file type"', 'High', 'Negative');
tc(gs, 'Submit Report - file 25MB boundary', 'User is on /submit-report', '1. Upload 25MB file', 'file: size=25MB', 'File accepted', 'Medium', 'Boundary');
tc(gs, 'Submit Report - file 26MB rejected', 'User is on /submit-report', '1. Upload 26MB file', 'file: size=26MB', 'Error: "File too large"', 'Medium', 'Boundary');
tc(gs, 'Submit Report - notes field', 'User is on /submit-report', '1. Enter notes\n2. Submit', 'notes: "See attached"', 'Notes saved with submission', 'Medium', 'Positive');
tc(gs, 'Submit Report - successful submit', 'User is on /submit-report', '1. Upload file\n2. Add notes\n3. Submit', 'complete data', 'Submission successful; status updated', 'High', 'Positive');
tc(gs, 'Student Research Groups - submit topic', 'User is on /student/research-groups', '1. Click "Submit" on topic\n2. Upload file\n3. Add notes', 'complete data', 'Topic status changes to "Submitted"', 'High', 'Integration');
tc(gs, 'Student Research Groups - view lecturer notes', 'User is on /student/research-groups', '1. View topic', 'lecturerNotes: "x"', 'Notes displayed', 'Medium', 'Positive');
tc(gs, 'Student Research Groups - PDF dropzone click only', 'User is on /student/research-groups', '1. Click dropzone', 'no input data', 'File picker opens (no drag-drop)', 'Low', 'Negative');

// ----------------------------------------------------------------------------
// ADMIN MODULE — src/pages/Admin (AdminDashboard)
// ----------------------------------------------------------------------------
const ad = 'Admin';
tc(ad, 'Admin - non-admin user redirect', 'User is on /admin; role != admin', '1. Navigate to /admin', 'user.roleName: "Researcher"', 'Redirects to /forum', 'High', 'Negative');
tc(ad, 'Admin - admin user access', 'User is on /admin; role = admin', '1. Navigate to /admin', 'user.roleName: "Admin"', 'Admin dashboard renders', 'High', 'Positive');
tc(ad, 'Admin - dashboard placeholder', 'User is on /admin', '1. Load page', 'no input data', 'Placeholder content shown', 'Medium', 'Positive');
tc(ad, 'Admin - no admin role in token', 'User is on /admin', '1. Load page', 'token: undefined', 'Redirects to /login', 'High', 'Negative');
tc(ad, 'Admin - role check on direct URL', 'User is on /admin', '1. Type URL directly', 'no role match', 'Auth guard blocks access', 'High', 'Integration');

// ----------------------------------------------------------------------------
// SHARED MODULE — cross-role (Dashboard, Forum, Profile)
// ----------------------------------------------------------------------------
const sh = 'Shared';
tc(sh, 'Forum - load All Posts', 'User is on /forum', '1. Click "All Posts" tab', 'no input data', 'All posts displayed', 'High', 'Positive');
tc(sh, 'Forum - load My Posts', 'User is on /forum', '1. Click "My Posts" tab', 'no input data', 'Posts by current user shown', 'High', 'Positive');
tc(sh, 'Forum - load Following', 'User is on /forum', '1. Click "Following" tab', 'no input data', 'Posts from followed users shown', 'High', 'Positive');
tc(sh, 'Forum - sort Newest', 'User is on /forum', '1. Select "Newest"', 'no input data', 'Posts sorted by createdAt desc', 'Medium', 'Positive');
tc(sh, 'Forum - sort Most Discussed', 'User is on /forum', '1. Select "Most Discussed"', 'no input data', 'Posts sorted by comment count desc', 'Medium', 'Positive');
tc(sh, 'Forum - sort Most Viewed', 'User is on /forum', '1. Select "Most Viewed"', 'no input data', 'Posts sorted by view count desc', 'Medium', 'Positive');
tc(sh, 'Forum - create post empty content', 'User is on /forum', '1. Click "Create Post"\n2. Click "Submit" with empty content', 'postContent: ""', 'Error: "Content is required"', 'High', 'Negative');
tc(sh, 'Forum - create post with content', 'User is on /forum', '1. Enter content\n2. Click "Submit"', 'postContent: "My research findings"', 'Post created; appears in list', 'High', 'Positive');
tc(sh, 'Forum - create post with tags', 'User is on /forum', '1. Enter content + tags\n2. Submit', 'postContent: "x", postTags: ["ai", "research"]', 'Post created with tags', 'Medium', 'Positive');
tc(sh, 'Forum - attach PDF to post', 'User is on /forum', '1. Click "Attach PDF"\n2. Select PDF', 'file: "doc.pdf"', 'PDF attached to post', 'Medium', 'Positive');
tc(sh, 'Forum - attach non-PDF rejected', 'User is on /forum', '1. Click "Attach PDF"\n2. Select "image.jpg"', 'file: "image.jpg"', 'Error: "Only PDF allowed"', 'Medium', 'Negative');
tc(sh, 'Forum - attach image to post', 'User is on /forum', '1. Click "Attach Image"\n2. Select image', 'file: "photo.png"', 'Image attached', 'Medium', 'Positive');
tc(sh, 'Forum - attach non-image rejected', 'User is on /forum', '1. Click "Attach Image"\n2. Select PDF', 'file: "doc.pdf"', 'Error: "Only images allowed"', 'Medium', 'Negative');
tc(sh, 'Forum - follow user', 'User is on /forum', '1. Click "Follow" on a post', 'userId: 5', 'User followed; button changes to "Unfollow"', 'Medium', 'Positive');
tc(sh, 'Forum - unfollow user', 'User is on /forum', '1. Click "Unfollow" on a post', 'userId: 5', 'User unfollowed', 'Medium', 'Positive');
tc(sh, 'Forum - filter by tag', 'User is on /forum', '1. Click a tag on a post', 'tag: "ai"', 'Posts filtered by "ai" tag', 'Medium', 'Positive');
tc(sh, 'Forum - infinite scroll', 'User is on /forum; many posts', '1. Scroll to bottom', 'no input data', 'More posts loaded', 'Low', 'Positive');
tc(sh, 'Forum - empty posts', 'User is on /forum; no posts', '1. Load page', 'no input data', 'Empty state shown', 'Medium', 'Negative');
tc(sh, 'Forum - search posts', 'User is on /forum', '1. Enter search query', 'query: "machine learning"', 'Posts filtered by query', 'Medium', 'Positive');
tc(sh, 'Forum - post detail view', 'User is on /forum', '1. Click a post', 'postId: 1', 'Post detail page opens', 'High', 'Positive');
tc(sh, 'Forum - comment on post', 'User is on /forum', '1. Open post detail\n2. Enter comment\n3. Submit', 'comment: "Great work!"', 'Comment added', 'Medium', 'Positive');
tc(sh, 'Forum - like post', 'User is on /forum', '1. Click "Like" on post', 'postId: 1', 'Like count incremented', 'Medium', 'Positive');
tc(sh, 'Forum - unlike post', 'User is on /forum', '1. Click "Unlike" on post', 'postId: 1', 'Like count decremented', 'Medium', 'Positive');
tc(sh, 'Forum - max authors in My Posts', 'User is on /forum', '1. Click "My Posts"', 'no input data', 'Only posts by "Dr. Nguyen Van A" shown (hardcoded)', 'Low', 'Integration');

tc(sh, 'Dashboard - role-based layout', 'User is on /dashboard', '1. Set ars_active_role to "Researcher"', 'role: "Researcher"', 'Researcher layout rendered', 'High', 'Integration');
tc(sh, 'Dashboard - Lecturer layout', 'User is on /dashboard', '1. Set ars_active_role to "Lecturer"', 'role: "Lecturer"', 'Lecturer layout rendered', 'High', 'Integration');
tc(sh, 'Dashboard - pollls localStorage', 'User is on /dashboard', '1. Change localStorage in another tab', 'ars_active_role: "Reviewer"', 'Layout updates within 500ms', 'Medium', 'Integration');

tc(sh, 'Profile - switch role to Researcher', 'User is on /profile', '1. Click "Roles" tab\n2. Select "Researcher"', 'newRole: "Researcher"', 'ars_active_role updated; UI updates', 'High', 'Positive');
tc(sh, 'Profile - switch role to Reviewer', 'User is on /profile', '1. Click "Roles" tab\n2. Select "Reviewer"', 'newRole: "Reviewer"', 'Role updated; wallet pages visible', 'High', 'Positive');
tc(sh, 'Profile - wallet tab deposit', 'User is on /profile', '1. Click "Wallet" tab\n2. Click "Deposit 500k"', 'no input data', 'Wallet balance increased by 500k', 'Medium', 'Positive');
tc(sh, 'Profile - security change password', 'User is on /profile', '1. Click "Security" tab\n2. Fill password fields\n3. Click "Change"', 'complete data', 'Alert shown (no real submit)', 'Low', 'Positive');
tc(sh, 'Profile - update info fields', 'User is on /profile', '1. Click "Info" tab\n2. Modify fields\n3. Save', 'fullName: "x", keywords: ["ai"]', 'Profile updated', 'High', 'Positive');

// ----------------------------------------------------------------------------
// SERVICES MODULE — cross-cutting (all src/services/*)
// ----------------------------------------------------------------------------
const s = 'Services';
tc(s, 'Axios - attaches Bearer token', 'Request made with token in localStorage', '1. Make any API call with ars_token set', 'ars_token: "abc123"', 'Request includes Authorization: Bearer abc123', 'High', 'Integration');
tc(s, 'Axios - 401 response auto-logout', 'BE returns 401', '1. Make any API call; token expired', 'status: 401', 'Clears auth, redirects to /login', 'High', 'Integration');
tc(s, 'Axios - maps BE error message', 'BE returns 400 with message', '1. Make API call', 'response.data.message: "Email already exists"', 'Error message: "Email already exists"', 'High', 'Integration');
tc(s, 'Axios - timeout 60s', 'BE does not respond within 60s', '1. Make slow API call', 'timeout triggered', 'Error: "Request timed out. Please try again."', 'High', 'Integration');
tc(s, 'Axios - network error', 'BE is unreachable', '1. Make API call with no server', 'no response', 'Error: "Network error. Please check your connection."', 'High', 'Integration');
tc(s, 'Auth - login sends email field', 'User is on /login', '1. Submit login form', 'form field: "username"', 'API called with { email: "x", password: "y" }', 'High', 'Integration');
tc(s, 'Auth - token fallback', 'BE returns no token', '1. Login', 'response: { user: {...} }', 'Token generated: "ars-session-token-{timestamp}"', 'Medium', 'Integration');
tc(s, 'Auth - logout clears storage', 'User is logged in', '1. Click "Logout"', 'no input data', 'ars-auth-storage, ars_token, ars_user cleared from both localStorage and sessionStorage', 'High', 'Integration');
tc(s, 'Auth - getCurrentUser reads storage', 'User is logged in', '1. Call getCurrentUser()', 'ars_user: "{...}"', 'Returns user object', 'Medium', 'Integration');
tc(s, 'Auth - registerUser payload', 'User is on /register', '1. Submit register form', 'username: "x", email: "y", fullName: "z", ...', 'POST /api/auth/register called with full payload', 'High', 'Integration');
tc(s, 'Paper - getAll with pagination', 'User is on /papers', '1. Load list', 'pageNumber: 1, pageSize: 10', 'API called with pagination params', 'High', 'Integration');
tc(s, 'Paper - getAll with status filter', 'User is on /papers', '1. Click "Waiting" tab', 'status: "Waiting"', 'API called with ?status=Waiting', 'High', 'Integration');
tc(s, 'Paper - getById', 'User clicks paper', '1. Click paper row', 'paperId: 1', 'GET /api/paper/1 called', 'High', 'Integration');
tc(s, 'Paper - create', 'User submits paper', '1. Submit form', 'title: "x", abstract: "y", fileUrl: "z"', 'POST /api/paper called', 'High', 'Integration');
tc(s, 'Paper - update', 'User edits paper', '1. Click "Edit"\n2. Save', 'paperId: 1, title: "updated"', 'PUT /api/paper/1 called', 'High', 'Integration');
tc(s, 'Paper - delete', 'User deletes paper', '1. Click "Delete"', 'paperId: 1', 'DELETE /api/paper/1 called', 'High', 'Integration');
tc(s, 'Reviewer - getAll', 'User is on /reviewers', '1. Load page', 'no input data', 'GET /api/ProfessionalProfile called', 'High', 'Integration');
tc(s, 'Reviewer - getById', 'User views reviewer profile', '1. Click reviewer', 'userId: 5', 'GET /api/ProfessionalProfile/5 called', 'Medium', 'Integration');
tc(s, 'Reviewer - update', 'User edits profile', '1. Submit edit form', 'userId: 5, hindex: 10', 'PUT /api/ProfessionalProfile/5 called', 'High', 'Integration');
tc(s, 'ReviewRequest - create', 'User sends request', '1. Submit request form', 'paperId: 1, reviewerId: 2, fee: 250000', 'POST /api/ReviewRequest called', 'High', 'Integration');
tc(s, 'ReviewRequest - getAll normalize id', 'User is on /reviewers; requests tab', '1. Load requests', 'no input data', 'API returns array; reviewRequestId mapped to id', 'High', 'Integration');
tc(s, 'ReviewRequest - update status', 'User submits evaluation', '1. Submit', 'reviewRequestId: 1, status: "Completed"', 'PUT /api/ReviewRequest/1 called', 'High', 'Integration');
tc(s, 'DetailedEvaluation - create', 'User submits new evaluation', '1. Submit form', 'reviewRequestId: 1, originality: 4, ...', 'POST /api/DetailedEvaluation called', 'High', 'Integration');
tc(s, 'DetailedEvaluation - update', 'User edits existing', '1. Modify and submit', 'evaluationId: 5', 'PUT /api/DetailedEvaluation/5 called', 'High', 'Integration');
tc(s, 'User - getAll', 'Admin fetches users', '1. Load users', 'pageNumber: 1', 'GET /api/user called', 'Medium', 'Integration');

// ----------------------------------------------------------------------------
// HOOKS MODULE — cross-cutting (useFetch, useDebounce, useFirebaseUpload)
// ----------------------------------------------------------------------------
const h = 'Hooks';
tc(h, 'useFetch - initial loading', 'useFetch called with URL', '1. Render component using useFetch', 'url: "/api/test"', 'loading=true, data=null, error=null', 'High', 'Positive');
tc(h, 'useFetch - successful load', 'useFetch called with URL', '1. Render component using useFetch', 'url: "/api/test"', 'loading=false, data={...}, error=null', 'High', 'Positive');
tc(h, 'useFetch - error state', 'useFetch called with bad URL', '1. Render component using useFetch', 'url: "/api/fail"', 'loading=false, data=null, error=Error', 'High', 'Negative');
tc(h, 'useFetch - refetch', 'useFetch called', '1. Call refetch()', 'no input data', 'API called again; data updated', 'High', 'Positive');
tc(h, 'useFetch - non-Error wrapped', 'useFetch receives string error', '1. Trigger error', 'error: "string error"', 'error becomes Error object', 'Medium', 'Negative');
tc(h, 'useFetch - immediate option false', 'useFetch called with immediate=false', '1. Render component', 'immediate: false', 'Not loaded; manual trigger required', 'Medium', 'Positive');
tc(h, 'useDebounce - initial value', 'useDebounce called', '1. Render with useDebounce("x", 500)', 'value: "x"', 'Returns "x" immediately', 'High', 'Positive');
tc(h, 'useDebounce - delays update', 'useDebounce called', '1. Change value\n2. Wait 500ms', 'value: "y"', 'Updates after 500ms', 'High', 'Positive');
tc(h, 'useDebounce - cleanup on unmount', 'useDebounce called', '1. Change value\n2. Unmount before 500ms', 'value: "y"', 'No update after unmount', 'Medium', 'Positive');
tc(h, 'useDebounce - custom delay', 'useDebounce called', '1. Set delay=1000', 'delay: 1000', 'Updates after 1000ms', 'Medium', 'Positive');
tc(h, 'useFirebaseUpload - upload PDF', 'useFirebaseUpload called', '1. Call uploadPdf(file)', 'file: "doc.pdf" (PDF, <10MB)', 'Progress updates; pdfUrl returned', 'High', 'Positive');
tc(h, 'useFirebaseUpload - non-PDF rejected', 'useFirebaseUpload called', '1. Call uploadPdf(image)', 'file: "image.jpg"', 'Error: "Only PDF allowed"', 'High', 'Negative');
tc(h, 'useFirebaseUpload - file > 10MB rejected', 'useFirebaseUpload called', '1. Call uploadPdf(large file)', 'file: 11MB', 'Error: "File exceeds 10MB"', 'High', 'Negative');
tc(h, 'useFirebaseUpload - cancel upload', 'useFirebaseUpload called', '1. Call uploadPdf\n2. Call cancel', 'no input data', 'Upload cancelled', 'Medium', 'Positive');
tc(h, 'useFirebaseUpload - sanitize filename', 'useFirebaseUpload called', '1. Upload file with special chars', 'filename: "my doc (1).pdf"', 'Stored as "my_doc__1_.pdf"', 'Low', 'Positive');

// ----------------------------------------------------------------------------
// ROUTING MODULE — cross-cutting
// ----------------------------------------------------------------------------
const r = 'Routing';
tc(r, 'PrivateRoute - unauthenticated', 'User is not authenticated', '1. Navigate to /forum', 'no token', 'Redirects to /login', 'High', 'Integration');
tc(r, 'PrivateRoute - authenticated', 'User is authenticated', '1. Navigate to /forum', 'token: "abc"', 'Forum page renders', 'High', 'Positive');
tc(r, 'PublicRoute - authenticated', 'User is authenticated', '1. Navigate to /login', 'token: "abc"', 'Redirects to /forum', 'High', 'Integration');
tc(r, 'PublicRoute - unauthenticated', 'User is not authenticated', '1. Navigate to /login', 'no token', 'Login page renders', 'High', 'Positive');
tc(r, 'Root redirect', 'User visits /', '1. Navigate to /', 'no input data', 'Redirects to /forum', 'High', 'Positive');
tc(r, 'Wildcard route', 'User visits unknown route', '1. Navigate to /unknown', 'no input data', 'Redirects to /login', 'High', 'Negative');
tc(r, 'Authenticated wildcard', 'User visits unknown route while authed', '1. Navigate to /unknown', 'token: "abc"', 'Redirects to /forum', 'High', 'Integration');
tc(r, 'Admin route guard', 'User with non-admin role', '1. Navigate to /admin', 'role: "Researcher"', 'Redirects to /forum', 'High', 'Integration');
tc(r, 'Auth persistence after refresh', 'User is logged in with remember me', '1. Refresh page', 'localStorage has ars_token', 'User remains authenticated', 'High', 'Integration');
tc(r, 'Auth cleared after logout', 'User logs out', '1. Click "Logout"\n2. Navigate to /forum', 'no input data', 'Redirects to /login', 'High', 'Integration');

// ----------------------------------------------------------------------------
// SHARED UI MODULE — Button, Input, Zustand store
// ----------------------------------------------------------------------------
const m = 'Shared';
tc(m, 'Button - disabled when loading', 'Button is rendered', '1. Click with isLoading=true', 'no input data', 'Button disabled; spinner shown', 'Medium', 'Positive');
tc(m, 'Button - click event', 'Button is rendered', '1. Click button', 'no input data', 'onClick fires', 'High', 'Positive');
tc(m, 'Input - error state', 'Input is rendered with error', '1. Pass error prop', 'error: "Required"', 'Error message shown', 'Medium', 'Positive');
tc(m, 'Input - helper text', 'Input is rendered', '1. Pass helperText prop', 'helperText: "Enter your email"', 'Helper text shown below input', 'Medium', 'Positive');
tc(m, 'Input - required field', 'Input is rendered', '1. Pass required prop', 'required: true', 'Asterisk shown; HTML required attribute set', 'Low', 'Positive');
tc(m, 'Zustand store - login', 'useAuthStore is used', '1. Call login(user, token)', 'user: {...}, token: "abc"', 'Store state updated; persists to localStorage', 'High', 'Integration');
tc(m, 'Zustand store - logout', 'useAuthStore is used', '1. Call logout()', 'no input data', 'Store state cleared; localStorage cleared', 'High', 'Integration');

console.log(`Total test cases generated: ${TEST_CASES.length}`);

// ============================================================================
// Excel generation (pure Node.js OOXML)
// ============================================================================

function colLetter(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function escapeXml(s) {
  if (s === null || s === undefined) return '';
  // " (34) and ' (39) are valid in XML text content, so we don't escape them.
  // Only the strictly required entities (&, <, >) are escaped.
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b val="true"/><sz val="12"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
    <font><b val="true"/><sz val="11"/><name val="Calibri"/><color rgb="FFE65100"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function buildSheetXml(rows) {
  const rowsXml = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const isHeader = r === 0;
    const styleAttr = isHeader ? ' s="1"' : '';
    const cells = [];
    for (let c = 0; c < row.length; c++) {
      const value = row[c];
      const ref = colLetter(c + 1) + (r + 1);
      const cellStyle = (!isHeader && c === 9) ? ' s="2"' : styleAttr;
      cells.push(
        `<c r="${ref}"${cellStyle} t="inlineStr" xml:space="preserve">` +
          `<is><t xml:space="preserve">${escapeXml(value)}</t></is>` +
          `</c>`
      );
    }
    rowsXml.push(`<row r="${r + 1}">${cells.join('')}</row>`);
  }

  const lastCol = colLetter(rows[0].length);
  const lastRow = rows.length;
  const dimRef = `A1:${lastCol}${lastRow}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimRef}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="10" customWidth="1"/>
    <col min="2" max="2" width="22" customWidth="1"/>
    <col min="3" max="3" width="50" customWidth="1"/>
    <col min="4" max="4" width="35" customWidth="1"/>
    <col min="5" max="5" width="55" customWidth="1"/>
    <col min="6" max="6" width="35" customWidth="1"/>
    <col min="7" max="7" width="55" customWidth="1"/>
    <col min="8" max="8" width="10" customWidth="1"/>
    <col min="9" max="9" width="13" customWidth="1"/>
    <col min="10" max="10" width="13" customWidth="1"/>
  </cols>
  <sheetData>${rowsXml.join('')}</sheetData>
</worksheet>`;
}

function buildSummarySheetXml(rows) {
  const rowsXml = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const isHeader = r === 0;
    const styleAttr = isHeader ? ' s="1"' : '';
    const cells = [];
    for (let c = 0; c < row.length; c++) {
      const value = row[c];
      const ref = colLetter(c + 1) + (r + 1);
      cells.push(
        `<c r="${ref}"${styleAttr} t="inlineStr" xml:space="preserve">` +
          `<is><t xml:space="preserve">${escapeXml(value)}</t></is>` +
          `</c>`
      );
    }
    rowsXml.push(`<row r="${r + 1}">${cells.join('')}</row>`);
  }

  const lastCol = colLetter(rows[0].length);
  const lastRow = rows.length;
  const dimRef = `A1:${lastCol}${lastRow}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimRef}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="30" customWidth="1"/>
    <col min="2" max="2" width="70" customWidth="1"/>
    <col min="3" max="3" width="20" customWidth="1"/>
    <col min="4" max="4" width="15" customWidth="1"/>
    <col min="5" max="5" width="15" customWidth="1"/>
  </cols>
  <sheetData>${rowsXml.join('')}</sheetData>
</worksheet>`;
}

function buildContentTypes(sheetCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('\n  ')}
</Types>`;
}

function buildRootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildWorkbookRels(sheetCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('\n  ')}
</Relationships>`;
}

function buildWorkbook(sheets) {
  const sheetsXml = sheets.map((s, i) =>
    `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" rId="rId${i + 2}"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetsXml}</sheets>
</workbook>`;
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  const localParts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const compressed = zlib.deflateRawSync(data);
    const useCompression = true;
    const storedData = useCompression ? compressed : data;
    const method = useCompression ? 8 : 0;
    const crc = crc32(data);
    const size = data.length;
    const csize = storedData.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(csize, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localEntry = Buffer.concat([localHeader, nameBuf, storedData]);
    localParts.push(localEntry);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(csize, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    const centralEntry = Buffer.concat([centralHeader, nameBuf]);
    central.push(centralEntry);

    offset += localEntry.length;
  }

  const localBuf = Buffer.concat(localParts);
  const centralBuf = Buffer.concat(central);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

// ============================================================================
// Build test cases rows
// ============================================================================

function testCasesToRows(items) {
  const header = [
    'Test Case ID',
    'Module / Feature Name',
    'Test Title',
    'Pre-conditions',
    'Test Steps',
    'Test Data',
    'Expected Result',
    'Priority',
    'Type',
    'Status',
  ];
  const data = items.map((t, i) => {
    const id = 'TC_' + String(i + 1).padStart(3, '0');
    return [
      id,
      t.module,
      t.title,
      t.preconditions,
      t.steps,
      t.data,
      t.expected,
      t.priority,
      t.type,
      'Untested',
    ];
  });
  return [header, ...data];
}

function buildSummaryRows() {
  const byType = { Positive: 0, Negative: 0, Boundary: 0, Integration: 0 };
  const byModule = {};
  const byPriority = { High: 0, Medium: 0, Low: 0 };
  for (const t of TEST_CASES) {
    byType[t.type] = (byType[t.type] || 0) + 1;
    byModule[t.module] = (byModule[t.module] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
  }

  const rows = [
    ['ARS_FE Test Cases Documentation', ''],
    ['Vietnamese QA Standard (10-column format)', ''],
    ['', ''],
    ['METADATA', 'VALUE'],
    ['Project', 'ARS_FE - Academic Research Sharing Platform (Frontend)'],
    ['Version', '0.0.0'],
    ['Date', new Date().toISOString().slice(0, 10)],
    ['Test Framework', 'Vitest + React Testing Library + Playwright'],
    ['Author', 'QA Documentation Specialist'],
    ['Total Test Cases', String(TEST_CASES.length)],
    ['', ''],
    ['COUNT BY TYPE', ''],
    ['Type', 'Count'],
    ['Positive', String(byType.Positive)],
    ['Negative', String(byType.Negative)],
    ['Boundary', String(byType.Boundary)],
    ['Integration', String(byType.Integration)],
    ['Total', String(TEST_CASES.length)],
    ['', ''],
    ['COUNT BY PRIORITY', ''],
    ['Priority', 'Count'],
    ['High', String(byPriority.High)],
    ['Medium', String(byPriority.Medium)],
    ['Low', String(byPriority.Low)],
    ['Total', String(TEST_CASES.length)],
    ['', ''],
    ['COUNT BY MODULE', ''],
    ['Module', 'Count'],
    ...Object.entries(byModule).map(([k, v]) => [k, String(v)]),
    ['', ''],
    ['COLUMN REFERENCE', ''],
    ['Column', 'Description', 'Example'],
    ['Test Case ID', 'Unique identifier', 'TC_001'],
    ['Module / Feature Name', 'Role-based feature area', 'Researcher, Reviewer, Lecturer, GraduateStudent, Admin, Auth, Papers, Shared, Services, Hooks, Routing'],
    ['Test Title', 'Brief description', 'Login - valid email'],
    ['Pre-conditions', 'Setup required', 'User is on /login'],
    ['Test Steps', 'Numbered actions', '1. Navigate to /login'],
    ['Test Data', 'Input data', 'email: test@example.com'],
    ['Expected Result', 'What should happen', 'User is authenticated'],
    ['Priority', 'Test importance', 'High / Medium / Low'],
    ['Type', 'Test category', 'Positive / Negative / Boundary / Integration'],
    ['Status', 'Current state', 'Untested (default)'],
    ['', ''],
    ['STATUS LEGEND', ''],
    ['Status', 'Meaning'],
    ['Untested', 'Test has not been executed'],
    ['Pass', 'Test executed successfully'],
    ['Fail', 'Test failed'],
    ['Skip', 'Test skipped'],
    ['Blocked', 'Test blocked by dependency'],
    ['', ''],
    ['ROLE-BASED MODULE MAPPING', ''],
    ['Module', 'Source Directory', 'Description'],
    ['Auth', 'src/pages/Login, Register, ResetPassword', 'Public authentication flows (cross-role)'],
    ['Papers', 'src/pages/Papers', 'Paper submission and listing (Researcher + Reviewer shared)'],
    ['Researcher', 'src/pages/Researcher', 'Researcher-only pages (DiscoverReviewers)'],
    ['Reviewer', 'src/pages/Reviewer', 'Reviewer-only pages (AssignedReviews, EvaluationDesk, EarningsWallet)'],
    ['Lecturer', 'src/pages/Lecturer', 'Lecturer-only pages (ResearchGroup, ConfigureMilestones, SeminarWorkspace)'],
    ['GraduateStudent', 'src/pages/GraduateStudent', 'Student-only pages (SubmitReport, StudentResearchGroups)'],
    ['Admin', 'src/pages/Admin', 'Admin-only pages (AdminDashboard)'],
    ['Shared', 'src/pages/Dashboard, Forum, Profile', 'Cross-role pages'],
    ['Services', 'src/services', 'API service files and axios interceptors'],
    ['Hooks', 'src/hooks', 'Custom React hooks (useFetch, useDebounce, useFirebaseUpload)'],
    ['Routing', 'src/routes, src/App.tsx', 'Route guards and navigation logic'],
  ];
  return rows;
}

function main() {
  const testRows = testCasesToRows(TEST_CASES);
  const summaryRows = buildSummaryRows();

  const files = [];

  files.push({ name: '[Content_Types].xml', data: Buffer.from(buildContentTypes(2), 'utf8') });
  files.push({ name: '_rels/.rels', data: Buffer.from(buildRootRels(), 'utf8') });
  files.push({ name: 'xl/workbook.xml', data: Buffer.from(buildWorkbook([
    { name: 'Summary', rows: summaryRows },
    { name: 'Test Cases', rows: testRows },
  ]), 'utf8') });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(buildWorkbookRels(2), 'utf8') });
  files.push({ name: 'xl/styles.xml', data: Buffer.from(buildStyles(), 'utf8') });
  files.push({ name: 'xl/worksheets/sheet1.xml', data: Buffer.from(buildSummarySheetXml(summaryRows), 'utf8') });
  files.push({ name: 'xl/worksheets/sheet2.xml', data: Buffer.from(buildSheetXml(testRows), 'utf8') });

  const zip = buildZip(files);

  const outputPath = path.resolve(__dirname, 'docs', 'test_cases.xlsx');
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, zip);

  console.log(`OK  Wrote ${outputPath}`);
  console.log(`    Total test cases: ${TEST_CASES.length}`);
  console.log(`    File size:        ${(zip.length / 1024).toFixed(1)} KB`);
}

main();