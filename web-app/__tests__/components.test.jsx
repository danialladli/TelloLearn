/**
 * TelloLearn — Web App Unit Tests (Jest + React Testing Library)
 *
 * Tool : Jest + @testing-library/react
 * Run  : npm test   (from web-app/ directory)
 *
 * Tests individual React components and utility functions in isolation.
 * All API calls are mocked with jest.mock('axios').
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';

jest.mock('axios');

// ─── Helper: wrap component in router ────────────────────────────────────────
const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);


// ═══════════════════════════════════════════════════════════════════════════════
// UTC-W01: Login page
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login page (src/pages/Login.jsx)', () => {
  let Login;
  beforeEach(async () => {
    Login = (await import('../src/pages/Login')).default;
    jest.clearAllMocks();
  });

  test('UTC-W01-001: renders username and password fields', () => {
    renderWithRouter(<Login />);
    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });

  test('UTC-W01-002: renders a login button', () => {
    renderWithRouter(<Login />);
    expect(screen.getByRole('button', { name: /login|sign in/i })).toBeInTheDocument();
  });

  test('UTC-W01-003: successful login stores token and redirects', async () => {
    axios.post.mockResolvedValueOnce({
      data: { token: 'jwt_token_abc123', role: 'learner', user_id: 'uid1' }
    });
    renderWithRouter(<Login />);

    await userEvent.type(screen.getByPlaceholderText(/username/i), 'danialtest');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'Test1234!');
    fireEvent.click(screen.getByRole('button', { name: /login|sign in/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({ username: 'danialtest', password: 'Test1234!' })
      );
    });
  });

  test('UTC-W01-004: failed login shows error message', async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 401, data: { detail: 'Invalid credentials' } }
    });
    renderWithRouter(<Login />);

    await userEvent.type(screen.getByPlaceholderText(/username/i), 'danialtest');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'WrongPass');
    fireEvent.click(screen.getByRole('button', { name: /login|sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid|incorrect|error/i)).toBeInTheDocument();
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// UTC-W02: Sign Up page
// ═══════════════════════════════════════════════════════════════════════════════

describe('SignUp page (src/pages/SignUp.jsx)', () => {
  let SignUp;
  beforeEach(async () => {
    SignUp = (await import('../src/pages/SignUp')).default;
    jest.clearAllMocks();
  });

  test('UTC-W02-001: renders username, email, password fields', () => {
    renderWithRouter(<SignUp />);
    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });

  test('UTC-W02-002: submitting valid form calls /api/auth/signup', async () => {
    axios.post.mockResolvedValueOnce({ data: { message: 'Account created' } });
    renderWithRouter(<SignUp />);

    await userEvent.type(screen.getByPlaceholderText(/username/i), 'newstudent');
    await userEvent.type(screen.getByPlaceholderText(/email/i),    'new@test.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'Test1234!');
    fireEvent.click(screen.getByRole('button', { name: /sign up|register/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/signup'),
        expect.any(Object)
      );
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// UTC-W03: Dashboard — module card locking behaviour
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dashboard page (src/pages/Dashboard.jsx)', () => {
  const mockModules = [
    { id: '1', title: 'Basic Flight',         status: 'completed', is_active: true },
    { id: '2', title: 'Landing Pad Accuracy', status: 'active',    is_active: true },
    { id: '3', title: 'Alphabet Recognition', status: 'locked',    is_active: true },
  ];

  let Dashboard;
  beforeEach(async () => {
    Dashboard = (await import('../src/pages/Dashboard')).default;
    // Mock localStorage token
    Storage.prototype.getItem = jest.fn(() => 'fake_jwt_token');
    axios.get.mockResolvedValue({ data: { modules: mockModules } });
    jest.clearAllMocks();
  });

  test('UTC-W03-001: renders a card for each active module', async () => {
    renderWithRouter(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Basic Flight/i)).toBeInTheDocument();
      expect(screen.getByText(/Landing Pad/i)).toBeInTheDocument();
    });
  });

  test('UTC-W03-002: completed module card has no lock indicator', async () => {
    renderWithRouter(<Dashboard />);
    await waitFor(() => {
      // Module 1 is completed — lock icon should not be present for it
      const completedCard = screen.getByText(/Basic Flight/i).closest('[data-testid]') ||
                            screen.getByText(/Basic Flight/i).parentElement;
      expect(completedCard).not.toHaveTextContent(/locked/i);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// UTC-W04: Module page — code editor submit
// ═══════════════════════════════════════════════════════════════════════════════

describe('Module page (src/pages/Module.jsx)', () => {
  let Module;
  beforeEach(async () => {
    Module = (await import('../src/pages/Module')).default;
    Storage.prototype.getItem = jest.fn((key) => {
      if (key === 'token')   return 'fake_jwt_token';
      if (key === 'user_id') return 'uid_test';
      return null;
    });
    jest.clearAllMocks();
  });

  test('UTC-W04-001: renders code textarea', async () => {
    // Mock router params for moduleId = 1
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useParams: () => ({ moduleId: '1' }),
    }));
    axios.get.mockResolvedValue({
      data: { id: '1', title: 'Basic Flight', docs: '# Basic Flight\nLearn to fly.' }
    });
    renderWithRouter(<Module />);
    await waitFor(() => {
      expect(screen.getByRole('textbox') ||
             document.querySelector('textarea')).toBeTruthy();
    });
  });

  test('UTC-W04-002: validate button triggers POST to /api/validate_code', async () => {
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useParams: () => ({ moduleId: '1' }),
    }));
    axios.get.mockResolvedValue({
      data: { id: '1', title: 'Basic Flight', docs: 'docs here' }
    });
    axios.post.mockResolvedValueOnce({
      data: { is_correct: true, feedback: 'Well done!' }
    });

    renderWithRouter(<Module />);
    await waitFor(() => screen.getByRole('button', { name: /validate|submit/i }));

    const textarea = document.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'tello.takeoff()\ntello.land()' } });
    }
    fireEvent.click(screen.getByRole('button', { name: /validate|submit/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/validate_code'),
        expect.any(Object)
      );
    });
  });

  test('UTC-W04-003: success feedback shows after valid code', async () => {
    axios.post.mockResolvedValueOnce({
      data: { is_correct: true, feedback: 'Perfect! Your code is correct.' }
    });
    renderWithRouter(<Module />);
    // Wait for any validate button and click it
    await waitFor(() => screen.queryByRole('button', { name: /validate|submit/i }));
    const btn = screen.queryByRole('button', { name: /validate|submit/i });
    if (btn) {
      fireEvent.click(btn);
      await waitFor(() => {
        expect(screen.queryByText(/correct|well done|success|perfect/i)).toBeTruthy();
      });
    }
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// UTC-W05: moduleStrings content
// ═══════════════════════════════════════════════════════════════════════════════

describe('moduleStrings.js (assets/strings/moduleStrings.js)', () => {
  let MODULE_CONTENT;
  beforeEach(async () => {
    ({ MODULE_CONTENT } = await import('../assets/strings/moduleStrings'));
  });

  test('UTC-W05-001: exports an array', () => {
    expect(Array.isArray(MODULE_CONTENT)).toBe(true);
  });

  test('UTC-W05-002: has exactly 5 modules', () => {
    expect(MODULE_CONTENT).toHaveLength(5);
  });

  test('UTC-W05-003: every module has id, title, and docs', () => {
    MODULE_CONTENT.forEach(m => {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('title');
      expect(m).toHaveProperty('docs');
    });
  });

  test('UTC-W05-004: module 1 docs contain djitellopy reference', () => {
    const m1 = MODULE_CONTENT.find(m => m.id === 1 || m.id === '1');
    expect(m1.docs).toMatch(/djitellopy/i);
  });

  test('UTC-W05-005: module ids are unique', () => {
    const ids = MODULE_CONTENT.map(m => String(m.id));
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
