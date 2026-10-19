import { Component, Suspense } from 'react';

export function LoadingPanel({ overlay = false }) {
  return <div className={`route-loading${overlay ? ' is-overlay' : ''}`} role="status"><span className="route-loading-indicator"/><span>Đang mở nội dung…</span></div>;
}
class PanelBoundary extends Component {
  state = { failed:false };
  static getDerivedStateFromError() { return { failed:true }; }
  render() {
    if (this.state.failed) return <div className={`route-loading${this.props.overlay ? ' is-overlay' : ''}`} role="alert"><p>Chưa mở được giao diện. Hãy tải lại trang để lấy phiên bản mới.</p><button type="button" onClick={() => window.location.reload()}>Tải lại trang</button></div>;
    return this.props.children;
  }
}
export default function AsyncPanel({ children, overlay = false, resetKey }) {
  return <PanelBoundary key={resetKey} overlay={overlay}><Suspense fallback={<LoadingPanel overlay={overlay}/>}>{children}</Suspense></PanelBoundary>;
}
