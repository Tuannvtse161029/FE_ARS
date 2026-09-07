import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  UserPlus,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  BookOpen,
  Award,
  GraduationCap,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { useFirebaseFileUpload } from '../../hooks/useFirebaseFileUpload';
import {
  REGISTRATION_ROLES,
  type RequestableRole,
} from '../../utils/registrationRoles';
import {
  roleRequestService,
  type UserPendingRoleRequest,
} from '../../services/roleRequest.service';
import type { AuthResponse } from '../../types/auth';
import styles from './RequestAdditionalRoleModal.module.css';

export interface RequestAdditionalRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthResponse | null;
  currentProfile?: {
    institution?: string | null;
    department?: string | null;
    phoneNumber?: string | null;
    orcidId?: string | null;
    fullName?: string | null;
  } | null;
  onSubmitted?: (requestedRole: RequestableRole) => void;
}

const ROLE_INFO: Record<
  RequestableRole,
  {
    icon: React.ComponentType<any>;
    descEn: string;
    descVi: string;
    reqEn: string;
    reqVi: string;
  }
> = {
  Reviewer: {
    icon: Award,
    descEn: 'Evaluate research submissions, conduct peer reviews, and verify academic standards.',
    descVi: 'Đánh giá các bài báo nghiên cứu, thực hiện phản biện học thuật và thẩm định tiêu chuẩn.',
    reqEn: 'Upload a PDF summarizing your academic background, areas of expertise, and peer review history.',
    reqVi: 'Tải lên tài liệu PDF lý lịch học thuật, chuyên môn nghiên cứu hoặc kinh nghiệm phản biện.',
  },
  Lecturer: {
    icon: BookOpen,
    descEn: 'Mentor student research groups, approve topic proposals, and curate learning materials.',
    descVi: 'Hướng dẫn các nhóm sinh viên nghiên cứu, phê duyệt đề tài và quản lý tài liệu học tập.',
    reqEn: 'Upload a PDF verifying your teaching credentials, affiliated faculty, and academic appointment.',
    reqVi: 'Tải lên tài liệu PDF chứng minh vị trí giảng viên, khoa/trường công tác và chuyên môn giảng dạy.',
  },
  Researcher: {
    icon: ShieldCheck,
    descEn: 'Author and submit scientific publications, host academic seminars, and link ORCID metrics.',
    descVi: 'Tác giả và công bố các bài báo khoa học, tổ chức hội thảo và liên kết chỉ số ORCID.',
    reqEn: 'Upload a PDF profile with your publications, citation record, and verified academic identity.',
    reqVi: 'Tải lên PDF hồ sơ công bố khoa học, bài báo đã xuất bản hoặc trích dẫn nghiên cứu.',
  },
  'Graduate Student': {
    icon: GraduationCap,
    descEn: 'Join student research groups, complete milestone reports, and collaborate on topics.',
    descVi: 'Tham gia các nhóm nghiên cứu, hoàn thành báo cáo tiến độ các giai đoạn và bảo vệ đề tài.',
    reqEn: 'Upload proof of current enrollment, academic transcript, or advisor recommendation letter.',
    reqVi: 'Tải lên thẻ học viên / sinh viên, giấy xác nhận đào tạo hoặc thư giới thiệu của giảng viên hướng dẫn.',
  },
};

/**
 * Role progression & transition matrix:
 * Defines which additional roles an existing role is eligible to request.
 * - Graduate Student: can only request Researcher (cannot request Reviewer or Lecturer).
 * - Lecturer: can request Researcher, Reviewer.
 * - Researcher: can request Lecturer, Reviewer.
 * - Reviewer: can request Lecturer, Researcher.
 */
const ELIGIBLE_ADDITIONAL_ROLES_MAP: Record<string, RequestableRole[]> = {
  'Graduate Student': ['Researcher'],
  GraduateStudent: ['Researcher'],
  Lecturer: ['Researcher', 'Reviewer'],
  Researcher: ['Lecturer', 'Reviewer'],
  Reviewer: ['Lecturer', 'Researcher'],
};

