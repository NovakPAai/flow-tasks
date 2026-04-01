import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useOnboardingStore, ONBOARDING_STEPS } from '../store/onboarding.store';
import OnboardingTooltip from './OnboardingTooltip';

interface Props {
  children: React.ReactNode;
}

export default function OnboardingProvider({ children }: Props) {
  const user = useAuthStore((s) => s.user);
  const { active, step, init, nextStep, skipAll } = useOnboardingStore();

  useEffect(() => {
    if (user?.id && user.loginCount !== undefined) {
      init(user.id, user.loginCount);
    }
  }, [user?.id, user?.loginCount, init]);

  const currentStep = ONBOARDING_STEPS[step];

  return (
    <>
      {children}
      {active && currentStep && (
        <OnboardingTooltip
          step={step}
          total={ONBOARDING_STEPS.length}
          message={currentStep.message}
          hint={currentStep.hint}
          onNext={nextStep}
          onSkip={skipAll}
        />
      )}
    </>
  );
}
