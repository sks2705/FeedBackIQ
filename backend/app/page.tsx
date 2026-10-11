import { NextResponse } from 'next/server';

export default function Root() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>FeedbackIQ API Server</h1>
      <p>Backend API service is running. Endpoints are available under <code>/api/*</code>.</p>
    </div>
  );
}
