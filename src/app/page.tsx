import { Suspense } from 'react';
import { StmApp } from '@/components/stm/StmApp';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StmApp />
    </Suspense>
  );
}
