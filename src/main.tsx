import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 นาที ก่อนถือว่าข้อมูล stale
      gcTime: 30 * 60 * 1000,   // เก็บ cache ใน memory 30 นาที
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Apply saved theme immediately before render to prevent flash
const saved = localStorage.getItem('marching-band-store');
if (saved) {
  try {
    const state = JSON.parse(saved);
    if (state?.state?.theme === 'dark' || !state?.state?.theme) {
      document.documentElement.classList.add('dark');
    }
  } catch {
    document.documentElement.classList.add('dark');
  }
} else {
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
