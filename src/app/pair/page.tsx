import { PairSection } from '@/components/PairSection';

export default function PairPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-base)',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <PairSection />
      </div>
    </div>
  );
}