export const RequestAdditionalRoleModal: React.FC<RequestAdditionalRoleModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentProfile,
  onSubmitted,
}) => {
  const { t, locale } = useI18n();
  const isVi = locale === 'vi';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active user roles
  const currentRoles = useMemo(() => {
    if (!currentUser) return ['Researcher'];
    if (Array.isArray(currentUser.roles) && currentUser.roles.length > 0) {
      return currentUser.roles;
    }
    if (currentUser.role) return [currentUser.role];
    return ['Researcher'];
  }, [currentUser]);

  // Roles available for selection (based on eligibility matrix, excluding currently held roles and Admin)
  const availableRoles = useMemo(() => {
    const isGraduateStudent = currentRoles.some(
      (r) => r === 'Graduate Student' || r === 'GraduateStudent',
    );
    const hasResearcher = currentRoles.includes('Researcher');

    if (isGraduateStudent) {
      if (hasResearcher) {
        return [] as RequestableRole[];
      }
      return ['Researcher'] as RequestableRole[];
    }

    const eligiblePool = new Set<RequestableRole>();
    currentRoles.forEach((r) => {
      const allowed = ELIGIBLE_ADDITIONAL_ROLES_MAP[r] || [];
      allowed.forEach((target) => eligiblePool.add(target));
    });

    return REGISTRATION_ROLES.filter(
      (role) => eligiblePool.has(role) && !currentRoles.includes(role),
    );
  }, [currentRoles]);

  // Selected role
  const [selectedRole, setSelectedRole] = useState<RequestableRole>(
    availableRoles[0] || 'Reviewer',
  );

  useEffect(() => {
    if (availableRoles.length > 0 && !availableRoles.includes(selectedRole)) {
      setSelectedRole(availableRoles[0]);
    }
  }, [availableRoles, selectedRole]);

  // Form fields
  const [affiliation, setAffiliation] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [proofDocumentUrl, setProofDocumentUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Status & error
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<UserPendingRoleRequest | null>(null);

  // Initialize fields from profile on open
  useEffect(() => {
    if (!isOpen) return;
    setAffiliation(currentProfile?.institution || '');
    setDepartment(currentProfile?.department || '');
    setPhone(currentProfile?.phoneNumber || '');
    setReason('');
    setProofDocumentUrl('');
    setUploadedFile(null);
    setError(null);

    if (currentUser?.userId) {
      const existing = roleRequestService.getPendingRequest(currentUser.userId);
      setPendingRequest(existing);
      roleRequestService.fetchPendingRequest(currentUser.userId).then((fresh) => {
        setPendingRequest(fresh);
      });
    }
  }, [isOpen, currentProfile, currentUser]);

  // Firebase file upload
  const {
    uploadFile,
    progress: uploadProgress,
    isUploading,
    resetUpload,
  } = useFirebaseFileUpload(
    `role-requests/${currentUser?.userId || 'unknown'}/`,
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError(
        isVi
          ? 'Dung lượng file tối đa là 15MB.'
          : 'File size exceeds 15MB limit.',
      );
      return;
    }

    setError(null);
    setUploadedFile(file);
    try {
      const downloadUrl = await uploadFile(file);
      if (downloadUrl) {
        setProofDocumentUrl(downloadUrl);
      }
    } catch (uploadErr) {
      setError(
        uploadErr instanceof Error
          ? uploadErr.message
          : isVi
          ? 'Tải file lên thất bại. Vui lòng thử lại.'
          : 'File upload failed. Please try again.',
      );
      setUploadedFile(null);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setProofDocumentUrl('');
    resetUpload();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.userId) return;

    if (!selectedRole || !availableRoles.includes(selectedRole)) {
      setError(
        isVi
          ? 'Vui lòng chọn vai trò bổ sung hợp lệ theo quy định chuyển đổi vai trò.'
          : 'Please select an eligible additional role based on role progression policies.',
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await roleRequestService.submit({
        userId: currentUser.userId,
        userName: currentProfile?.fullName || currentUser.username || currentUser.email,
        email: currentUser.email,
        phoneNumber: phone,
        affiliation,
        department,
        currentRoles,
        requestedAdditionalRole: selectedRole,
        reason,
        proofDocumentUrl,
        orcidId: currentProfile?.orcidId || undefined,
      });

      onSubmitted?.(selectedRole);
      onClose();
    } catch (submitErr) {
      setError(
        submitErr instanceof Error
          ? submitErr.message
          : isVi
          ? 'Không thể gửi yêu cầu. Vui lòng thử lại.'
          : 'Failed to submit role request. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPending = async () => {
    if (!currentUser?.userId) return;
    await roleRequestService.cancelPendingRequest(currentUser.userId, pendingRequest?.id);
    setPendingRequest(null);
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting && !isUploading) {
          onClose();
        }
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-modal-title"
      >
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <UserPlus size={22} aria-hidden />
            </div>
            <div>
              <h2 id="role-modal-title" className={styles.title}>
                {isVi ? 'Yêu cầu thêm vai trò' : 'Request Additional Role'}
              </h2>
              <p className={styles.subtitle}>
                {isVi
                  ? 'Gửi yêu cầu bổ sung vai trò nghiên cứu tới Quản trị viên để được phê duyệt.'
                  : 'Submit a request to add an academic role to your account for Administrator review.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            disabled={isSubmitting || isUploading}
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className={styles.body}>
          {/* Pending request banner */}
          {pendingRequest && (
            <div className={styles.pendingBanner} role="status">
              <Clock size={18} className={styles.pendingBannerIcon} aria-hidden />
              <div style={{ flex: 1 }}>
                <h4 className={styles.pendingBannerTitle}>
                  {isVi
                    ? 'Bạn đang có yêu cầu chờ duyệt'
                    : 'Pending role request in progress'}
                </h4>
                <p className={styles.pendingBannerText}>
                  {isVi
                    ? `Yêu cầu cấp vai trò "${pendingRequest.requestedRole}" gửi lúc ${new Date(
                        pendingRequest.submittedAt,
                      ).toLocaleDateString(isVi ? 'vi-VN' : 'en-US')} đang được Quản trị viên thẩm định.`
                    : `Your request for role "${pendingRequest.requestedRole}" submitted on ${new Date(
                        pendingRequest.submittedAt,
                      ).toLocaleDateString()} is currently under review by an Administrator.`}
                </p>
              </div>
              <button
                type="button"
                className={styles.cancelBtn}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                onClick={handleCancelPending}
              >
                {isVi ? 'Hủy yêu cầu cũ' : 'Cancel old'}
              </button>
            </div>
          )}

          {/* Current Roles Banner */}
          <div className={styles.currentRolesBanner}>
            <span className={styles.currentRolesLabel}>
              {isVi ? 'Vai trò hiện tại của bạn:' : 'Your current role(s):'}
            </span>
            <div className={styles.currentRolesList}>
              {currentRoles.map((role) => (
                <span key={role} className={styles.currentRolePill}>
                  <CheckCircle size={12} aria-hidden /> {role}
                </span>
              ))}
            </div>
          </div>

          {/* Role selection section */}
          <div>
            <h3 className={styles.sectionTitle}>
              {isVi ? '1. Chọn vai trò muốn yêu cầu thêm' : '1. Select role to request'}
            </h3>
            {availableRoles.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>
                {currentRoles.some((r) => r === 'Graduate Student' || r === 'GraduateStudent') &&
                currentRoles.includes('Researcher')
                  ? isVi
                    ? 'Tài khoản Học viên đã được cấp vai trò Nghiên cứu viên (Researcher). Theo quy định học thuật, tài khoản học viên không thể yêu cầu thêm các vai trò khác.'
                    : 'Graduate Student accounts that advanced to Researcher are not eligible to request further roles under academic governance policies.'
                  : isVi
                  ? 'Bạn đã sở hữu toàn bộ các vai trò học thuật hợp lệ trên hệ thống.'
                  : 'You already possess all available academic roles on the platform.'}
              </p>
            ) : (
              <div className={styles.roleGrid}>
                {availableRoles.map((role) => {
                  const info = ROLE_INFO[role];
                  const Icon = info.icon;
                  const isActive = selectedRole === role;
                  return (
                    <div
                      key={role}
                      className={`${styles.roleCard} ${isActive ? styles.roleCardActive : ''}`}
                      onClick={() => setSelectedRole(role)}
                      role="radio"
                      aria-checked={isActive}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setSelectedRole(role);
                        }
                      }}
                    >
                      <div className={styles.roleCardHeader}>
                        <span className={styles.roleCardTitle}>
                          <Icon size={16} color={isActive ? '#2563eb' : '#64748b'} />
                          {role}
                        </span>
                        <div className={styles.roleCardRadio}>
                          {isActive && <div className={styles.roleCardRadioInner} />}
                        </div>
                      </div>
                      <p className={styles.roleCardDesc}>
                        {isVi ? info.descVi : info.descEn}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Verification requirement description */}
          {selectedRole && (
            <div
              style={{
                background: '#f1f5f9',
                borderLeft: '4px solid #2563eb',
                padding: '10px 14px',
                borderRadius: '0 8px 8px 0',
                fontSize: '0.82rem',
                color: '#334155',
              }}
            >
              <strong>{isVi ? 'Yêu cầu thẩm định: ' : 'Verification requirement: '}</strong>
              {isVi
                ? ROLE_INFO[selectedRole]?.reqVi
                : ROLE_INFO[selectedRole]?.reqEn}
            </div>
          )}

          {/* Affiliation & Department */}
          <div>
            <h3 className={styles.sectionTitle}>
              {isVi ? '2. Thông tin công tác & liên hệ' : '2. Academic affiliation & contact'}
            </h3>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="role-req-affiliation">
                  {isVi ? 'Cơ quan / Trường học *' : 'Institution / University *'}
                </label>
                <input
                  id="role-req-affiliation"
                  className={styles.input}
                  type="text"
                  required
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  placeholder={isVi ? 'Đại học FPT, Viện nghiên cứu...' : 'e.g. Stanford, FPT University'}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="role-req-department">
                  {isVi ? 'Khoa / Bộ môn' : 'Department / Faculty'}
                </label>
                <input
                  id="role-req-department"
                  className={styles.input}
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder={isVi ? 'Khoa Công nghệ thông tin...' : 'e.g. Computer Science'}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="role-req-phone">
                  {isVi ? 'Số điện thoại liên hệ' : 'Contact phone number'}
                </label>
                <input
                  id="role-req-phone"
                  className={styles.input}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+84 901 234 567"
                />
              </div>
            </div>
          </div>

          {/* Proof Document Upload */}
          <div>
            <h3 className={styles.sectionTitle}>
              {isVi ? '3. Hồ sơ minh chứng năng lực (PDF / Chứng chỉ)' : '3. Proof Document (PDF / CV)'}
            </h3>

            {uploadedFile && proofDocumentUrl ? (
              <div className={styles.filePreview}>
                <div className={styles.filePreviewInfo}>
                  <FileText size={20} color="#2563eb" />
                  <div>
                    <div className={styles.filePreviewName}>{uploadedFile.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • {isVi ? 'Đã tải lên' : 'Uploaded'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a
                    href={proofDocumentUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                  >
                    <ExternalLink size={13} /> {isVi ? 'Xem' : 'View'}
                  </a>
                  <button
                    type="button"
                    className={styles.fileRemoveBtn}
                    onClick={handleRemoveFile}
                    aria-label="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : isUploading ? (
              <div style={{ padding: '12px', textAlign: 'center' }}>
                <Loader2 size={20} className="spinning" style={{ margin: '0 auto 6px' }} />
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  {isVi ? 'Đang tải hồ sơ lên Firebase Storage...' : 'Uploading proof document...'} {uploadProgress}%
                </div>
                <div className={styles.uploadingBar}>
                  <div className={styles.uploadingProgress} style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <div>
                <div
                  className={styles.dropzone}
                  onClick={() => fileInputRef.current?.click()}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Upload size={22} className={styles.dropzoneIcon} aria-hidden />
                  <span className={styles.dropzoneText}>
                    {isVi
                      ? 'Bấm hoặc kéo thả file hồ sơ (PDF, CV, bằng cấp) vào đây'
                      : 'Click or drop verification PDF, CV, or certificate here'}
                  </span>
                  <span className={styles.dropzoneHint}>
                    {isVi ? 'Định dạng PDF, tối đa 15MB' : 'PDF format, max 15MB'}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className={styles.hiddenInput}
                  onChange={handleFileChange}
                />
              </div>
            )}
          </div>

          {/* Reason / Notes */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="role-req-reason">
              {isVi ? '4. Lý do & Ghi chú nguyện vọng' : '4. Motivation & Notes'}
            </label>
            <textarea
              id="role-req-reason"
              className={styles.textarea}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isVi
                  ? 'Nêu ngắn gọn lý do bạn muốn nhận vai trò này và kinh nghiệm nghiên cứu liên quan...'
                  : 'Briefly explain why you are requesting this role and your relevant background...'
              }
            />
          </div>

          {/* Error display */}
          {error && (
            <div className={styles.errorAlert} role="alert">
              <AlertCircle size={16} aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSubmitting || isUploading}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || isUploading || availableRoles.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="spinning" />
                  {isVi ? 'Đang gửi...' : 'Submitting...'}
                </>
              ) : (
                <>
                  <UserPlus size={15} />
                  {isVi ? 'Gửi yêu cầu vai trò' : 'Submit role request'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestAdditionalRoleModal;
