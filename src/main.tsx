import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error boundary', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#24223b', color: 'white' }}>
        <section style={{ maxWidth: 620, padding: 32, background: '#302d4a', border: '1px solid #8d81ef', borderRadius: 18 }}>
          <p style={{ color: '#bdb5ff', fontWeight: 900 }}>안전 복구 모드</p>
          <h1>화면을 표시하는 중 문제가 발생했습니다.</h1>
          <p style={{ color: '#cbd2de', lineHeight: 1.7 }}>자동 저장된 게임 기록은 브라우저에 남아 있습니다. 먼저 새로고침을 시도하고, 문제가 계속되면 개발자에게 전달해 주세요.</p>
          <button style={{ minHeight: 46, padding: '10px 18px', border: 0, borderRadius: 10, background: '#8d81ef', color: 'white', fontWeight: 900, cursor: 'pointer' }} onClick={() => location.reload()}>안전하게 새로고침</button>
        </section>
      </main>
    );
  }
}

const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.data.root = root;

root.render(
  <StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>,
);
