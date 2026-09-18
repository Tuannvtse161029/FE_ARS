import type { GradingRubricCriterion } from '../../types/domain';

/**
 * Standard default grading rubric template for ARS academic peer review.
 * 5 criteria, 100 points total.
 */
export const getSystemDefaultRubric = (locale: string): GradingRubricCriterion[] => {
  if (locale === 'vi') {
    return [
      {
        code: 'ORIGINALITY',
        title: 'Tính mới & Độc đáo (Novelty & Originality)',
        description: 'Đánh giá mức độ đóng góp mới, tính sáng tạo và giá trị khác biệt của công trình so với các nghiên cứu trước đó.',
        maxScore: 20,
        order: 1,
        standardReferences: ['IEEE / ACM Research Novelty Standard'],
      },
      {
        code: 'METHODOLOGY',
        title: 'Phương pháp nghiên cứu (Research Methodology)',
        description: 'Đánh giá tính chặt chẽ, tính đúng đắn và độ tin cậy của quy trình thực nghiệm, mô hình toán học hoặc giải thuật đề xuất.',
        maxScore: 25,
        order: 2,
        standardReferences: ['Scientific Rigor & Reproducibility Guidelines'],
      },
      {
        code: 'SIGNIFICANCE',
        title: 'Ý nghĩa & Đóng góp khoa học (Scientific Significance)',
        description: 'Tầm ảnh hưởng của kết quả đạt được đối với lĩnh vực nghiên cứu, tiềm năng ứng dụng thực tiễn hoặc định hướng tương lai.',
        maxScore: 20,
        order: 3,
        standardReferences: [],
      },
      {
        code: 'CLARITY',
        title: 'Độ rõ ràng & Bố cục bài báo (Clarity & Presentation)',
        description: 'Văn phong khoa học, lập luận mạch lạc, tổ chức cấu trúc bài báo hợp lý, hình vẽ và bảng biểu trình bày chuẩn xác.',
        maxScore: 20,
        order: 4,
        standardReferences: [],
      },
      {
        code: 'REFERENCES',
        title: 'Trích dẫn & Y đức học thuật (References & Ethics)',
        description: 'Trích dẫn tài liệu tham khảo đầy đủ, có tính cập nhật, tuân thủ quy chuẩn trích dẫn và y đức công bố khoa học.',
        maxScore: 15,
        order: 5,
        standardReferences: ['COPE Publication Ethics Guidelines'],
      },
    ];
  }

  return [
    {
      code: 'ORIGINALITY',
      title: 'Novelty & Originality',
      description: 'Assessment of original contribution, innovative aspects, and differentiation from existing literature.',
      maxScore: 20,
      order: 1,
      standardReferences: ['IEEE / ACM Research Novelty Standard'],
    },
    {
      code: 'METHODOLOGY',
      title: 'Research Methodology',
      description: 'Rigor, scientific soundness, and reproducibility of the experimental design, mathematical modeling, and empirical methods.',
      maxScore: 25,
      order: 2,
      standardReferences: ['Scientific Rigor & Reproducibility Guidelines'],
    },
    {
      code: 'SIGNIFICANCE',
      title: 'Significance & Impact',
      description: 'Potential scientific impact, theoretical advancement, and practical applicability of the research findings.',
      maxScore: 20,
      order: 3,
      standardReferences: [],
    },
    {
      code: 'CLARITY',
      title: 'Clarity & Presentation',
      description: 'Academic writing quality, coherent organization, and clear presentation of arguments, tables, and figures.',
      maxScore: 20,
      order: 4,
      standardReferences: [],
    },
    {
      code: 'REFERENCES',
      title: 'References & Research Ethics',
      description: 'Comprehensive and up-to-date citation of relevant literature, academic integrity, and adherence to ethical publication standards.',
      maxScore: 15,
      order: 5,
      standardReferences: ['COPE Publication Ethics Guidelines'],
    },
  ];
};
