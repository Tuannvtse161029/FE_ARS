import { Check } from 'lucide-react';
import styles from './StepIndicator.module.css';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { id: 1, label: 'Email' },
  { id: 2, label: 'Verify' },
  { id: 3, label: 'Reset' },
] as const;

export const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
  return (
    <div className={styles.container} role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={3}>
      {STEPS.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isActive = currentStep === step.id;
        return (
          <div key={step.id} className={styles.stepWrapper}>
            <div className={styles.stepRow}>
              <div
                className={`${styles.circle} ${isActive ? styles.circleActive : ''} ${isCompleted ? styles.circleCompleted : ''}`}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? (
                  <Check size={14} strokeWidth={3} />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>
              <span className={`${styles.label} ${isActive ? styles.labelActive : ''}`}>{step.label}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`${styles.connector} ${isCompleted ? styles.connectorCompleted : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;