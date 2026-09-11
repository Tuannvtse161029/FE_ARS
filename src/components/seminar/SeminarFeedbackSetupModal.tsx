/**


 * SeminarFeedbackSetupModal.tsx


 *


 * Full setup UI for the Lecturer to configure Seminar Feedback:


 * 1. Choose between ARS General Feedback Form (standard 4 questions) or Custom Form


 * 2. In Custom Form: Add, reorder (Move Up/Down), delete, toggle Rating vs Text, toggle Required


 * 3. Live Participant Preview: see exactly what participants will experience


 * 4. Save & persist to Seminar.feedback (JSON in NVARCHAR(MAX)) & localStorage


 */





import { useEffect, useState } from 'react';


import {


  X,


  Plus,


  Eye,


  Sliders,


  CheckCircle2,


  AlertCircle,


  FileCheck2,


  Star,


  Loader,


  Send,


} from 'lucide-react';


import { useLocale } from '../../i18n/I18nContext';


import { Button } from '../Button/Button';


import {


  type FeedbackQuestion,


  DEFAULT_GENERAL_QUESTIONS,


  parseSeminarQuestions,


  getCachedSeminarQuestions,


  setCachedSeminarQuestions,


  generateStableQuestionId,


} from '../../types/seminarFeedback';


import { DynamicQuestionRenderer } from './DynamicQuestionRenderer';


import { QuestionEditorCard } from './QuestionEditorCard';


import { seminarService } from '../../services/seminar.service';


import styles from './SeminarFeedbackSetupModal.module.css';





export interface SeminarFeedbackSetupModalProps {


  isOpen: boolean;


  onClose: () => void;


  seminarId: number;


  seminarTitle?: string;


  existingFeedbackRaw?: string | null;


  onSuccess?: (questions: FeedbackQuestion[]) => void;


}





type FormMode = 'general' | 'custom';


type TabType = 'setup' | 'preview';





