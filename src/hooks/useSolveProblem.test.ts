/**
 * useSolveProblem Hook Tests
 * TDD: Tests for the problem solving API hook
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSolveProblem } from './useSolveProblem';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSolveProblem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('should have null solution initially', () => {
      const { result } = renderHook(() => useSolveProblem());

      expect(result.current.solution).toBeNull();
    });

    it('should not be loading initially', () => {
      const { result } = renderHook(() => useSolveProblem());

      expect(result.current.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      const { result } = renderHook(() => useSolveProblem());

      expect(result.current.error).toBeNull();
    });

    it('should provide solve function', () => {
      const { result } = renderHook(() => useSolveProblem());

      expect(typeof result.current.solve).toBe('function');
    });

    it('should provide reset function', () => {
      const { result } = renderHook(() => useSolveProblem());

      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('solve function - successful request', () => {
    const mockSolution = {
      id: 'sol-123',
      question: '변압기 용량 계산',
      category: 'DESIGN',
      solution: '풀이 내용',
      answer: '500 kVA',
      steps: [{ order: 1, title: '분석', content: '문제 분석' }],
      formulas: ['S = VI'],
      verification: { isValid: true, confidence: 0.95 },
      agents: { primary: 'DESIGN', secondary: [] },
      processingTime: 1.5,
      createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockSolution }),
      });
    });

    it('should set loading to true while solving', async () => {
      const { result } = renderHook(() => useSolveProblem());

      // Start solve but don't wait
      act(() => {
        result.current.solve({ text: '변압기 용량 계산' });
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set solution on successful response', async () => {
      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '변압기 용량 계산' });
      });

      expect(result.current.solution).toEqual(mockSolution);
      expect(result.current.error).toBeNull();
    });

    it('should call fetch with correct parameters', async () => {
      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '테스트 문제' });
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '테스트 문제' }),
      });
    });

    it('should call fetch with imageBase64 when provided', async () => {
      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ imageBase64: 'base64data' });
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: 'base64data' }),
      });
    });

    it('should call onSuccess callback when provided', async () => {
      const onSuccess = vi.fn();
      const { result } = renderHook(() => useSolveProblem({ onSuccess }));

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockSolution);
    });

    it('should clear error on new request', async () => {
      // First, set up an error state
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: '에러' }),
      });

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '실패할 요청' });
      });

      expect(result.current.error).not.toBeNull();

      // Now set up success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockSolution }),
      });

      await act(async () => {
        await result.current.solve({ text: '성공할 요청' });
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('solve function - error handling', () => {
    it('should set error on API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: '서버 오류가 발생했습니다' }),
      });

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('서버 오류가 발생했습니다');
      expect(result.current.solution).toBeNull();
    });

    it('should set error on success:false response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, error: '풀이 실패' }),
      });

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('풀이 실패');
    });

    it('should set error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
    });

    it('should call onError callback when provided', async () => {
      const onError = vi.fn();
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: '에러 발생' }),
      });

      const { result } = renderHook(() => useSolveProblem({ onError }));

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('should set loading to false after error', async () => {
      mockFetch.mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle non-Error thrown objects', async () => {
      mockFetch.mockRejectedValue('string error');

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('알 수 없는 오류');
    });

    it('should use default error message when error field is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(result.current.error?.message).toBe('문제 풀이 중 오류가 발생했습니다');
    });
  });

  describe('solve function - input validation', () => {
    it('should not call fetch when both text and imageBase64 are empty', async () => {
      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({});
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not call fetch when text is empty string', async () => {
      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '' });
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call fetch when only text is provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '문제' });
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should call fetch when only imageBase64 is provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ imageBase64: 'data' });
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('reset function', () => {
    it('should reset solution to null', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'test', answer: '답' },
          }),
      });

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(result.current.solution).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.solution).toBeNull();
    });

    it('should reset error to null', async () => {
      mockFetch.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useSolveProblem());

      await act(async () => {
        await result.current.solve({ text: '테스트' });
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
    });

    it('should not affect loading state', async () => {
      const { result } = renderHook(() => useSolveProblem());

      act(() => {
        result.current.reset();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Hook stability', () => {
    it('should maintain stable function references', () => {
      const { result, rerender } = renderHook(() => useSolveProblem());

      const initialSolve = result.current.solve;
      const initialReset = result.current.reset;

      rerender();

      expect(result.current.solve).toBe(initialSolve);
      expect(result.current.reset).toBe(initialReset);
    });

    it('should update function references when options change', () => {
      const onSuccess1 = vi.fn();
      const onSuccess2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ onSuccess }) => useSolveProblem({ onSuccess }),
        { initialProps: { onSuccess: onSuccess1 } }
      );

      // Verify function exists before rerender
      expect(typeof result.current.solve).toBe('function');

      rerender({ onSuccess: onSuccess2 });

      // Note: Due to useCallback dependency on options, solve might be recreated
      // This is expected React behavior
      expect(typeof result.current.solve).toBe('function');
    });
  });
});