export const SeminarFeedbackSetupModal = ({


  isOpen,


  onClose,


  seminarId,


  seminarTitle,


  existingFeedbackRaw,


  onSuccess,


}: SeminarFeedbackSetupModalProps) => {


  const locale = useLocale();


  const isVi = locale === 'vi';


  const copy = (en: string, vi: string) => (isVi ? vi : en);





  const [activeTab, setActiveTab] = useState<TabType>('setup');


  const [formMode, setFormMode] = useState<FormMode>('custom');


  const [customQuestions, setCustomQuestions] = useState<FeedbackQuestion[]>([]);


  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});


  const [isSaving, setIsSaving] = useState(false);


  const [generalStatusMsg, setGeneralStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);





  // Initialize or prefill existing questions on open


  useEffect(() => {


    if (!isOpen) return;





    setActiveTab('setup');


    setValidationErrors({});


    setGeneralStatusMsg(null);





    let isMounted = true;





    const applyQuestions = (questionsList: FeedbackQuestion[]) => {


      const isDefault =


        questionsList.length === DEFAULT_GENERAL_QUESTIONS.length &&


        questionsList.every((q, i) => q.id === DEFAULT_GENERAL_QUESTIONS[i].id);





      if (isDefault) {


        setFormMode('general');


        setCustomQuestions([...DEFAULT_GENERAL_QUESTIONS]);


      } else {


        setFormMode('custom');


        setCustomQuestions(questionsList);


      }


    };





    // 1. Try parsing from prop


    const fromProp = parseSeminarQuestions(existingFeedbackRaw);


    if (fromProp.length > 0) {


      applyQuestions(fromProp);


      return;


    }





    // 2. Try fetching from live backend


    seminarService


      .getFeedbackQuestions(seminarId)


      .then((liveQuestions) => {


        if (!isMounted) return;


        if (liveQuestions && liveQuestions.length > 0) {


          applyQuestions(liveQuestions);


        } else {


          // 3. Fallback to cached or fresh custom template


          const cached = getCachedSeminarQuestions(seminarId);


          if (cached && cached.length > 0) {


            applyQuestions(cached);


          } else {


            setFormMode('custom');


            setCustomQuestions([


              {


                id: generateStableQuestionId(),


                orderIndex: 0,


                type: 'rating',


                questionText: copy(


                  'How relevant and insightful was this seminar?',


                  'Mức độ hữu ích và thực tế của buổi hội thảo này đối với bạn?'


                ),


                isRequired: true,


                maxStar: 5,


              },


              {


                id: generateStableQuestionId(),


                orderIndex: 1,


                type: 'text',


                questionText: copy(


                  'What key takeaways or constructive feedback do you have for the speaker?',


                  'Điều bạn tâm đắc nhất hoặc đóng góp ý kiến cho diễn giả?'


                ),


                isRequired: false,


                placeholder: copy('Enter your response...', 'Nhập câu trả lời...'),


              },


            ]);


          }


        }


      })


      .catch(() => {


        if (!isMounted) return;


        const cached = getCachedSeminarQuestions(seminarId);


        if (cached && cached.length > 0) {


          applyQuestions(cached);


        }


      });





    return () => {


      isMounted = false;


    };


  }, [isOpen, seminarId, existingFeedbackRaw]);





  if (!isOpen) return null;





  // Active question set depending on selected mode


  const currentQuestions: FeedbackQuestion[] =


    formMode === 'general' ? [...DEFAULT_GENERAL_QUESTIONS] : customQuestions;





  // Question editing handlers


  const handleAddQuestion = () => {


    const newQ: FeedbackQuestion = {


      id: generateStableQuestionId(),


      orderIndex: customQuestions.length,


      type: 'rating',


      questionText: '',


      isRequired: true,


      maxStar: 5,


    };


    setCustomQuestions([...customQuestions, newQ]);


  };





  const handleUpdateQuestion = (id: string, patch: Partial<FeedbackQuestion>) => {


    setCustomQuestions((prev) =>


      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))


    );


    if (patch.questionText && patch.questionText.trim().length > 0) {


      setValidationErrors((prev) => {


        const next = { ...prev };


        delete next[id];


        return next;


      });


    }


  };





  const handleDeleteQuestion = (id: string) => {


    if (customQuestions.length <= 1) return;


    const filtered = customQuestions.filter((q) => q.id !== id);


    // Re-index


    const reindexed = filtered.map((q, idx) => ({ ...q, orderIndex: idx }));


    setCustomQuestions(reindexed);


    setValidationErrors((prev) => {


      const next = { ...prev };


      delete next[id];


      return next;


    });


  };





  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {


    const targetIndex = direction === 'up' ? index - 1 : index + 1;


    if (targetIndex < 0 || targetIndex >= customQuestions.length) return;





    const list = [...customQuestions];


    const temp = list[index];


    list[index] = list[targetIndex];


    list[targetIndex] = temp;





    // Update orderIndex


    const reindexed = list.map((q, idx) => ({ ...q, orderIndex: idx }));


    setCustomQuestions(reindexed);


  };





  // Validate questions


  const validate = (): boolean => {


    if (formMode === 'general') return true;





    const errors: Record<string, string> = {};


    if (customQuestions.length === 0) {


      setGeneralStatusMsg({


        type: 'error',


        text: copy('Please add at least one question.', 'Vui lòng thêm ít nhất một câu hỏi.'),


      });


      return false;


    }





    customQuestions.forEach((q, idx) => {


      if (!q.questionText || !q.questionText.trim()) {


        errors[q.id] = copy(


          `Question #${idx + 1} content cannot be empty.`,


          `Nội dung câu hỏi #${idx + 1} không được để trống.`


        );


      }


    });





    setValidationErrors(errors);


    if (Object.keys(errors).length > 0) {


      setGeneralStatusMsg({


        type: 'error',


        text: copy(


          'Please complete all required question titles before saving.',


          'Vui lòng điền đầy đủ tiêu đề các câu hỏi trước khi lưu.'


        ),


      });


      return false;


    }





    return true;


  };





  const handleSaveAndSend = async () => {


    if (!validate()) return;





    setIsSaving(true);


    setGeneralStatusMsg(null);





    const questionsToSave =


      formMode === 'general' ? [...DEFAULT_GENERAL_QUESTIONS] : customQuestions;





    try {


      // 1. Cache locally so the form remains usable even during transient


      //    network failures. The canonical request body is the array of


      //    questions (ticket §14) and is sent via PUT in the service.


      setCachedSeminarQuestions(seminarId, questionsToSave);





      // 2. Persist to the BE (canonical PUT /api/Seminar/{id}/feedback-form).


      await seminarService.saveFeedbackQuestions(seminarId, questionsToSave);





      setGeneralStatusMsg({


        type: 'success',


        text: copy(


          'Feedback form configured and saved successfully!',


          'Đã thiết lập và lưu biểu mẫu đánh giá thành công!'


        ),


      });





      onSuccess?.(questionsToSave);





      // Close modal after brief success confirmation.


      setTimeout(() => {


        onClose();


      }, 1200);


    } catch (err: unknown) {


      const resp = (err as { response?: { status?: number; data?: { message?: string; title?: string } } })?.response;


      const serverMsg =


        resp?.data?.message || resp?.data?.title ||


        (err instanceof Error ? err.message : '');


      const friendly = serverMsg ||


        copy('Failed to save the feedback form. Please try again.', 'Không thể lưu biểu mẫu đánh giá. Vui lòng thử lại.');


      setGeneralStatusMsg({


        type: 'error',


        text: friendly,


      });


    } finally {


      setIsSaving(false);


    }


  };





  return (


    <div className={styles.modalOverlay} role="dialog" aria-modal="true">


      <div className={styles.modalCard}>


        {/* Modal Header */}


        <div className={styles.modalHeader}>


          <div className={styles.headerTitleGroup}>


            <h3 className={styles.modalTitle}>


              <Sliders size={20} color="var(--ars-lecturer)" aria-hidden />


              {copy('Configure Seminar Feedback', 'Thiết lập Đánh giá Hội thảo')}


            </h3>


            <p className={styles.modalSubtitle}>


              {seminarTitle ? (


                <>


                  {copy('Seminar:', 'Hội thảo:')} <strong>{seminarTitle}</strong> (ID: {seminarId})


                </>


              ) : (


                copy('Set up feedback questions for seminar participants', 'Tạo bộ câu hỏi đánh giá cho người tham dự')


              )}


            </p>


          </div>


          <button


            type="button"


            className={styles.closeBtn}


            onClick={onClose}


            aria-label={copy('Close', 'Đóng')}


          >


            <X size={20} aria-hidden />


          </button>


        </div>





        {/* Navigation Tabs */}


        <div className={styles.navTabs}>


          <button


            type="button"


            className={`${styles.navTab} ${activeTab === 'setup' ? styles.navTabActive : ''}`}


            onClick={() => setActiveTab('setup')}


          >


            <Sliders size={16} aria-hidden />


            <span>{copy('1. Setup Questions', '1. Thiết lập câu hỏi')}</span>


            <span className={styles.badge}>{currentQuestions.length}</span>


          </button>


          <button


            type="button"


            className={`${styles.navTab} ${activeTab === 'preview' ? styles.navTabActive : ''}`}


            onClick={() => {


              if (validate()) setActiveTab('preview');


            }}


          >


            <Eye size={16} aria-hidden />


            <span>{copy('2. Participant Preview', '2. Xem trước giao diện')}</span>


          </button>


        </div>





        {/* Modal Content */}


        <div className={styles.modalBody}>


          {generalStatusMsg && (


            <div


              className={`${styles.alertBox} ${


                generalStatusMsg.type === 'error' ? styles.alertError : styles.alertSuccess


              }`}


              role="status"


            >


              {generalStatusMsg.type === 'error' ? (


                <AlertCircle size={16} aria-hidden />


              ) : (


                <CheckCircle2 size={16} aria-hidden />


              )}


              <span>{generalStatusMsg.text}</span>


            </div>


          )}





          {activeTab === 'setup' ? (


            <>


              {/* Form Mode Selection */}


              <div className={styles.modeSelection}>


                <div


                  className={`${styles.modeOption} ${


                    formMode === 'custom' ? styles.modeOptionSelected : ''


                  }`}


                  onClick={() => setFormMode('custom')}


                  role="radio"


                  aria-checked={formMode === 'custom'}


                  tabIndex={0}


                  onKeyDown={(e) => {


                    if (e.key === 'Enter' || e.key === ' ') setFormMode('custom');


                  }}


                >


                  <div className={styles.modeHeader}>


                    <span className={styles.modeTitle}>


                      <Star size={18} color="var(--ars-lecturer)" aria-hidden />


                      {copy('Custom Question Builder', 'Tự tạo câu hỏi riêng cho Hội thảo')}


                    </span>


                    {formMode === 'custom' && (


                      <CheckCircle2 size={18} color="var(--ars-lecturer)" aria-hidden />


                    )}


                  </div>


                  <p className={styles.modeDesc}>


                    {copy(


                      'Build your own questions. Tailor rating criteria and custom text questions specifically for this topic.',


                      'Tự do thêm câu hỏi, lựa chọn định dạng đánh giá sao hoặc nhập văn bản theo đúng nội dung buổi chia sẻ này.'


                    )}


                  </p>


                </div>





                <div


                  className={`${styles.modeOption} ${


                    formMode === 'general' ? styles.modeOptionSelected : ''


                  }`}


                  onClick={() => setFormMode('general')}


                  role="radio"


                  aria-checked={formMode === 'general'}


                  tabIndex={0}


                  onKeyDown={(e) => {


                    if (e.key === 'Enter' || e.key === ' ') setFormMode('general');


                  }}


                >


                  <div className={styles.modeHeader}>


                    <span className={styles.modeTitle}>


                      <FileCheck2 size={18} color="var(--ars-lecturer)" aria-hidden />


                      {copy('ARS General Form', 'Dùng mẫu chuẩn ARS')}


                    </span>


                    {formMode === 'general' && (


                      <CheckCircle2 size={18} color="var(--ars-lecturer)" aria-hidden />


                    )}


                  </div>


                  <p className={styles.modeDesc}>


                    {copy(


                      'Use ARS standard evaluation (4 balanced questions: Content & Speaker ratings + Takeaways & Improvements text).',


                      'Sử dụng bộ câu hỏi mẫu của hệ thống (4 câu: Đánh giá sao nội dung & diễn giả + Trả lời bài học & góp ý).'


                    )}


                  </p>


                </div>


              </div>





              {/* Mode-Specific Content */}


              {formMode === 'general' ? (


                <div className={styles.generalTemplateCard}>


                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>


                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ars-ink)' }}>


                      {copy('Standard Questions Included:', 'Các câu hỏi chuẩn bao gồm:')}


                    </span>


                    <Button


                      variant="outline"


                      size="sm"


                      leftIcon={<Eye size={14} aria-hidden />}


                      onClick={() => setActiveTab('preview')}


                    >


                      {copy('Preview Live Form', 'Xem trước')}


                    </Button>


                  </div>





                  <ul className={styles.generalList}>


                    {DEFAULT_GENERAL_QUESTIONS.map((q, idx) => (


                      <li key={q.id} className={styles.generalItem}>


                        <span className={styles.generalItemTitle}>


                          <strong>#{idx + 1}.</strong> {q.questionText}


                        </span>


                        <span className={styles.typeBadge}>


                          {q.type === 'rating' ? copy('Rating (1–5)', '1–5 Sao') : copy('Text', 'Văn bản')}


                        </span>


                      </li>


                    ))}


                  </ul>


                </div>


              ) : (


                /* Custom Question Builder */


                <div className={styles.builderSection}>


                  <div className={styles.questionsList}>


                    {customQuestions.map((q, idx) => (


                      <QuestionEditorCard


                        key={q.id}


                        question={q}


                        index={idx}


                        totalCount={customQuestions.length}


                        onUpdate={(patch) => handleUpdateQuestion(q.id, patch)}


                        onMoveUp={() => handleMoveQuestion(idx, 'up')}


                        onMoveDown={() => handleMoveQuestion(idx, 'down')}


                        onDelete={() => handleDeleteQuestion(q.id)}


                        error={validationErrors[q.id]}


                      />


                    ))}


                  </div>





                  <div className={styles.addQuestionRow}>


                    <button


                      type="button"


                      className={styles.addQuestionBtn}


                      onClick={handleAddQuestion}


                      disabled={customQuestions.length >= 15}


                    >


                      <Plus size={16} aria-hidden />


                      <span>{copy('Add Another Question', 'Thêm câu hỏi mới')}</span>


                    </button>


                  </div>


                </div>


              )}


            </>


          ) : (


            /* Live Participant Preview Tab */


            <div>


              <DynamicQuestionRenderer


                questions={currentQuestions}


                previewMode={true}


              />


            </div>


          )}


        </div>





        {/* Modal Footer */}


        <div className={styles.modalFooter}>


          <div className={styles.footerLeft}>


            <span>


              {copy('Total:', 'Tổng:')} <strong>{currentQuestions.length}</strong> {copy('questions', 'câu hỏi')}


            </span>


          </div>





          <div className={styles.footerRight}>


            <Button variant="outline" size="md" onClick={onClose} disabled={isSaving}>


              {copy('Cancel', 'Hủy')}


            </Button>


            {activeTab === 'setup' ? (


              <Button


                variant="outline"


                size="md"


                leftIcon={<Eye size={14} aria-hidden />}


                onClick={() => {


                  if (validate()) setActiveTab('preview');


                }}


              >


                {copy('Preview Form', 'Xem trước')}


              </Button>


            ) : (


              <Button


                variant="outline"


                size="md"


                leftIcon={<Sliders size={14} aria-hidden />}


                onClick={() => setActiveTab('setup')}


              >


                {copy('Edit Questions', 'Chỉnh sửa')}


              </Button>


            )}


            <Button


              variant="primary"


              size="md"


              leftIcon={


                isSaving ? (


                  <Loader size={14} className="spinning" aria-hidden />


                ) : (


                  <Send size={14} aria-hidden />


                )


              }


              onClick={handleSaveAndSend}


              disabled={isSaving}


              style={{


                backgroundColor: 'var(--ars-lecturer)',


                borderColor: 'var(--ars-lecturer)',


                color: '#ffffff',


              }}


            >


              {isSaving


                ? copy('Saving...', 'Đang lưu...')


                : copy('Save & Send Form', 'Lưu & Kích hoạt đánh giá')}


            </Button>


          </div>


        </div>


      </div>


    </div>


  );


};





export default SeminarFeedbackSetupModal;


